import { Component, Inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MAT_DIALOG_DATA, MatDialogRef, MatDialogModule } from '@angular/material/dialog';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatListModule } from '@angular/material/list';

export interface SendProgressData {
  current: number;
  total: number;
  results?: Array<{
    index: number;
    groupId: string;
    clientName: string;
    success: boolean;
    error?: any;
  }>;
  isComplete?: boolean;
}

@Component({
  selector: 'app-send-progress-dialog',
  standalone: true,
  imports: [
    CommonModule,
    MatDialogModule,
    MatProgressSpinnerModule,
    MatIconModule,
    MatButtonModule,
    MatListModule
  ],
  template: `
    <h2 mat-dialog-title>
      <mat-icon>send</mat-icon>
      Enviando requerimientos al orquestador
    </h2>
    <mat-dialog-content>
      @if (!data.isComplete) {
        <div class="progress-container">
          <mat-spinner diameter="50"></mat-spinner>
          <p class="progress-text">
            Enviando {{ data.current }} de {{ data.total }}...
          </p>
          <p class="progress-subtitle">
            Por favor espera, no cierres esta ventana.
          </p>
        </div>
      } @else {
        <div class="results-container">
          <h3>Resultados del envío:</h3>
          <mat-list>
            @for (result of data.results; track result.index) {
              <mat-list-item>
                <mat-icon matListItemIcon [color]="result.success ? 'primary' : 'warn'">
                  {{ result.success ? 'check_circle' : 'error' }}
                </mat-icon>
                <div matListItemTitle>
                  {{ result.groupId }} - {{ result.clientName }}
                </div>
                <div matListItemLine>
                  {{ result.success ? 'Enviado exitosamente' : 'Error: ' + (result.error?.message || 'Error desconocido') }}
                </div>
              </mat-list-item>
            }
          </mat-list>
        </div>
      }
    </mat-dialog-content>
    @if (data.isComplete) {
      <mat-dialog-actions align="end">
        <button mat-raised-button color="primary" (click)="close()">
          Cerrar
        </button>
      </mat-dialog-actions>
    }
  `,
  styles: [`
    .progress-container {
      display: flex;
      flex-direction: column;
      align-items: center;
      padding: 24px;
      gap: 16px;
    }

    .progress-text {
      font-size: 18px;
      font-weight: 500;
      margin: 0;
    }

    .progress-subtitle {
      font-size: 14px;
      color: #666;
      margin: 0;
    }

    .results-container {
      padding: 16px 0;
    }

    h3 {
      margin: 0 0 16px 0;
      font-size: 16px;
      font-weight: 500;
    }

    mat-list-item {
      margin-bottom: 8px;
    }
  `]
})
export class SendProgressDialogComponent {
  constructor(
    public dialogRef: MatDialogRef<SendProgressDialogComponent>,
    @Inject(MAT_DIALOG_DATA) public data: SendProgressData
  ) {
    // Prevent closing while sending
    if (!data.isComplete) {
      this.dialogRef.disableClose = true;
    }
  }

  close(): void {
    this.dialogRef.close();
  }
}
