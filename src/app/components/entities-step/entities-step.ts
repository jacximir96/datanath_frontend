import { Component, inject, signal, computed, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { MatCardModule } from '@angular/material/card';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatChipsModule } from '@angular/material/chips';
import { MatSelectModule } from '@angular/material/select';
import { MatExpansionModule } from '@angular/material/expansion';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatBadgeModule } from '@angular/material/badge';
import { MatSnackBar } from '@angular/material/snack-bar';
import { MatDialogModule, MatDialog } from '@angular/material/dialog';
import { MatDividerModule } from '@angular/material/divider';
import { MatAutocompleteModule } from '@angular/material/autocomplete';
import { MatTabsModule } from '@angular/material/tabs';
import { MatSlideToggleModule } from '@angular/material/slide-toggle';
import Swal from 'sweetalert2';
import { ConfigService } from '../../services/config.service';
import { MetadataService } from '../../services/metadata.service';
import { OrchestratorService } from '../../services/orchestrator.service';
import { GraphqlService } from '../../services/graphql.service';
import { Entity, Filter, Property, Origin, EntityRelation, EntityGroup, TransformationProperty, MergeConfig, WrapStructure } from '../../models/config.model';
import { ColumnInfo, RelationInfo } from '../../models/metadata.model';


interface ColumnSelection extends ColumnInfo {
  selected: boolean;
  customToName?: string;
  customToType?: string;
  tableName?: string; // Add table name for tracking
}

interface RelationWithColumns extends RelationInfo {
  expanded: boolean;
  columns: ColumnSelection[];
  loadingColumns: boolean;
  relations?: RelationWithColumns[];
  loadingRelations?: boolean;
  joinType?: 'left' | 'inner' | 'right'; // Join type selection
}

interface TableWithColumns {
  tableName: string;
  expanded: boolean;
  loading: boolean;
  columns: ColumnSelection[];
}

@Component({
  selector: 'app-entities-step',
  standalone: true,
  imports: [
    CommonModule, FormsModule, MatCardModule, MatFormFieldModule,
    MatInputModule, MatButtonModule, MatIconModule, MatChipsModule,
    MatSelectModule, MatExpansionModule, MatCheckboxModule,
    MatProgressSpinnerModule, MatTooltipModule, MatBadgeModule, MatDialogModule,
    MatDividerModule, MatAutocompleteModule, MatTabsModule, MatSlideToggleModule
  ],
  templateUrl: './entities-step.html',
  styleUrl: './entities-step.css',
})
export class EntitiesStepComponent implements OnInit {
  protected configService = inject(ConfigService);
  protected metadataService = inject(MetadataService);
  private orchestratorService = inject(OrchestratorService);
  private graphqlService = inject(GraphqlService);
  private snackBar = inject(MatSnackBar);
  private dialog = inject(MatDialog);

  private readonly ORCHESTRATOR_USER = 'usr_orquestador';
  private readonly ORCHESTRATOR_PASSWORD = 'usr_orquestador';

  // Signals for dynamic data
  availableClients = computed(() => this.configService.config().clients); // List of clients
  selectedClient = signal<string | null>(null); // Selected client name
  selectedClientConfig = signal<any | null>(null); // Configuración completa del cliente seleccionado
  availableOriginsForClient = signal<Origin[]>([]); // Conexiones disponibles del cliente seleccionado
  availableOrigins = computed(() => this.configService.config().origins);
  selectedOrigin = signal<Origin | null>(null);
  availableTables = signal<string[]>([]);
  selectedTable = signal<string | null>(null);
  tableColumns = signal<ColumnSelection[]>([]);

  // Search/Filter states
  tableSearchText = signal<string>('');
  columnSearchText = signal<string>('');

  // Filtered data (computed)
  filteredTables = computed(() => {
    const searchText = this.tableSearchText().toLowerCase();
    if (!searchText) return this.availableTables();
    return this.availableTables().filter(table =>
      table.toLowerCase().includes(searchText)
    );
  });

  filteredColumns = computed(() => {
    const searchText = this.columnSearchText().toLowerCase();
    if (!searchText) return this.tableColumns();
    return this.tableColumns().filter(col =>
      col.columnName.toLowerCase().includes(searchText)
    );
  });

  // Loading states
  loadingTables = signal<boolean>(false);
  loadingColumns = signal<boolean>(false);

  // Mode: 'manual', 'dynamic'
  entryMode = signal<'manual' | 'dynamic'>('dynamic');

  // Filters for dynamic mode
  currentEntityFilters = signal<Filter[]>([]);
  newFilterName = signal<string>('');
  newFilterOperator = 'equals';
  newFilterValue = '';

  // Computed for filtering columns in filter form
  filteredColumnsForFilter = computed(() => {
    const searchText = this.newFilterName().toLowerCase();
    if (!searchText) return this.tableColumns();
    return this.tableColumns().filter(col =>
      col.columnName.toLowerCase().includes(searchText)
    );
  });

  // Cascade filters (based on previous results)
  selectedPreviousGroup = signal<EntityGroup | null>(null);
  selectedPreviousField = signal<string>('');
  targetFilterColumn = signal<string>('');
  availableFieldsFromPreviousResult = signal<string[]>([]);

  // Manual entry (legacy)
  newEntity = signal<Entity>({ name: '', properties: [], filters: [] });
  newPropertyName = '';
  newPropertyType = 'text';

  operators = ['equals', 'contains', 'startsWith', 'endsWith', 'greaterThan', 'lessThan', 'in'];
  dataTypes = ['text', 'number', 'date', 'boolean', 'int', 'varchar', 'datetime', 'decimal', 'bit'];

  ngOnInit(): void {
    // Check if we have origins configured
    if (this.availableOrigins().length > 0) {
      this.entryMode.set('dynamic'); // Default to dynamic mode
    } else {
      this.entryMode.set('manual');
    }
  }

  // NEW: Get entity groups from the service
  entityGroups = computed(() => this.configService.config().entityGroups || []);

  // Check if a new group can be created (no longer depends on query results)
  canCreateNewGroup = computed(() => {
    // Always allow creating new groups since we don't require query execution
    return true;
  });

  // Dynamic mode functions
  onClientSelected(clientName: string): void {
    this.selectedClient.set(clientName);
    this.selectedTable.set(null);
    this.tableColumns.set([]);
    this.selectedOrigin.set(null);

    // Find the client in clientConfigs
    const clientConfig = this.configService.clientConfigs().find(c => c.name === clientName);

    if (clientConfig && clientConfig.stores.length > 0) {
      this.selectedClientConfig.set(clientConfig);
      this.availableOriginsForClient.set(clientConfig.stores);

      // Verificar el tipo de estructura del cliente
      const structureType = clientConfig.structureType || 'same'; // Por defecto 'same' para retrocompatibilidad

      if (structureType === 'same') {
        // Todas las conexiones tienen la misma estructura - auto-seleccionar la primera
        const firstOrigin = clientConfig.stores[0];
        this.selectedOrigin.set(firstOrigin);
        this.loadTablesForOrigin(firstOrigin);
        this.snackBar.open('✓ Cliente con misma estructura - Primera conexión seleccionada automáticamente', 'Cerrar', { duration: 3000 });
      } else {
        // Conexiones con diferentes estructuras - usuario debe seleccionar manualmente
        this.snackBar.open('Cliente con estructuras diferentes - Selecciona la conexión específica', 'Cerrar', { duration: 4000 });
      }
    } else {
      this.selectedClientConfig.set(null);
      this.availableOriginsForClient.set([]);
      this.selectedOrigin.set(null);
      this.snackBar.open('No se encontraron bases de datos para este cliente', 'Cerrar', { duration: 3000 });
    }
  }

  onOriginSelected(origin: Origin): void {
    this.selectedOrigin.set(origin);
    this.selectedTable.set(null);
    this.tableColumns.set([]);
    this.loadTablesForOrigin(origin);
  }

  loadTablesForOrigin(origin: Origin): void {
    this.loadingTables.set(true);
    this.availableTables.set([]);

    this.metadataService.getTables(origin).subscribe({
      next: (tables) => {
        this.availableTables.set(tables);
        this.loadingTables.set(false);
      },
      error: (error) => {
        console.error('Error loading tables:', error);
        this.loadingTables.set(false);
        this.availableTables.set([]);
      }
    });
  }

  onTableSelected(tableName: string): void {
    const origin = this.selectedOrigin();
    if (!origin) return;

    this.selectedTable.set(tableName);
    this.loadTableMetadata(origin, tableName);
  }

  loadTableMetadata(origin: Origin, tableName: string): void {
    this.loadingColumns.set(true);

    // Load columns
    this.metadataService.getTableColumns(origin, tableName).subscribe({
      next: (columns) => {
        const columnsWithSelection: ColumnSelection[] = columns.map(col => ({
          ...col,
          selected: col.isPrimaryKey, // Auto-select primary keys
          customToName: col.columnName,
          customToType: this.mapSqlTypeToAppType(col.dataType)
        }));
        this.tableColumns.set(columnsWithSelection);
        this.loadingColumns.set(false);
      },
      error: (error) => {
        console.error('Error loading columns:', error);
        this.loadingColumns.set(false);
        this.tableColumns.set([]);
      }
    });
  }

  mapSqlTypeToAppType(sqlType: string): string {
    const lowerType = sqlType.toLowerCase();
    if (lowerType.includes('int') || lowerType.includes('number') || lowerType.includes('decimal') || lowerType.includes('float')) {
      return 'number';
    } else if (lowerType.includes('date') || lowerType.includes('time')) {
      return 'date';
    } else if (lowerType.includes('bool') || lowerType.includes('bit')) {
      return 'boolean';
    } else {
      return 'text';
    }
  }

  toggleColumnSelection(column: ColumnSelection): void {
    this.tableColumns.update(columns => {
      const updated = [...columns];
      const index = updated.findIndex(col => col.columnName === column.columnName);
      if (index !== -1) {
        updated[index].selected = !updated[index].selected;
      }
      return updated;
    });
  }

  selectAllColumns(): void {
    this.tableColumns.update(columns =>
      columns.map(col => ({ ...col, selected: true }))
    );
  }

  deselectAllColumns(): void {
    this.tableColumns.update(columns =>
      columns.map(col => ({ ...col, selected: false }))
    );
  }

  // Filter management for dynamic mode
  addFilterToDynamicEntity(): void {
    if (this.newFilterName() && this.newFilterValue) {
      this.currentEntityFilters.update(filters => [...filters, {
        name: this.newFilterName(),
        operator: this.newFilterOperator,
        value: this.newFilterValue
      }]);
      this.newFilterName.set('');
      this.newFilterOperator = 'equals';
      this.newFilterValue = '';
    }
  }

  removeFilterFromDynamicEntity(index: number): void {
    this.currentEntityFilters.update(filters => filters.filter((_, i) => i !== index));
  }

  // Cascade filter functions
  getGroupsWithResults(): EntityGroup[] {
    // Return all groups to allow building cascade filters without requiring queryResult
    return this.entityGroups();
  }

  onPreviousGroupSelected(group: EntityGroup): void {
    this.selectedPreviousGroup.set(group);
    this.selectedPreviousField.set('');
    this.targetFilterColumn.set('');

    // Extract available fields from the group's entities (instead of queryResult)
    const fields = this.extractFieldsFromGroup(group);
    this.availableFieldsFromPreviousResult.set(fields);
  }

  extractFieldsFromGroup(group: EntityGroup): string[] {
    if (!group || !group.entities || group.entities.length === 0) {
      return [];
    }
    // Get all property names from all entities in the group
    const allFields = new Set<string>();
    group.entities.forEach(entity => {
      entity.properties.forEach(prop => {
        allFields.add(prop.name);
      });
    });
    return Array.from(allFields);
  }

  extractFieldsFromResult(result: any): string[] {
    if (!result) return [];

    try {
      // Handle different result structures
      // Case 1: Array with entity name as key: [{ "EntityName": [{...}] }]
      if (Array.isArray(result) && result.length > 0) {
        const firstItem = result[0];
        const entityKeys = Object.keys(firstItem);

        if (entityKeys.length > 0) {
          const entityData = firstItem[entityKeys[0]];
          if (Array.isArray(entityData) && entityData.length > 0) {
            return Object.keys(entityData[0]);
          }
        }
      }

      // Case 2: Direct object: { field1: value1, field2: value2 }
      if (typeof result === 'object' && !Array.isArray(result)) {
        return Object.keys(result);
      }

      return [];
    } catch (error) {
      console.error('Error extracting fields from result:', error);
      return [];
    }
  }

  extractValuesFromResult(result: any, fieldName: string): any[] {
    if (!result || !fieldName) return [];

    try {
      const values: any[] = [];

      // Case 1: Array with entity name as key: [{ "EntityName": [{...}] }]
      if (Array.isArray(result) && result.length > 0) {
        const firstItem = result[0];
        const entityKeys = Object.keys(firstItem);

        if (entityKeys.length > 0) {
          const entityData = firstItem[entityKeys[0]];
          if (Array.isArray(entityData)) {
            entityData.forEach(item => {
              if (item[fieldName] !== undefined) {
                values.push(item[fieldName]);
              }
            });
          }
        }
      }

      // Case 2: Direct array: [{...}, {...}]
      else if (Array.isArray(result)) {
        result.forEach(item => {
          if (item[fieldName] !== undefined) {
            values.push(item[fieldName]);
          }
        });
      }

      // Remove duplicates
      return [...new Set(values)];
    } catch (error) {
      console.error('Error extracting values from result:', error);
      return [];
    }
  }

  addFilterFromPreviousResult(): void {
    const selectedGroup = this.selectedPreviousGroup();
    const fieldName = this.selectedPreviousField();
    const targetColumn = this.targetFilterColumn();

    if (!selectedGroup || !fieldName || !targetColumn) {
      this.snackBar.open('Por favor completa todos los campos del filtro en cascada', 'Cerrar', { duration: 3000 });
      return;
    }

    // Create filter with placeholder value and dynamic metadata
    // The actual value will be resolved by the orchestrator at runtime
    const newFilter: Filter = {
      name: targetColumn,
      operator: 'in', // Use 'in' for dynamic filters (can have multiple values)
      value: `\${${selectedGroup.name}.${fieldName}}`, // Placeholder showing the dynamic reference
      isDynamic: true,
      dynamicSource: {
        entityName: selectedGroup.name, // The group name is the entity name
        fieldName: fieldName
      }
    };
    this.currentEntityFilters.update(filters => [...filters, newFilter]);

    // Reset cascade filter form
    this.selectedPreviousGroup.set(null);
    this.selectedPreviousField.set('');
    this.targetFilterColumn.set('');
    this.availableFieldsFromPreviousResult.set([]);

    this.snackBar.open(`Filtro en cascada agregado: ${selectedGroup.name}.${fieldName}`, 'Cerrar', { duration: 3000 });
  }

  addEntityFromMetadata(): void {
    const mainTableName = this.selectedTable();
    if (!mainTableName) return;

    // Get selected columns for the main entity
    const selectedMainColumns = this.tableColumns().filter(col => col.selected);

    if (selectedMainColumns.length === 0) {
      Swal.fire({
        icon: 'warning',
        title: 'Sin columnas seleccionadas',
        text: 'Por favor, selecciona al menos una columna para crear la entidad.',
        confirmButtonColor: '#3f51b5'
      });
      return;
    }

    // Create properties from selected columns
    const mainEntityProperties: Property[] = selectedMainColumns.map(col => ({
      name: col.columnName,
      type: col.customToType || this.mapSqlTypeToAppType(col.dataType)
    }));

    // Create the main entity object (simple model, no relations)
    const mainEntity: Entity = {
      name: mainTableName,
      properties: mainEntityProperties,
      filters: [...this.currentEntityFilters()],
      originRepository: this.selectedOrigin()?.repository
    };

    // Create the group as a simple Model
    const finalNewGroup: EntityGroup = {
      name: mainEntity.name,
      type: 'Modelo',
      entities: [mainEntity]
    };

    this.configService.addEntityGroup(finalNewGroup);

    // Automatic execution disabled - users will build the flow without executing queries
    // const newIndex = this.configService.config().entityGroups.length - 1;
    // this.executeQueryForGroup(finalNewGroup, newIndex);

    Swal.fire({
      icon: 'success',
      title: '¡Modelo agregado!',
      html: `El modelo <strong>"${finalNewGroup.name}"</strong> ha sido agregado exitosamente.`,
      timer: 3000,
      timerProgressBar: true,
      showConfirmButton: false,
      toast: true,
      position: 'top-end'
    });

    // Reset UI - Limpiar todos los campos para crear un nuevo modelo
    this.selectedClient.set(null); // Reset selected client
    this.selectedOrigin.set(null);
    this.selectedTable.set(null);
    this.tableSearchText.set('');
    this.columnSearchText.set('');
    this.tableColumns.set([]);
    this.currentEntityFilters.set([]);
    this.newFilterName.set('');
    this.newFilterValue = '';
    this.newFilterOperator = 'equals';
  }

  getSelectedColumnsCount(): number {
    return this.tableColumns().filter(col => col.selected).length;
  }

  // Manual mode functions (legacy)
  addEntity(): void { // Now adds a group
    const entity = this.newEntity();
    if (entity.name) {
      const newGroup: EntityGroup = {
        name: entity.name,
        type: 'Modelo',
        entities: [{ ...entity }]
      };
      this.configService.addEntityGroup(newGroup);

      // Automatic execution disabled - users will build the flow without executing queries
      // const newIndex = this.configService.config().entityGroups.length - 1;
      // this.executeQueryForGroup(newGroup, newIndex);

      this.newEntity.set({ name: '', properties: [], filters: [] }); // Reset form
      Swal.fire({
        icon: 'success',
        title: '¡Modelo agregado!',
        html: `El modelo <strong>"${newGroup.name}"</strong> ha sido agregado exitosamente.`,
        timer: 3000,
        timerProgressBar: true,
        showConfirmButton: false,
        toast: true,
        position: 'top-end'
      });
    }
  }

  addFilter(): void {
    if (this.newFilterName() && this.newFilterValue) {
      const entity = this.newEntity();
      entity.filters.push({
        name: this.newFilterName(),
        operator: this.newFilterOperator,
        value: this.newFilterValue
      });
      this.newFilterName.set('');
      this.newFilterOperator = 'equals';
      this.newFilterValue = '';
    }
  }

  removeFilter(index: number): void {
    const entity = this.newEntity();
    entity.filters.splice(index, 1);
  }

  addProperty(): void {
    if (this.newPropertyName) {
      const entity = this.newEntity();
      entity.properties.push({
        name: this.newPropertyName,
        type: this.newPropertyType
      });
      this.newPropertyName = '';
      this.newPropertyType = 'text';
    }
  }

  removeProperty(index: number): void {
    const entity = this.newEntity();
    entity.properties.splice(index, 1);
  }

  removeEntityGroup(index: number): void {
    this.configService.removeEntityGroup(index);
  }

  switchToManualMode(): void {
    this.entryMode.set('manual');
  }

  switchToDynamicMode(): void {
    this.entryMode.set('dynamic');
  }

  // ============================================
  // ORCHESTRATOR QUERY FUNCTIONALITY
  // ============================================

  // Per-entity query state is now managed within the component, not globally
  isExecutingQuery = signal(new Map<string, boolean>());
  queryResults = signal(new Map<string, any>());
  queryErrors = signal(new Map<string, any>());

  isValid(): boolean {
    // The step is valid if at least one entity group has been created.
    return this.configService.config().entityGroups.length > 0;
  }

  executeQueryForGroup(group: EntityGroup, index: number): void {
    // Verificar si el token del orquestador es válido
    if (!this.orchestratorService.isTokenValid()) {
      // Hacer login automático con las credenciales del orquestador
      this.orchestratorService.login(this.ORCHESTRATOR_USER, this.ORCHESTRATOR_PASSWORD).subscribe({
        next: (response) => {
          if (!response.error) {
            // Login exitoso, continuar con la ejecución
            this.performExecuteQueryForGroup(group, index);
          } else {
            this.snackBar.open('Error de autenticación: ' + response.mensaje, 'Cerrar', { duration: 5000 });
          }
        },
        error: (error) => {
          console.error('Error al autenticar con el orquestador:', error);
          this.snackBar.open('No se pudo conectar al orquestador', 'Cerrar', { duration: 5000 });
        }
      });
    } else {
      // Token válido, ejecutar directamente
      this.performExecuteQueryForGroup(group, index);
    }
  }

  private performExecuteQueryForGroup(group: EntityGroup, index: number): void {
    const config = this.configService.config();
    if (!config.clients || config.clients.length === 0) {
      this.snackBar.open('Por favor configura al menos un cliente primero', 'Cerrar', { duration: 3000 });
      return;
    }

    // Find all unique origins required for the entities in the group
    const requiredOriginRepos = [...new Set(group.entities.map((e: Entity) => e.originRepository))];
    let requiredOrigins = config.origins.filter(o => requiredOriginRepos.includes(o.repository!));

    if (requiredOrigins.length !== requiredOriginRepos.length) {
      this.snackBar.open(`No se pudieron encontrar todos los orígenes para el grupo "${group.name}"`, 'Cerrar', { duration: 4000 });
      return;
    }

    // TODO: SE TIENE QUE BORRAR - Validación temporal para Docker
    requiredOrigins = requiredOrigins.map(origin => {
      if ((origin.adapter?.toLowerCase().includes('mongo')) &&
          origin.servidor?.toLowerCase() === 'localhost') {
        return { ...origin, servidor: 'host.docker.internal' };
      }
      return origin;
    });

    // Create a clean version of entities for the orchestrator, with resolved filter values
    const cleanEntities: Entity[] = JSON.parse(JSON.stringify(group.entities)); // Deep copy to remove signal wrappers and allow mutation
    cleanEntities.forEach(entity => {
        delete (entity as any).relations;
        delete (entity as any).originRepository;
        if (entity.filters) {
            entity.filters.forEach(filter => {
                delete (filter as any).isDynamic;
                delete (filter as any).dynamicSource;
            });
        }
    });

    // Apply transformation rules specifically for this execution
    const finalTransformation = { ...config.transformation };
    if (finalTransformation.code === 'T012') {
      finalTransformation.filter = [
        { output_format: 'json', wrap_structure: {} }
      ];
    }
    finalTransformation.country = 'ECU';
    finalTransformation.properties = this.generateTransformationProperties(group.entities);

    const groupConfig = {
        clients: config.clients, // Changed from client to clients
        origins: requiredOrigins,
        entities: cleanEntities, 
        transformation: finalTransformation,
        target: {
            connection: {
                server: "https://host.docker.internal:8081",
                port: "",
                user: "",
                password:"C2y6yDjf5/R+ob0N8A7Cgv30VRDJIWEHLM+4QDU5DE2nQ9nDuVTqobD4b8mGGyPMbIZnqyMsEcaGQy67XIw/Jw==",
                repository: "requestdb",
                adapter: "CosmosDB"
            },
            entities: [{ name: "result", toName: "persistentrequirement", properties: [] }]
        }
    };

    // Store the sent config JSON in the group
    let updatedGroup = { ...group, isExecuting: true, queryResult: null, queryError: null, sentConfigJson: groupConfig };
    this.configService.updateEntityGroup(index, updatedGroup);

    this.orchestratorService.sendToOrchestrator(groupConfig).subscribe({
      next: response => this.handleOrchestratorSuccess(response, 'group', index),
      error: error => this.handleOrchestratorError(error, 'group', index)
    });
  }

  private generateTransformationProperties(entities: Entity[]): TransformationProperty[] {
    console.log('[generateTransformationProperties] Called with entities:', entities);
    console.log('[generateTransformationProperties] Entities count:', entities.length);

    if (entities.length <= 1) {
      console.log('[generateTransformationProperties] Returning empty - only one or zero entities');
      return []; // No merges needed for single entity or empty list
    }

    // The main entity is the one with the relations array.
    const mainEntity = entities.find(e => e.relations && e.relations.length > 0);
    console.log('[generateTransformationProperties] Found mainEntity:', mainEntity?.name);

    if (!mainEntity || !mainEntity.relations || mainEntity.relations.length === 0) {
      console.log('[generateTransformationProperties] Returning empty - no relations found');
      return []; // No relations defined for the main entity
    }

    console.log('[generateTransformationProperties] Main entity relations:', mainEntity.relations);
    console.log('[generateTransformationProperties] Main entity relations count:', mainEntity.relations.length);

    // Extract ALL related tables from the relations (both fromTable and relatedTable)
    // to ensure we capture all tables in the chain
    const allTablesInRelations = new Set<string>();

    mainEntity.relations.forEach(rel => {
      console.log(`[generateTransformationProperties] Relation: ${rel.fromTable} -> ${rel.relatedTable}`);
      // Add the relatedTable (target of the relation)
      allTablesInRelations.add(rel.relatedTable);
      // Also add fromTable if it's not the main entity (for nested relations)
      if (rel.fromTable !== mainEntity.name) {
        allTablesInRelations.add(rel.fromTable);
      }
    });

    // Convert Set to Array
    const allTargets = Array.from(allTablesInRelations);
    console.log('[generateTransformationProperties] All targets:', allTargets);
    console.log('[generateTransformationProperties] Targets count:', allTargets.length);

    // Include the type in each on condition from the relation's joinType
    const allOnConditions = mainEntity.relations.map(rel => ({
        left: `${rel.relatedTable}.${rel.toColumn}`,
        right: `${rel.fromTable}.${rel.fromColumn}`,
        type: rel.joinType || 'left' // Include specific type for each condition
    }));

    // Use the joinType from the first relation as the main type, or default to 'left' if not specified
    const joinType = mainEntity.relations[0]?.joinType || 'left';

    const combinedMergeOperation: MergeConfig = {
      base: mainEntity.name,
      type: joinType, // Main join type (from first relation)
      targets: allTargets,
      on: allOnConditions // Each condition can have its own type
    };

    return [
      {
        entities: entities.map(e => ({ name: e.name })),
        merge: [combinedMergeOperation]
      }
    ];
  }

  private generateWrapStructure(entities: Entity[]): WrapStructure {
    const wrapStructure: WrapStructure = {};
    entities.forEach(entity => {
      entity.properties.forEach(prop => {
        // Assume the output name should be the same as the property name
        // This might need refinement for name collisions across entities later
        wrapStructure[prop.name] = prop.name;
      });
    });
    return wrapStructure;
  }

  private handleOrchestratorSuccess(response: any, targetType: 'group' | 'entity', groupIndex?: number, entity?: Entity) {
    const persistentId = response?.datos[0]?.requestId;
    if (!persistentId) {
        const error = { message: 'La respuesta del orquestador no contiene un ID para la consulta de GraphQL.' };
        this.handleOrchestratorError(error, targetType, groupIndex, entity);
        return;
    }

    // Guardar el persistentId en el EntityGroup inmediatamente
    if (targetType === 'group' && groupIndex !== undefined) {
      const group = this.entityGroups()[groupIndex];
      const updatedGroup = { ...group, persistentId: persistentId };
      this.configService.updateEntityGroup(groupIndex, updatedGroup);
    }

    // Introduce a 10-second delay before making the GraphQL call
    setTimeout(() => {
      this.graphqlService.getPersistentRequirementById(persistentId).subscribe({
          next: graphqlResponse => {
              let result = graphqlResponse.data.getPersistentRequirementById?.data; // Access the nested 'data' field
              // Attempt to parse the 'data' field if it's a string
              if (typeof result === 'string') {
                  try {
                      result = JSON.parse(result);
                  } catch (e) {
                      console.error('Error parsing GraphQL result data string:', e);
                      // Keep original string if parsing fails
                  }
              }
              // Now 'result' is either the parsed JSON object or the original string
              if (targetType === 'entity' && entity) {
                  this.isExecutingQuery.update(m => new Map(m).set(entity.name, false));
                  this.queryResults.update(m => new Map(m).set(entity.name, result));
                  this.snackBar.open(`Consulta para "${entity.name}" finalizada`, 'Cerrar', { duration: 3000 });
              } else if (targetType === 'group' && groupIndex !== undefined) {
                  const group = this.entityGroups()[groupIndex];
                  const updatedGroup = { ...group, isExecuting: false, queryResult: result, persistentId: persistentId, queryError: null };
                  this.configService.updateEntityGroup(groupIndex, updatedGroup);
                  this.snackBar.open(`Consulta para "${group.name}" finalizada`, 'Cerrar', { duration: 3000 });
              }
          },
          error: graphqlError => this.handleOrchestratorError(graphqlError, targetType, groupIndex, entity)
      });
    }, 30000); // 60000 milliseconds = 60 seconds
  }

  private handleOrchestratorError(error: any, targetType: 'group' | 'entity', groupIndex?: number, entity?: Entity) {
      if (targetType === 'entity' && entity) {
          this.isExecutingQuery.update(m => new Map(m).set(entity.name, false));
          this.queryErrors.update(m => new Map(m).set(entity.name, error));
          this.snackBar.open(`Error en consulta para "${entity.name}": ` + error.message, 'Cerrar', { duration: 5000 });
      } else if (targetType === 'group' && groupIndex !== undefined){
          const group = this.entityGroups()[groupIndex];
          const updatedGroup = { ...group, isExecuting: false, queryError: error };
          this.configService.updateEntityGroup(groupIndex, updatedGroup);
          this.snackBar.open(`Error en consulta para "${group.name}": ` + error.message, 'Cerrar', { duration: 5000 });
      }
  }

  copyResultToClipboard(target: 'group' | 'entity', key: string, groupIndex?: number): void {
    let result: any;
    if (target === 'group' && groupIndex !== undefined) {
        result = this.entityGroups()[groupIndex]?.queryResult;
    } else { // 'entity'
        result = this.queryResults().get(key);
    }

    if (result) {
      const json = JSON.stringify(result, null, 2);
      navigator.clipboard.writeText(json).then(() => {
        this.snackBar.open('Resultado copiado al portapapeles', 'Cerrar', { duration: 2000 });
      });
    }
  }

  closeQueryResult(target: 'group' | 'entity', key: string, groupIndex?: number): void {
    if (target === 'group' && groupIndex !== undefined) {
      const group = this.entityGroups()[groupIndex];
      if (group) {
        const updatedGroup = { ...group, queryResult: null, queryError: null };
        this.configService.updateEntityGroup(groupIndex, updatedGroup);
      }
    } else { // 'entity'
      this.queryResults.update(m => { m.delete(key); return new Map(m); });
      this.queryErrors.update(m => { m.delete(key); return new Map(m); });
    }
  }

    updateJoinType(entity: Entity, relationIndex: number, joinType: 'left' | 'inner' | 'right'): void {

      if (entity.relations && entity.relations[relationIndex]) {

        entity.relations[relationIndex].joinType = joinType;

        // The change is automatically reflected since entity is passed by reference

      }

    }

  toggleFixedConnection(entity: Entity): void {
    // Toggle the fixedConnection flag
    entity.fixedConnection = !entity.fixedConnection;

    // Find the group containing this entity and update it
    const groups = this.entityGroups();
    const groupIndex = groups.findIndex(g =>
      g.entities.some(e => e.name === entity.name)
    );

    if (groupIndex !== -1) {
      const group = groups[groupIndex];
      const updatedGroup = { ...group };
      this.configService.updateEntityGroup(groupIndex, updatedGroup);

      // Show feedback to user
      const status = entity.fixedConnection ? 'fijada' : 'desfijada';
      this.snackBar.open(
        `Conexión ${status} para ${entity.name}`,
        'Cerrar',
        { duration: 2000 }
      );
    }
  }

  // Helper method to check if group has relations (avoid template warnings)
  hasRelations(group: EntityGroup): boolean {
    return group.entities.length > 0 &&
           group.entities[0].relations !== undefined &&
           group.entities[0].relations.length > 0;
  }

  }

  