import { Component, inject, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatChipsModule } from '@angular/material/chips';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import { ConfigService } from '../../services/config.service';
import { OrchestratorService } from '../../services/orchestrator.service';
import { SavedConfiguration } from '../../models/config.model';
import { Router } from '@angular/router';
import { SendProgressDialogComponent, SendProgressData } from '../send-progress-dialog/send-progress-dialog';

@Component({
  selector: 'app-saved-configs',
  standalone: true,
  imports: [
    CommonModule, MatCardModule, MatButtonModule, MatIconModule,
    MatChipsModule, MatSnackBarModule, MatProgressSpinnerModule, MatDialogModule
  ],
  templateUrl: './saved-configs.html',
  styleUrl: './saved-configs.css',
})
export class SavedConfigsComponent implements OnInit {
  protected configService = inject(ConfigService);
  protected orchestratorService = inject(OrchestratorService);
  private snackBar = inject(MatSnackBar);
  private router = inject(Router);
  private dialog = inject(MatDialog);

  // Credenciales hardcoded (configuración interna)
  private readonly ORCHESTRATOR_USER = 'usr_orquestador';
  private readonly ORCHESTRATOR_PASSWORD = 'usr_orquestador';

  sendingConfigId: string | null = null;
  previewConfigId: string | null = null;
  previewJsonData: string | null = null;

  ngOnInit(): void {
    this.configService.loadSavedConfigsFromGraphQL();

    // Temporalmente deshabilitado para evitar que se quede cargando
    // if (!this.orchestratorService.isTokenValid()) {
    //   this.autoLogin();
    // }
  }

  get savedConfigs(): SavedConfiguration[] {
    return this.configService.savedConfigs();
  }

  private autoLogin(): void {
    this.orchestratorService.login(this.ORCHESTRATOR_USER, this.ORCHESTRATOR_PASSWORD).subscribe({
      next: (response) => {
        // Autenticación automática silenciosa
      },
      error: (error) => {
        // Error de conexión silencioso
      }
    });
  }

  executeConfig(config: SavedConfiguration): void {
    // Si no hay token válido, intentar login primero
    if (!this.orchestratorService.isTokenValid()) {
      this.sendingConfigId = config.id;
      this.orchestratorService.login(this.ORCHESTRATOR_USER, this.ORCHESTRATOR_PASSWORD).subscribe({
        next: (response) => {
          if (!response.error) {
            // Login exitoso, ahora enviar
            this.performExecute(config);
          } else {
            this.sendingConfigId = null;
            this.snackBar.open('Error de autenticación: ' + response.mensaje, 'Cerrar', { duration: 5000 });
          }
        },
        error: (error) => {
          this.sendingConfigId = null;
          this.snackBar.open('No se pudo conectar al orquestador. Verifique que esté corriendo.', 'Cerrar', { duration: 5000 });
        }
      });
    } else {
      // Ya hay token válido, enviar directamente
      this.performExecute(config);
    }
  }

  private performExecute(savedConfig: SavedConfiguration): void {
    this.sendingConfigId = savedConfig.id;

    // Cargar la configuración guardada para exportarla correctamente
    this.configService.loadSavedConfiguration(savedConfig.id);

    // Exportar JSON usando el mismo método que summary-step
    const exportedJson = this.configService.exportJSON();

    // Detectar si hay múltiples requerimientos
    const hasMultipleRequirements = exportedJson.includes('---REQUIREMENT---');

    if (hasMultipleRequirements) {
      this.performMultipleSend(exportedJson, savedConfig);
    } else {
      this.performSingleSend(exportedJson, savedConfig);
    }
  }

  private performSingleSend(exportedJson: string, savedConfig: SavedConfiguration): void {
    const config = JSON.parse(exportedJson);

    this.orchestratorService.sendToOrchestrator(config).subscribe({
      next: (response) => {
        this.sendingConfigId = null;
        // Actualizar lastUsed (loadSavedConfiguration actualiza el lastUsed internamente)
        this.configService.loadSavedConfiguration(savedConfig.id);
        this.snackBar.open('Configuración ejecutada exitosamente', 'Cerrar', { duration: 3000 });
      },
      error: (error) => {
        this.sendingConfigId = null;
        const errorMsg = error.error?.mensaje || error.message || 'Error desconocido';
        this.snackBar.open('Error al ejecutar: ' + errorMsg, 'Cerrar', { duration: 5000 });
      }
    });
  }

  private async performMultipleSend(exportedJson: string, savedConfig: SavedConfiguration): Promise<void> {
    // Abrir diálogo de progreso
    const progressData: SendProgressData = {
      current: 0,
      total: exportedJson.split('---REQUIREMENT---').filter(s => s.trim().length > 0).length,
      isComplete: false
    };

    const dialogRef = this.dialog.open(SendProgressDialogComponent, {
      width: '500px',
      disableClose: true,
      data: progressData
    });

    try {
      // Enviar múltiples requerimientos
      const results = await this.orchestratorService.sendMultipleRequirements(
        exportedJson,
        (current: number, total: number) => {
          progressData.current = current;
          progressData.total = total;
        }
      );

      // Actualizar diálogo con resultados
      progressData.isComplete = true;
      progressData.results = results;
      dialogRef.disableClose = false;

      this.sendingConfigId = null;
      // Actualizar lastUsed (loadSavedConfiguration actualiza el lastUsed internamente)
      this.configService.loadSavedConfiguration(savedConfig.id);

      // Verificar si todos fueron exitosos
      const allSuccess = results.every(r => r.success);
      const successCount = results.filter(r => r.success).length;

      if (allSuccess) {
        this.snackBar.open(
          `✅ Todos los requerimientos enviados exitosamente (${successCount}/${results.length})`,
          'Cerrar',
          { duration: 5000 }
        );
      } else {
        this.snackBar.open(
          `⚠️ ${successCount} de ${results.length} requerimientos enviados. Revisa los detalles.`,
          'Cerrar',
          { duration: 5000 }
        );
      }
    } catch (error: any) {
      this.sendingConfigId = null;
      progressData.isComplete = true;
      dialogRef.disableClose = false;

      this.snackBar.open(
        'Error al enviar requerimientos: ' + (error.message || 'Error desconocido'),
        'Cerrar',
        { duration: 5000 }
      );
    }
  }

  loadConfig(config: SavedConfiguration): void {
    this.configService.loadSavedConfiguration(config.id);
    this.snackBar.open('Configuración cargada en el constructor', 'Cerrar', { duration: 3000 });
    // Navegar al tab de configuración
    // Como estamos usando tabs, simplemente informamos al usuario
  }

  deleteConfig(config: SavedConfiguration): void {
    if (confirm(`¿Está seguro de que desea eliminar la configuración "${config.name}"?`)) {
      this.configService.deleteSavedConfiguration(config.id);
      this.snackBar.open('Configuración eliminada', 'Cerrar', { duration: 3000 });
    }
  }

  formatDate(dateString: string): string {
    const date = new Date(dateString);
    return date.toLocaleString('es-ES', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit'
    });
  }

  isSending(configId: string): boolean {
    return this.sendingConfigId === configId;
  }

  previewJson(config: SavedConfiguration): void {
    // Cargar temporalmente la configuración para exportarla
    this.configService.loadSavedConfiguration(config.id);

    // Exportar JSON
    const exportedJson = this.configService.exportJSON();

    // Mostrar preview
    this.previewConfigId = config.id;
    this.previewJsonData = exportedJson;
  }

  closePreview(): void {
    this.previewConfigId = null;
    this.previewJsonData = null;
  }
}
