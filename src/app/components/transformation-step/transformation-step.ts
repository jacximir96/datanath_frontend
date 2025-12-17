import { Component, inject, OnInit, signal, effect, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatCardModule } from '@angular/material/card';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatExpansionModule } from '@angular/material/expansion';
import { MatChipsModule } from '@angular/material/chips';
import { MatSelectModule } from '@angular/material/select';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatTableModule } from '@angular/material/table';
import { ConfigService } from '../../services/config.service';
import { MetadataService } from '../../services/metadata.service';
import { Template, TransformationFilter, MergeConfig, MergeOn, TransformationProperty } from '../../models/config.model';
import { ColumnInfo, RelationInfo } from '../../models/metadata.model';
import { JsonBuilderComponent } from '../json-builder/json-builder';

@Component({
  selector: 'app-transformation-step',
  standalone: true,
  imports: [
    CommonModule, FormsModule, MatCardModule, MatFormFieldModule,
    MatInputModule, MatButtonModule, MatIconModule, MatExpansionModule,
    MatChipsModule, MatSelectModule, MatProgressSpinnerModule, MatTableModule,
    JsonBuilderComponent
  ],
  templateUrl: './transformation-step.html',
  styleUrl: './transformation-step.css',
})
export class TransformationStepComponent implements OnInit {
  protected configService = inject(ConfigService);
  private metadataService = inject(MetadataService);

  templateName = '';
  templateDescription = '';
  showSaveTemplate = false;

  // Transformation type selector
  transformationType: 'T010' | 'T012' = 'T012';
  showMetadata = false;

  // Metadata cache
  entityMetadata = signal<Map<string, { columns: ColumnInfo[], relations: RelationInfo[], loading: boolean }>>(new Map());

  // Output configuration
  newOutputFormat = 'json';
  newWrapStructure = '{}';
  useVisualBuilder = true;

  // Computed signal que calcula columnas Y metadata al mismo tiempo
  private columnsData = computed(() => {
    const config = this.configService.config();
    const columns: string[] = [];
    const metadata = new Map<string, { isArray: boolean, count: number, sample?: any }>();

    // Unify all entities from all groups
    const allEntities = config.entityGroups.flatMap(group => group.entities);

    // Always read the defined properties for all entities
    allEntities.forEach(entity => {
      entity.properties.forEach(prop => {
        const columnKey = prop.name.includes('.')
          ? prop.name
          : `${entity.name}.${prop.name}`;
        if (!columns.includes(columnKey)) {
          columns.push(columnKey);
        }
        // Set basic metadata
        if (!metadata.has(columnKey)) {
          metadata.set(columnKey, { isArray: false, count: 0, sample: null });
        }
      });
    });

    // Optionally, enrich metadata with query results if available
    config.entityGroups.forEach(group => {
      if (group.queryResult && Array.isArray(group.queryResult)) {
        group.queryResult.forEach((item: any) => {
          Object.keys(item).forEach(entityName => {
            const entityData = item[entityName];
            if (Array.isArray(entityData) && entityData.length > 0) {
              const firstItem = entityData[0];
              Object.keys(firstItem).forEach(field => {
                const fieldKey = `${entityName}.${field}`;
                if (metadata.has(fieldKey)) {
                  const currentMeta = metadata.get(fieldKey)!;
                  currentMeta.sample = firstItem[field];
                  metadata.set(fieldKey, currentMeta);
                }
              });
            }
          });
        });
      }
    });

    const uniqueColumns = [...new Set(columns)];
    return { columns: uniqueColumns, metadata };
  });

  // Computed signals derivados que extraen las partes individuales
  get availableColumns(): string[] {
    return this.columnsData().columns;
  }

  columnMetadata = computed(() => {
    return this.columnsData().metadata;
  });

  // Helper para obtener información de una columna
  getColumnInfo(columnName: string): { isArray: boolean, count: number, sample?: any } | undefined {
    return this.columnMetadata().get(columnName);
  }

  // Helper para formatear el nombre de la columna con información adicional
  formatColumnLabel(columnName: string): string {
    const info = this.getColumnInfo(columnName);
    if (!info) return columnName;

    if (info.isArray && info.count > 0) {
      return `${columnName} [Array: ${info.count} elementos]`;
    } else if (info.isArray) {
      return `${columnName} [Array]`;
    }
    return columnName;
  }

  onJsonBuilderChange(structure: any) {
    this.newWrapStructure = JSON.stringify(structure, null, 2);
  }

  // Merge configuration
  newMergeBase = '';
  newMergeType: 'left' | 'right' | 'inner' | 'outer' = 'left';
  newMergeTargets = signal<string[]>([]);
  newMergeTargetInput = '';
  newMergeOn = signal<MergeOn[]>([]);
  newMergeOnLeft = '';
  newMergeOnRight = '';

  mergeTypes: Array<'left' | 'right' | 'inner' | 'outer'> = ['left', 'right', 'inner', 'outer'];

  constructor() {
    effect(() => {
      const config = this.configService.config();
      const transformation = config.transformation;
      const currentProperties = transformation.properties || [];

      if (currentProperties.length > 0) {
        // Has a properties object. Let's check if it should be there.
        const merges = currentProperties[0].merge;
        if (merges.length === 0) {
          // No merges, so properties should be empty.
          this.configService.updateTransformation({
            ...transformation,
            properties: []
          });
        } else {
          // Has merges, let's sync entities.
          const entityNames = config.entities.map(e => ({ name: e.name }));
          const currentTransformationEntities = currentProperties[0].entities;
          if (JSON.stringify(currentTransformationEntities) !== JSON.stringify(entityNames)) {
            const newProperties = [...currentProperties];
            newProperties[0] = { ...newProperties[0], entities: entityNames };
            this.configService.updateTransformation({
              ...transformation,
              properties: newProperties
            });
          }
        }
      }
    });
  }

  ngOnInit() {
    this.configService.loadTemplatesFromLocalStorage();
    this.autoDetectMerges();
    this.onTransformationTypeChange(); // Set default value on init
  }

  autoDetectMerges() {
    const config = this.configService.config();
    const entities = config.entities;

    if (entities.length < 2) return; // Need at least 2 entities to merge

    // Find entities with relations
    entities.forEach(entity => {
      if (entity.relations && entity.relations.length > 0) {
        // Auto-create merge configuration based on FK
        const relatedEntityNames = entity.relations
          .map(rel => rel.relatedTable)
          .filter(tableName => entities.some(e => e.name === tableName));

        if (relatedEntityNames.length > 0) {
          // Prepare merge ON conditions
          const onConditions: MergeOn[] = entity.relations
            .filter(rel => relatedEntityNames.includes(rel.relatedTable))
            .map(rel => ({
              left: `${entity.name}.${rel.fromColumn}`,
              right: `${rel.relatedTable}.${rel.toColumn}`
            }));

          // Add auto-detected merge if not already present
          const mergeExists = this.mergeConfigs.some(m => m.base === entity.name);
          if (!mergeExists && relatedEntityNames.length > 0) {
            this.mergeConfigs.push({
              base: entity.name,
              type: 'left',
              targets: relatedEntityNames,
              on: onConditions
            });
          }
        }
      }
    });

    // Merges are added to mergeConfigs array, which will be used when saving
  }

  get code(): string {
    return this.configService.config().transformation.code;
  }

  set code(value: string) {
    const config = this.configService.config();
    this.configService.updateTransformation({
      ...config.transformation,
      code: value
    });
  }

  onTransformationTypeChange() {
    const config = this.configService.config();
    this.configService.updateTransformation({
      ...config.transformation,
      code: this.transformationType
    });
  }

  get country(): string {
    return this.configService.config().transformation.country;
  }

  set country(value: string) {
    const config = this.configService.config();
    this.configService.updateTransformation({
      ...config.transformation,
      country: value
    });
  }

  get properties(): TransformationProperty[] {
    return this.configService.config().transformation.properties || [];
  }

  get mergeConfigs(): MergeConfig[] {
    return this.properties[0]?.merge || [];
  }

  get availableEntities(): string[] {
    return this.configService.config().entities.map(e => e.name);
  }

  // Merge configuration methods
  addMergeTarget() {
    if (this.newMergeTargetInput.trim()) {
      this.newMergeTargets.update(targets => [...targets, this.newMergeTargetInput.trim()]);
      this.newMergeTargetInput = '';
    }
  }

  removeMergeTarget(index: number) {
    this.newMergeTargets.update(targets => targets.filter((_, i) => i !== index));
  }

  addMergeOn() {
    if (this.newMergeOnLeft && this.newMergeOnRight) {
      this.newMergeOn.update(ons => [...ons, {
        left: this.newMergeOnLeft,
        right: this.newMergeOnRight
      }]);
      this.newMergeOnLeft = '';
      this.newMergeOnRight = '';
    }
  }

  removeMergeOn(index: number) {
    this.newMergeOn.update(ons => ons.filter((_, i) => i !== index));
  }

  addMerge() {
    if (!this.newMergeBase || this.newMergeTargets().length === 0 || this.newMergeOn().length === 0) {
      alert('Por favor completa todos los campos del merge (base, targets, on)');
      return;
    }

    const config = this.configService.config();
    const newMerge: MergeConfig = {
      base: this.newMergeBase,
      type: this.newMergeType,
      targets: [...this.newMergeTargets()],
      on: [...this.newMergeOn()]
    };

    const currentProperties = config.transformation.properties || [];
    const updatedProperties = [...currentProperties];

    if (updatedProperties.length === 0) {
      updatedProperties.push({
        entities: config.entities.map(e => ({ name: e.name })),
        merge: [newMerge]
      });
    } else {
      updatedProperties[0] = {
        ...updatedProperties[0],
        merge: [...updatedProperties[0].merge, newMerge]
      };
    }

    this.configService.updateTransformation({
      ...config.transformation,
      properties: updatedProperties
    });

    // Reset form
    this.newMergeBase = '';
    this.newMergeType = 'left';
    this.newMergeTargets.set([]);
    this.newMergeOn.set([]);
  }

  removeMerge(index: number) {
    const config = this.configService.config();
    const currentProperties = config.transformation.properties || [];
    if (currentProperties.length > 0) {
      const updatedProperties = [...currentProperties];
      updatedProperties[0] = {
        ...updatedProperties[0],
        merge: updatedProperties[0].merge.filter((_, i) => i !== index)
      };
      this.configService.updateTransformation({
        ...config.transformation,
        properties: updatedProperties
      });
    }
  }

  // Filter (output) configuration methods
  get filter(): TransformationFilter[] {
    return this.configService.config().transformation.filter || [];
  }

  addFilter() {
    try {
      const wrapStructure = JSON.parse(this.newWrapStructure);
      const config = this.configService.config();
      const newFilter: TransformationFilter = {
        output_format: this.newOutputFormat,
        wrap_structure: wrapStructure
      };
      this.configService.updateTransformation({
        ...config.transformation,
        filter: [...config.transformation.filter, newFilter]
      });
      this.newOutputFormat = 'json';
      this.newWrapStructure = '{}';
    } catch (e) {
      alert('JSON inválido en wrap_structure');
    }
  }

  removeFilter(index: number) {
    const config = this.configService.config();
    this.configService.updateTransformation({
      ...config.transformation,
      filter: config.transformation.filter.filter((_, i) => i !== index)
    });
  }

  // Template methods
  get templates(): Template[] {
    return this.configService.templates();
  }

  get hasEntities(): boolean {
    return this.configService.config().entities.length > 0;
  }

  loadTemplate(templateId: string) {
    this.configService.loadTemplate(templateId);
  }

  deleteTemplate(templateId: string) {
    if (confirm('¿Seguro que deseas eliminar esta plantilla?')) {
      this.configService.deleteTemplate(templateId);
    }
  }

  saveAsTemplate() {
    if (this.hasEntities && this.templateName) {
      this.configService.saveTemplate(this.templateName, this.templateDescription);
      this.templateName = '';
      this.templateDescription = '';
      this.showSaveTemplate = false;
      alert('Plantilla guardada exitosamente!');
    }
  }

  // Metadata methods
  loadMetadataForEntity(entityName: string) {
    const currentMetadata = this.entityMetadata();

    // Si ya está cargado o cargando, no hacer nada
    if (currentMetadata.has(entityName)) {
      return;
    }

    // Marcar como loading
    const newMetadata = new Map(currentMetadata);
    newMetadata.set(entityName, { columns: [], relations: [], loading: true });
    this.entityMetadata.set(newMetadata);

    const config = this.configService.config();
    if (config.origins.length === 0) {
      console.warn('No hay origins configurados');
      return;
    }

    const origin = config.origins[0];

    // Cargar columnas y relaciones en paralelo
    Promise.all([
      this.metadataService.getTableColumns(origin, entityName).toPromise(),
      this.metadataService.getTableRelations(origin, entityName).toPromise()
    ]).then(([columns, relations]) => {
      const updatedMetadata = new Map(this.entityMetadata());
      updatedMetadata.set(entityName, {
        columns: columns || [],
        relations: relations || [],
        loading: false
      });
      this.entityMetadata.set(updatedMetadata);
    }).catch(error => {
      console.error(`Error loading metadata for ${entityName}:`, error);
      const updatedMetadata = new Map(this.entityMetadata());
      updatedMetadata.set(entityName, {
        columns: [],
        relations: [],
        loading: false
      });
      this.entityMetadata.set(updatedMetadata);
    });
  }

  getMetadataForEntity(entityName: string): { columns: ColumnInfo[], relations: RelationInfo[], loading: boolean } | undefined {
    return this.entityMetadata().get(entityName);
  }
}
