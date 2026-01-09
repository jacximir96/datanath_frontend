import { Component, inject, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import { MatListModule } from '@angular/material/list';
import { MatExpansionModule } from '@angular/material/expansion';
import { ConfigService } from '../../services/config.service';
import { OrchestratorService } from '../../services/orchestrator.service';
import { SaveConfigDialogComponent } from '../save-config-dialog/save-config-dialog';
import { SendProgressDialogComponent, SendProgressData } from '../send-progress-dialog/send-progress-dialog';
import { Origin, EntityGroup } from '../../models/config.model';

@Component({
  selector: 'app-summary-step',
  standalone: true,
  imports: [
    CommonModule, FormsModule, MatCardModule, MatButtonModule, MatIconModule,
    MatSnackBarModule, MatFormFieldModule, MatInputModule, MatProgressSpinnerModule, MatDialogModule,
    MatListModule, MatExpansionModule
  ],
  templateUrl: './summary-step.html',
  styleUrl: './summary-step.css',
})
export class SummaryStepComponent implements OnInit {
  protected configService = inject(ConfigService);
  protected orchestratorService = inject(OrchestratorService);
  private snackBar = inject(MatSnackBar);
  private dialog = inject(MatDialog);

  private readonly ORCHESTRATOR_USER = 'usr_orquestador';
  private readonly ORCHESTRATOR_PASSWORD = 'usr_orquestador';

  isSending = false;
  objectKeys = Object.keys;

  ngOnInit(): void {
    // Temporalmente deshabilitado para evitar que se quede cargando
    // if (!this.orchestratorService.isTokenValid()) {
    //   this.autoLogin();
    // }
  }

  get jsonOutput(): string {
    return this.configService.exportJSON();
  }

  get groupedOrigins(): { [key: string]: Origin[] } {
    const principalScenario = this.configService.scenarios()[0];
    if (!principalScenario) {
      return { 'Orígenes': this.configService.config().origins };
    }

    const groups: { [key: string]: Origin[] } = {
      [principalScenario.name]: []
    };
    const allOrigins = this.configService.config().origins;
    const usedRepos = new Set<string>();

    // Add assigned origins to the principal group
    principalScenario.assignments.forEach((repoName, entityName) => {
      const origin = allOrigins.find(o => o.repository === repoName);
      if (origin && !usedRepos.has(repoName)) {
        groups[principalScenario.name].push(origin);
        usedRepos.add(repoName);
      }
    });

    // Optionally, add unassigned origins to a separate group for visibility
    const unassignedOrigins = allOrigins.filter(o => !usedRepos.has(o.repository));
    if (unassignedOrigins.length > 0) {
      groups['Orígenes no usados'] = unassignedOrigins;
    }
    
    return groups;
  }

  get entityGroups(): EntityGroup[] {
    return this.configService.config().entityGroups;
  }

  private autoLogin(): void {
    this.orchestratorService.login(this.ORCHESTRATOR_USER, this.ORCHESTRATOR_PASSWORD).subscribe({
      next: (response) => {
        if (response.error) {
          console.warn('Error en autenticación automática:', response.mensaje);
        }
      },
      error: (error) => {
        console.warn('No se pudo conectar al orquestador:', error);
      }
    });
  }

  sendToOrchestrator(): void {
    if (!this.orchestratorService.isTokenValid()) {
      this.isSending = true;
      this.orchestratorService.login(this.ORCHESTRATOR_USER, this.ORCHESTRATOR_PASSWORD).subscribe({
        next: (response) => {
          if (!response.error) {
            this.performSend();
          } else {
            this.isSending = false;
            this.snackBar.open('Error de autenticación: ' + response.mensaje, 'Cerrar', { duration: 5000 });
          }
        },
        error: (error) => {
          this.isSending = false;
          this.snackBar.open('No se pudo conectar al orquestador. Verifique que esté corriendo.', 'Cerrar', { duration: 5000 });
        }
      });
    } else {
      this.performSend();
    }
  }

  private performSend(): void {
    const exportedJson = this.configService.exportJSON();

    // Detectar si hay múltiples requerimientos (separados por ---REQUIREMENT---)
    const hasMultipleRequirements = exportedJson.includes('---REQUIREMENT---');

    if (hasMultipleRequirements) {
      // Manejar envío múltiple con diálogo de progreso
      this.performMultipleSend(exportedJson);
    } else {
      // Manejar envío simple (comportamiento original)
      this.performSingleSend(exportedJson);
    }
  }

  private performSingleSend(exportedJson: string): void {
    const config = JSON.parse(exportedJson);
    this.isSending = true;

    this.orchestratorService.sendToOrchestrator(config).subscribe({
      next: (response) => {
        this.isSending = false;
        this.snackBar.open('Configuración enviada exitosamente', 'Cerrar', { duration: 3000 });
        this.promptSaveConfiguration();
      },
      error: (error) => {
        this.isSending = false;
        const errorMsg = error.error?.mensaje || error.message || 'Error desconocido';
        this.snackBar.open('Error al enviar: ' + errorMsg, 'Cerrar', { duration: 5000 });
      }
    });
  }

  private async performMultipleSend(exportedJson: string): Promise<void> {
    this.isSending = true;

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
          // Callback de progreso
          progressData.current = current;
          progressData.total = total;
        }
      );

      // Actualizar diálogo con resultados
      progressData.isComplete = true;
      progressData.results = results;
      dialogRef.disableClose = false;

      this.isSending = false;

      // Verificar si todos fueron exitosos
      const allSuccess = results.every(r => r.success);
      const successCount = results.filter(r => r.success).length;

      if (allSuccess) {
        this.snackBar.open(
          `✅ Todos los requerimientos enviados exitosamente (${successCount}/${results.length})`,
          'Cerrar',
          { duration: 5000 }
        );
        this.promptSaveConfiguration();
      } else {
        this.snackBar.open(
          `⚠️ ${successCount} de ${results.length} requerimientos enviados. Revisa los detalles.`,
          'Cerrar',
          { duration: 5000 }
        );
      }
    } catch (error: any) {
      this.isSending = false;
      progressData.isComplete = true;
      dialogRef.disableClose = false;

      this.snackBar.open(
        'Error al enviar requerimientos: ' + (error.message || 'Error desconocido'),
        'Cerrar',
        { duration: 5000 }
      );
    }
  }

  private promptSaveConfiguration(): void {
    const currentLoadedId = this.configService.currentLoadedConfigId();
    const isUpdate = currentLoadedId !== null;

    // Si es actualización, obtener el nombre actual
    let currentName = '';
    if (isUpdate) {
      const currentConfig = this.configService.savedConfigs().find(c => c.id === currentLoadedId);
      currentName = currentConfig?.name || '';
    }

    const dialogRef = this.dialog.open(SaveConfigDialogComponent, {
      width: '500px',
      disableClose: false,
      data: {
        isUpdate,
        currentName
      }
    });

    dialogRef.afterClosed().subscribe(configName => {
      if (configName) {
        if (isUpdate && currentLoadedId) {
          // Actualizar configuración existente
          const updated = this.configService.updateConfiguration(currentLoadedId, configName, '');
          if (updated) {
            this.snackBar.open('Configuración actualizada exitosamente', 'Cerrar', { duration: 3000 });
          } else {
            this.snackBar.open('Error al actualizar configuración', 'Cerrar', { duration: 3000 });
          }
        } else {
          // Guardar nueva configuración
          this.configService.saveConfiguration(configName, '');
          this.snackBar.open('Configuración guardada exitosamente', 'Cerrar', { duration: 3000 });
        }
      }
    });
  }

  copyToClipboard() {
    navigator.clipboard.writeText(this.jsonOutput).then(() => {
      this.snackBar.open('JSON copiado al portapapeles', 'Cerrar', { duration: 3000 });
    });
  }

  downloadJSON() {
    const timestamp = new Date().getTime();
    const blob = new Blob([this.jsonOutput], { type: 'application/json' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `config_${timestamp}.json`;
    a.click();
    window.URL.revokeObjectURL(url);
    this.snackBar.open('Configuración descargada', 'Cerrar', { duration: 3000 });
  }
}

