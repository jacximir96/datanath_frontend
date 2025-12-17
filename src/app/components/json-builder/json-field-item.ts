import { Component, input, output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatChipsModule } from '@angular/material/chips';
import { MatTooltipModule } from '@angular/material/tooltip';
import { JsonField } from './json-builder';

export interface FieldAction {
  type: 'updateKey' | 'updateValue' | 'updateType' | 'remove' | 'addObject' | 'addArray' | 'dragStart' | 'dragEnd' | 'dragOver' | 'drop' | 'dragLeave';
  path: number[];
  value?: any;
  event?: DragEvent;
}

@Component({
  selector: 'app-json-field-item',
  standalone: true,
  imports: [
    CommonModule, FormsModule, MatCardModule, MatButtonModule,
    MatIconModule, MatInputModule, MatFormFieldModule,
    MatChipsModule, MatTooltipModule
  ],
  templateUrl: './json-field-item.html',
  styleUrl: './json-builder.css',
})
export class JsonFieldItemComponent {
  field = input.required<JsonField>();
  path = input.required<number[]>();
  dragOverPath = input<number[] | null>(null);
  draggedColumn = input<{ tableName: string, columnName: string } | null>(null);
  draggedFieldPath = input<number[] | null>(null);

  action = output<FieldAction>();

  getDragOverClass(): 'drag-over-column' | 'drag-over-reorder' | '' {
    const currentPath = this.path();
    const dragOver = this.dragOverPath();

    if (!dragOver || dragOver.length !== currentPath.length) {
      return '';
    }

    const pathMatches = currentPath.every((val, idx) => val === dragOver[idx]);
    if (!pathMatches) return '';

    // Check which operation is happening
    if (this.draggedColumn() && !this.draggedFieldPath()) {
      return 'drag-over-column'; // Adding column from sidebar
    } else if (this.draggedFieldPath()) {
      return 'drag-over-reorder'; // Reordering field
    }
    return '';
  }

  updateKey(key: string) {
    this.action.emit({ type: 'updateKey', path: this.path(), value: key });
  }

  updateValue(value: string) {
    this.action.emit({ type: 'updateValue', path: this.path(), value });
  }

  updateType(type: JsonField['type']) {
    this.action.emit({ type: 'updateType', path: this.path(), value: type });
  }

  remove() {
    this.action.emit({ type: 'remove', path: this.path() });
  }

  addObject() {
    this.action.emit({ type: 'addObject', path: this.path() });
  }

  addArray() {
    this.action.emit({ type: 'addArray', path: this.path() });
  }

  onDragStart(event: DragEvent) {
    this.action.emit({ type: 'dragStart', path: this.path(), event });
  }

  onDragEnd(event: DragEvent) {
    this.action.emit({ type: 'dragEnd', path: this.path(), event });
  }

  onDragOver(event: DragEvent) {
    this.action.emit({ type: 'dragOver', path: this.path(), event });
  }

  onDrop(event: DragEvent) {
    this.action.emit({ type: 'drop', path: this.path(), event });
  }

  onDragLeave(event: DragEvent) {
    this.action.emit({ type: 'dragLeave', path: this.path(), event });
  }

  // Handle child actions by re-emitting them up
  handleChildAction(action: FieldAction) {
    this.action.emit(action);
  }
}
