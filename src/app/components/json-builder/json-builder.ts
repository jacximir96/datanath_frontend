import { Component, input, output, signal, effect } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatChipsModule } from '@angular/material/chips';
import { MatExpansionModule } from '@angular/material/expansion';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatListModule } from '@angular/material/list';
import { MatDividerModule } from '@angular/material/divider';
import { debounce } from 'lodash-es';
import { JsonFieldItemComponent, FieldAction } from './json-field-item';

export interface JsonField {
  key: string;
  value: string;
  type: 'column' | 'expression' | 'static' | 'null' | 'object' | 'array';
  originalColumn?: string;
  children?: JsonField[];  // For nested structures
  level?: number;  // Indentation level for display
}

export interface ColumnGroup {
  tableName: string;
  columns: string[];
}

@Component({
  selector: 'app-json-builder',
  standalone: true,
  imports: [
    CommonModule, FormsModule, MatCardModule, MatButtonModule,
    MatIconModule, MatInputModule, MatFormFieldModule,
    MatChipsModule, MatExpansionModule, MatTooltipModule,
    MatListModule, MatDividerModule, JsonFieldItemComponent
  ],
  templateUrl: './json-builder.html',
  styleUrl: './json-builder.css',
})
export class JsonBuilderComponent {
  availableColumns = input<string[]>([]);
  columnMetadata = input<Map<string, { isArray: boolean, count: number, sample?: any }>>(new Map());
  structure = output<any>();

  rootFields = signal<JsonField[]>([]);
  jsonPreview = signal<string>('{}');

  private debouncedEmitStructure = debounce(() => this.emitStructure(), 300);

  constructor() {
    effect(() => {
      this.rootFields(); // a dependency on rootFields
      this.debouncedEmitStructure();
    });
  }

  // Helper para formatear el label de una columna con su metadata
  getColumnLabel(tableName: string, columnName: string): string {
    const fullName = `${tableName}.${columnName}`;
    const metadata = this.columnMetadata().get(fullName);

    if (metadata && metadata.isArray) {
      return `${columnName} [Array: ${metadata.count}]`;
    }
    return columnName;
  }

  // Helper para obtener un badge de tipo para la columna
  getColumnBadge(tableName: string, columnName: string): { text: string, color: string } | null {
    const fullName = `${tableName}.${columnName}`;
    const metadata = this.columnMetadata().get(fullName);

    if (metadata && metadata.isArray) {
      return { text: `Array (${metadata.count})`, color: 'accent' };
    }
    return null;
  }

  // Group columns by table
  get columnsByTable(): ColumnGroup[] {
    const groups: Map<string, string[]> = new Map();

    this.availableColumns().forEach(col => {
      const parts = col.split('.');
      if (parts.length === 2) {
        const [tableName, columnName] = parts;
        if (!groups.has(tableName)) {
          groups.set(tableName, []);
        }
        groups.get(tableName)!.push(columnName);
      }
    });

    return Array.from(groups.entries()).map(([tableName, columns]) => ({
      tableName,
      columns
    }));
  }

  // Track selected parent for adding columns to nested structures
  selectedParentIndex = signal<number | null>(null);
  selectedChildIndex = signal<number | null>(null);

  // Drag and drop state
  draggedColumn: { tableName: string, columnName: string } | null = null;
  draggedFieldIndex: number | null = null;
  dragOverIndex: number | null = null;
  dragOverChildIndex: number | null = null;
  dragOverDeepIndex: number | null = null;
  dragOverPath: number[] | null = null; // For infinitely deep nesting
  draggedFieldPath: number[] | null = null; // Path of field being dragged for reordering

  // Add column from sidebar (click adds to root, drag & drop can go anywhere)
  addColumnField(tableName: string, columnName: string) {
    const fullColumnName = `${tableName}.${columnName}`;
    const newField: JsonField = {
      key: columnName.toLowerCase(),
      value: fullColumnName,
      type: 'column',
      originalColumn: fullColumnName
    };

    // Always add to root level when clicked
    this.rootFields.update(fields => [...fields, newField]);
  }

  // Select a container to add columns to it
  selectContainer(parentIndex: number, childIndex?: number) {
    this.selectedParentIndex.set(parentIndex);
    this.selectedChildIndex.set(childIndex ?? null);
  }

  // Clear container selection (add to root)
  clearContainerSelection() {
    this.selectedParentIndex.set(null);
    this.selectedChildIndex.set(null);
  }

  // Check if container is selected
  isContainerSelected(parentIndex: number, childIndex?: number): boolean {
    if (childIndex !== undefined) {
      return this.selectedParentIndex() === parentIndex && this.selectedChildIndex() === childIndex;
    }
    return this.selectedParentIndex() === parentIndex && this.selectedChildIndex() === null;
  }

  // Add custom field (always at root level)
  addCustomField() {
    const newField: JsonField = {
      key: '',
      value: '',
      type: 'static',
      originalColumn: undefined
    };

    // Always add to root level
    this.rootFields.update(fields => [...fields, newField]);
  }

  removeField(index: number) {
    this.rootFields.update(fields => fields.filter((_, i) => i !== index));
  }

  updateFieldKey(index: number, key: string) {
    this.rootFields.update(fields => {
      const updated = [...fields];
      updated[index].key = key;
      return updated;
    });
  }

  updateFieldValue(index: number, value: string) {
    this.rootFields.update(fields => {
      const updated = [...fields];
      updated[index].value = value;
      return updated;
    });
  }

  updateFieldType(index: number, type: JsonField['type']) {
    this.rootFields.update(fields => {
      const updated = [...fields];
      updated[index].type = type;

      // Reset value based on type
      if (type === 'null') {
        updated[index].value = 'null';
      } else if (type === 'expression') {
        updated[index].value = 'expr:';
      } else if (type === 'column' && updated[index].originalColumn) {
        updated[index].value = updated[index].originalColumn!;
      }

      return updated;
    });
  }

  // Add nested object
  addNestedObject(parentIndex?: number, childIndex?: number) {
    const newField: JsonField = {
      key: '',
      value: '',
      type: 'object',
      children: [],
      level: 0
    };

    if (parentIndex !== undefined && childIndex !== undefined) {
      // Add as child of a nested field
      this.rootFields.update(fields => {
        const updated = [...fields];
        const parentField = updated[parentIndex];
        if (parentField.children && parentField.children[childIndex]) {
          if (!parentField.children[childIndex].children) {
            parentField.children[childIndex].children = [];
          }
          parentField.children[childIndex].children!.push(newField);
        }
        return updated;
      });
    } else if (parentIndex !== undefined) {
      // Add as child of parent
      this.rootFields.update(fields => {
        const updated = [...fields];
        if (!updated[parentIndex].children) {
          updated[parentIndex].children = [];
        }
        updated[parentIndex].children!.push(newField);
        return updated;
      });
    } else {
      // Add at root level
      this.rootFields.update(fields => [...fields, newField]);
    }
  }

  // Add nested array
  addNestedArray(parentIndex?: number, childIndex?: number) {
    const newField: JsonField = {
      key: '',
      value: '',
      type: 'array',
      children: [],
      level: 0
    };

    if (parentIndex !== undefined && childIndex !== undefined) {
      // Add as child of a nested field
      this.rootFields.update(fields => {
        const updated = [...fields];
        const parentField = updated[parentIndex];
        if (parentField.children && parentField.children[childIndex]) {
          if (!parentField.children[childIndex].children) {
            parentField.children[childIndex].children = [];
          }
          parentField.children[childIndex].children!.push(newField);
        }
        return updated;
      });
    } else if (parentIndex !== undefined) {
      this.rootFields.update(fields => {
        const updated = [...fields];
        if (!updated[parentIndex].children) {
          updated[parentIndex].children = [];
        }
        updated[parentIndex].children!.push(newField);
        return updated;
      });
    } else {
      this.rootFields.update(fields => [...fields, newField]);
    }
  }

  // Update nested field key
  updateNestedFieldKey(parentIndex: number, childIndex: number, key: string) {
    this.rootFields.update(fields => {
      const updated = [...fields];
      if (updated[parentIndex].children && updated[parentIndex].children![childIndex]) {
        updated[parentIndex].children![childIndex].key = key;
      }
      return updated;
    });
  }

  // Update nested field value
  updateNestedFieldValue(parentIndex: number, childIndex: number, value: string) {
    this.rootFields.update(fields => {
      const updated = [...fields];
      if (updated[parentIndex].children && updated[parentIndex].children![childIndex]) {
        updated[parentIndex].children![childIndex].value = value;
      }
      return updated;
    });
  }

  // Update nested field type
  updateNestedFieldType(parentIndex: number, childIndex: number, type: JsonField['type']) {
    this.rootFields.update(fields => {
      const updated = [...fields];
      if (updated[parentIndex].children && updated[parentIndex].children![childIndex]) {
        const field = updated[parentIndex].children![childIndex];
        field.type = type;

        // Reset value based on type
        if (type === 'null') {
          field.value = 'null';
        } else if (type === 'expression') {
          field.value = 'expr:';
        } else if (type === 'column' && field.originalColumn) {
          field.value = field.originalColumn;
        }
      }
      return updated;
    });
  }

  // Remove nested field
  removeNestedField(parentIndex: number, childIndex: number) {
    this.rootFields.update(fields => {
      const updated = [...fields];
      if (updated[parentIndex].children) {
        updated[parentIndex].children = updated[parentIndex].children!.filter((_, i) => i !== childIndex);
      }
      return updated;
    });
  }

  // Build JSON object from fields (recursive)
  buildJson(): any {
    return this.buildFromFields(this.rootFields());
  }

  private buildFromFields(fields: JsonField[]): any {
    const result: any = {};

    fields.forEach(field => {
      if (field.key) {
        if (field.type === 'null') {
          result[field.key] = null;
        } else if (field.type === 'object') {
          result[field.key] = field.children && field.children.length > 0
            ? this.buildFromFields(field.children)
            : {};
        } else if (field.type === 'array') {
          if (field.children && field.children.length > 0) {
            // If array has children, build array of objects
            result[field.key] = [this.buildFromFields(field.children)];
          } else {
            result[field.key] = [];
          }
        } else {
          result[field.key] = field.value;
        }
      }
    });

    return result;
  }

  emitStructure() {
    const json = this.buildJson();
    this.structure.emit(json);
    this.jsonPreview.set(JSON.stringify(json, null, 2));
  }

  // Check if column is already added
  isColumnAdded(tableName: string, columnName: string): boolean {
    const fullColumnName = `${tableName}.${columnName}`;
    const check = (fields: JsonField[]): boolean => {
        for (const field of fields) {
            if (field.originalColumn === fullColumnName) {
                return true;
            }
            if (field.children) {
                if (check(field.children)) {
                    return true;
                }
            }
        }
        return false;
    };
    return check(this.rootFields());
  }

  // Drag and drop handlers
  onDragStart(event: DragEvent, tableName: string, columnName: string) {
    this.draggedColumn = { tableName, columnName };
    if (event.dataTransfer) {
      event.dataTransfer.effectAllowed = 'copy';
      event.dataTransfer.setData('text/plain', `${tableName}.${columnName}`);
    }
    // Add dragging class to the element
    (event.target as HTMLElement).classList.add('dragging');
  }

  onDragEnd(event: DragEvent) {
    this.draggedColumn = null;
    this.dragOverIndex = null;
    this.dragOverChildIndex = null;
    this.dragOverDeepIndex = null;
    (event.target as HTMLElement).classList.remove('dragging');
  }

  onDragOver(event: DragEvent, parentIndex: number, childIndex?: number) {
    // Solo acepta drop si es una columna siendo arrastrada
    if (!this.draggedColumn) return;

    event.preventDefault();
    event.stopPropagation();

    if (event.dataTransfer) {
      event.dataTransfer.dropEffect = 'copy';
    }
    this.dragOverIndex = parentIndex;
    this.dragOverChildIndex = childIndex ?? null;
  }

  onDragOverRoot(event: DragEvent) {
    event.preventDefault();
    if (event.dataTransfer) {
      event.dataTransfer.dropEffect = 'copy';
    }
    this.dragOverIndex = -1; // -1 indica nivel raíz
    this.dragOverChildIndex = null;
  }

  onDragLeave(event: DragEvent) {
    // Only clear if we're actually leaving the drop zone
    const relatedTarget = event.relatedTarget as HTMLElement;
    if (!relatedTarget || !relatedTarget.closest('.field-card')) {
      this.dragOverIndex = null;
      this.dragOverChildIndex = null;
      this.dragOverDeepIndex = null;
    }
  }

  // Drag and drop for DEEP nested fields (level 3+)
  onDragOverDeep(event: DragEvent, parentIndex: number, childIndex: number, deepIndex: number) {
    // Solo acepta drop si es una columna siendo arrastrada
    if (!this.draggedColumn) return;

    event.preventDefault();
    event.stopPropagation();

    if (event.dataTransfer) {
      event.dataTransfer.dropEffect = 'copy';
    }
    this.dragOverIndex = parentIndex;
    this.dragOverChildIndex = childIndex;
    this.dragOverDeepIndex = deepIndex;
  }

  onDropDeep(event: DragEvent, parentIndex: number, childIndex: number, deepIndex: number) {
    event.preventDefault();
    event.stopPropagation();

    if (!this.draggedColumn) return;

    const { tableName, columnName } = this.draggedColumn;
    const fullColumnName = `${tableName}.${columnName}`;

    const newField: JsonField = {
      key: columnName.toLowerCase(),
      value: fullColumnName,
      type: 'column',
      originalColumn: fullColumnName
    };

    // Add to deep nested field (level 3)
    this.rootFields.update(fields => {
      const updated = [...fields];
      const parentField = updated[parentIndex];

      if (parentField.children && parentField.children[childIndex]) {
        const childField = parentField.children[childIndex];

        if (childField.children && childField.children[deepIndex]) {
          const deepField = childField.children[deepIndex];

          if (!deepField.children) {
            deepField.children = [];
          }
          deepField.children.push(newField);
        }
      }

      return updated;
    });

    this.draggedColumn = null;
    this.dragOverIndex = null;
    this.dragOverChildIndex = null;
    this.dragOverDeepIndex = null;
  }

  // Generic drag & drop using path array (for ANY depth)
  onDragOverByPath(event: DragEvent, path: number[]) {
    if (!this.draggedColumn) return;

    event.preventDefault();
    event.stopPropagation();

    if (event.dataTransfer) {
      event.dataTransfer.dropEffect = 'copy';
    }
    this.dragOverPath = path;
  }

  onDropByPath(event: DragEvent, path: number[]) {
    event.preventDefault();
    event.stopPropagation();

    if (!this.draggedColumn) return;

    const { tableName, columnName } = this.draggedColumn;
    const fullColumnName = `${tableName}.${columnName}`;

    const newField: JsonField = {
      key: columnName.toLowerCase(),
      value: fullColumnName,
      type: 'column',
      originalColumn: fullColumnName
    };

    this.rootFields.update(fields => {
      const updated = [...fields];
      this.navigateAndUpdate(updated, path, (target) => {
        if (!target.children) {
          target.children = [];
        }
        target.children.push(newField);
      });
      return updated;
    });

    this.draggedColumn = null;
    this.dragOverPath = null;
  }

  // Check if current path matches drag over path
  isPathDraggedOver(path: number[]): boolean {
    if (!this.dragOverPath || this.dragOverPath.length !== path.length) {
      return false;
    }
    return path.every((val, idx) => val === this.dragOverPath![idx]);
  }

  // Get drag over CSS class based on operation type
  getPathDragOverClass(path: number[]): 'drag-over-column' | 'drag-over-reorder' | '' {
    if (!this.dragOverPath || this.dragOverPath.length !== path.length) {
      return '';
    }
    const pathMatches = path.every((val, idx) => val === this.dragOverPath![idx]);
    if (!pathMatches) return '';

    // Check which operation is happening
    if (this.draggedColumn && !this.draggedFieldPath) {
      return 'drag-over-column'; // Adding column from sidebar
    } else if (this.draggedFieldPath) {
      return 'drag-over-reorder'; // Reordering field
    }
    return '';
  }

  // Field reordering using paths (for ANY depth)
  onFieldDragStartByPath(event: DragEvent, path: number[]) {
    this.draggedFieldPath = path;
    if (event.dataTransfer) {
      event.dataTransfer.effectAllowed = 'move';
    }
    (event.target as HTMLElement).classList.add('dragging');
  }

  onFieldDragEndByPath(event: DragEvent) {
    this.draggedFieldPath = null;
    this.dragOverPath = null;
    (event.target as HTMLElement).classList.remove('dragging');
  }

  onFieldDragOverByPath(event: DragEvent, path: number[]) {
    // Si estamos arrastrando una columna, SIEMPRE aceptar el evento en objetos/arrays
    if (this.draggedColumn && !this.draggedFieldPath) {
      const field = this.getFieldByPath(path);
      if (field && (field.type === 'object' || field.type === 'array')) {
        this.onDragOverByPath(event, path);
        return;
      }
      // Si no es objeto/array, no hacer nada
      return;
    }

    // Si estamos reordenando campos
    if (!this.draggedFieldPath) return;

    // Solo permitir reordenamiento dentro del mismo padre
    if (!this.isSameParent(this.draggedFieldPath, path)) return;

    event.preventDefault();
    if (event.dataTransfer) {
      event.dataTransfer.dropEffect = 'move';
    }
    this.dragOverPath = path;
  }

  onFieldDropByPath(event: DragEvent, dropPath: number[]) {
    event.preventDefault();
    event.stopPropagation();

    // Si estamos arrastrando una columna, delegar a column drop
    if (this.draggedColumn && !this.draggedFieldPath) {
      const field = this.getFieldByPath(dropPath);
      if (field && (field.type === 'object' || field.type === 'array')) {
        this.onDropByPath(event, dropPath);
      }
      return;
    }

    // Si estamos reordenando campos
    if (!this.draggedFieldPath || !this.isSameParent(this.draggedFieldPath, dropPath)) {
      this.draggedFieldPath = null;
      this.dragOverPath = null;
      return;
    }

    // Reordenar campos usando paths
    this.reorderFieldByPath(this.draggedFieldPath, dropPath);

    this.draggedFieldPath = null;
    this.dragOverPath = null;
  }

  // Helper: Get field by path
  private getFieldByPath(path: number[]): JsonField | null {
    let current: any = this.rootFields();

    for (let i = 0; i < path.length; i++) {
      const index = path[i];
      if (Array.isArray(current) && current[index]) {
        if (i === path.length - 1) {
          return current[index];
        } else {
          current = current[index].children;
        }
      } else {
        return null;
      }
    }
    return null;
  }

  // Helper: Check if two paths have the same parent
  private isSameParent(path1: number[], path2: number[]): boolean {
    if (path1.length !== path2.length) return false;
    if (path1.length === 1) return true; // Both at root level

    // Compare all indices except the last one
    for (let i = 0; i < path1.length - 1; i++) {
      if (path1[i] !== path2[i]) return false;
    }
    return true;
  }

  // Helper: Reorder field from one path to another
  private reorderFieldByPath(fromPath: number[], toPath: number[]) {
    if (fromPath.length === 1) {
      // Reorder at root level
      const fromIndex = fromPath[0];
      const toIndex = toPath[0];
      this.rootFields.update(fields => {
        const updated = [...fields];
        const draggedField = updated[fromIndex];
        updated.splice(fromIndex, 1);
        const newIndex = fromIndex < toIndex ? toIndex - 1 : toIndex;
        updated.splice(newIndex, 0, draggedField);
        return updated;
      });
    } else {
      // Reorder at nested level
      const parentPath = fromPath.slice(0, -1);
      const fromIndex = fromPath[fromPath.length - 1];
      const toIndex = toPath[toPath.length - 1];

      this.rootFields.update(fields => {
        const updated = [...fields];
        this.navigateAndUpdate(updated, parentPath, (parent) => {
          if (parent.children) {
            const draggedField = parent.children[fromIndex];
            parent.children.splice(fromIndex, 1);
            const newIndex = fromIndex < toIndex ? toIndex - 1 : toIndex;
            parent.children.splice(newIndex, 0, draggedField);
          }
        });
        return updated;
      });
    }
  }

  onDropRoot(event: DragEvent) {
    event.preventDefault();
    event.stopPropagation();

    if (!this.draggedColumn) return;

    const { tableName, columnName } = this.draggedColumn;
    const fullColumnName = `${tableName}.${columnName}`;

    const newField: JsonField = {
      key: columnName.toLowerCase(),
      value: fullColumnName,
      type: 'column',
      originalColumn: fullColumnName
    };

    // Add to root level
    this.rootFields.update(fields => [...fields, newField]);

    this.draggedColumn = null;
    this.dragOverIndex = null;
    this.dragOverChildIndex = null;
  }

  onDrop(event: DragEvent, parentIndex: number, childIndex?: number) {
    event.preventDefault();
    event.stopPropagation();

    if (!this.draggedColumn) return;

    const { tableName, columnName } = this.draggedColumn;
    const fullColumnName = `${tableName}.${columnName}`;

    const newField: JsonField = {
      key: columnName.toLowerCase(),
      value: fullColumnName,
      type: 'column',
      originalColumn: fullColumnName
    };

    if (childIndex !== undefined) {
      // Add to nested child
      this.rootFields.update(fields => {
        const updated = [...fields];
        if (updated[parentIndex].children && updated[parentIndex].children![childIndex]) {
          if (!updated[parentIndex].children![childIndex].children) {
            updated[parentIndex].children![childIndex].children = [];
          }
          updated[parentIndex].children![childIndex].children!.push(newField);
        }
        return updated;
      });
    } else {
      // Add to parent
      this.rootFields.update(fields => {
        const updated = [...fields];
        if (!updated[parentIndex].children) {
          updated[parentIndex].children = [];
        }
        updated[parentIndex].children!.push(newField);
        return updated;
      });
    }

    this.draggedColumn = null;
    this.dragOverIndex = null;
    this.dragOverChildIndex = null;
  }

  // ============================================
  // DEEP NESTED FIELD METHODS (for any depth)
  // ============================================

  // Update field at any depth using path array [parentIdx, childIdx, grandchildIdx, ...]
  updateDeepFieldKey(path: number[], key: string) {
    this.rootFields.update(fields => {
      const updated = [...fields];
      this.navigateAndUpdate(updated, path, (field) => {
        field.key = key;
      });
      return updated;
    });
  }

  updateDeepFieldValue(path: number[], value: string) {
    this.rootFields.update(fields => {
      const updated = [...fields];
      this.navigateAndUpdate(updated, path, (field) => {
        field.value = value;
      });
      return updated;
    });
  }

  updateDeepFieldType(path: number[], type: JsonField['type']) {
    this.rootFields.update(fields => {
      const updated = [...fields];
      this.navigateAndUpdate(updated, path, (field) => {
        field.type = type;
        // Reset value based on type
        if (type === 'null') {
          field.value = 'null';
        } else if (type === 'expression') {
          field.value = 'expr:';
        } else if (type === 'column' && field.originalColumn) {
          field.value = field.originalColumn;
        }
      });
      return updated;
    });
  }

  removeDeepField(path: number[]) {
    this.rootFields.update(fields => {
      const updated = [...fields];
      const parentPath = path.slice(0, -1);
      const indexToRemove = path[path.length - 1];

      if (parentPath.length === 0) {
        // Removing from root
        updated.splice(indexToRemove, 1);
      } else {
        // Navigate to parent and remove child
        this.navigateAndUpdate(updated, parentPath, (parent) => {
          if (parent.children) {
            parent.children.splice(indexToRemove, 1);
          }
        });
      }
      return updated;
    });
  }

  addDeepNestedObject(path: number[]) {
    const newField: JsonField = {
      key: '',
      value: '',
      type: 'object',
      children: [],
      level: 0
    };

    this.rootFields.update(fields => {
      const updated = [...fields];
      this.navigateAndUpdate(updated, path, (parent) => {
        if (!parent.children) {
          parent.children = [];
        }
        parent.children.push(newField);
      });
      return updated;
    });
  }

  addDeepNestedArray(path: number[]) {
    const newField: JsonField = {
      key: '',
      value: '',
      type: 'array',
      children: [],
      level: 0
    };

    this.rootFields.update(fields => {
      const updated = [...fields];
      this.navigateAndUpdate(updated, path, (parent) => {
        if (!parent.children) {
          parent.children = [];
        }
        parent.children.push(newField);
      });
      return updated;
    });
  }

  // Helper to navigate to a field at any depth and apply an update
  private navigateAndUpdate(fields: JsonField[], path: number[], updateFn: (field: JsonField) => void) {
    let current: JsonField | JsonField[] | undefined = fields;

    for (let i = 0; i < path.length; i++) {
        const index = path[i];
        if (current && Array.isArray(current) && current[index]) {
            if (i === path.length - 1) {
                // Last index - apply update
                updateFn(current[index]);
            } else {
                // Navigate deeper
                if (!current[index].children) {
                  current[index].children = [];
                }
                current = current[index].children;
            }
        } else {
            // Path is invalid, stop iteration
            return;
        }
    }
}

  // Field reordering handlers
  onFieldDragStart(event: DragEvent, index: number) {
    this.draggedFieldIndex = index;
    if (event.dataTransfer) {
      event.dataTransfer.effectAllowed = 'move';
      event.dataTransfer.setData('text/plain', index.toString());
    }
    (event.target as HTMLElement).classList.add('dragging');
  }

  onFieldDragEnd(event: DragEvent) {
    this.draggedFieldIndex = null;
    this.dragOverIndex = null;
    (event.target as HTMLElement).classList.remove('dragging');
  }

  onFieldDragOver(event: DragEvent, index: number) {
    // Si estamos arrastrando una columna desde el sidebar, delegar a onDragOver
    if (this.draggedColumn && !this.draggedFieldIndex) {
      const field = this.rootFields()[index];
      if (field && (field.type === 'object' || field.type === 'array')) {
        this.onDragOver(event, index);
      }
      return;
    }

    // Si estamos reordenando campos
    if (this.draggedFieldIndex === null) return;

    event.preventDefault();
    if (event.dataTransfer) {
      event.dataTransfer.dropEffect = 'move';
    }
    this.dragOverIndex = index;
  }

  onFieldDrop(event: DragEvent, dropIndex: number) {
    event.preventDefault();
    event.stopPropagation();

    // Si estamos arrastrando una columna desde el sidebar, delegar a onDrop
    if (this.draggedColumn && !this.draggedFieldIndex) {
      const field = this.rootFields()[dropIndex];
      if (field && (field.type === 'object' || field.type === 'array')) {
        this.onDrop(event, dropIndex);
      }
      return;
    }

    // Si estamos reordenando campos
    if (this.draggedFieldIndex === null || this.draggedFieldIndex === dropIndex) {
      this.draggedFieldIndex = null;
      this.dragOverIndex = null;
      return;
    }

    // Reorder fields
    this.rootFields.update(fields => {
      const updated = [...fields];
      const draggedField = updated[this.draggedFieldIndex!];
      updated.splice(this.draggedFieldIndex!, 1);

      // Adjust drop index if needed
      const newIndex = this.draggedFieldIndex! < dropIndex ? dropIndex - 1 : dropIndex;
      updated.splice(newIndex, 0, draggedField);

      return updated;
    });

    this.draggedFieldIndex = null;
    this.dragOverIndex = null;
  }

  // Handle actions from recursive child component
  handleFieldAction(action: FieldAction) {
    switch (action.type) {
      case 'updateKey':
        this.updateDeepFieldKey(action.path, action.value);
        break;
      case 'updateValue':
        this.updateDeepFieldValue(action.path, action.value);
        break;
      case 'updateType':
        this.updateDeepFieldType(action.path, action.value);
        break;
      case 'remove':
        this.removeDeepField(action.path);
        break;
      case 'addObject':
        this.addDeepNestedObject(action.path);
        break;
      case 'addArray':
        this.addDeepNestedArray(action.path);
        break;
      case 'dragStart':
        if (action.event) this.onFieldDragStartByPath(action.event, action.path);
        break;
      case 'dragEnd':
        if (action.event) this.onFieldDragEndByPath(action.event);
        break;
      case 'dragOver':
        if (action.event) this.onFieldDragOverByPath(action.event, action.path);
        break;
      case 'drop':
        if (action.event) this.onFieldDropByPath(action.event, action.path);
        break;
      case 'dragLeave':
        if (action.event) this.onDragLeave(action.event);
        break;
    }
  }
}
