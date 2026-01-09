import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatDialogModule, MatDialogRef, MAT_DIALOG_DATA } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';

export interface SaveConfigDialogData {
  isUpdate?: boolean;
  currentName?: string;
}

@Component({
  selector: 'app-save-config-dialog',
  standalone: true,
  imports: [
    CommonModule, FormsModule, MatDialogModule, MatFormFieldModule,
    MatInputModule, MatButtonModule, MatIconModule
  ],
  templateUrl: './save-config-dialog.html',
  styleUrl: './save-config-dialog.css',
})
export class SaveConfigDialogComponent {
  private dialogRef = inject(MatDialogRef<SaveConfigDialogComponent>);
  protected data = inject<SaveConfigDialogData>(MAT_DIALOG_DATA, { optional: true });

  configName = this.data?.currentName || '';
  isUpdate = this.data?.isUpdate || false;

  onSave(): void {
    if (this.configName.trim()) {
      this.dialogRef.close(this.configName.trim());
    }
  }

  onCancel(): void {
    this.dialogRef.close();
  }
}
