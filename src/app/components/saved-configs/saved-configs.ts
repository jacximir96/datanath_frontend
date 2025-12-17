import { Component, inject, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatChipsModule } from '@angular/material/chips';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { ConfigService } from '../../services/config.service';
import { OrchestratorService } from '../../services/orchestrator.service';
import { SavedConfiguration } from '../../models/config.model';
import { Router } from '@angular/router';

@Component({
  selector: 'app-saved-configs',
  standalone: true,
  imports: [
    CommonModule, MatCardModule, MatButtonModule, MatIconModule,
    MatChipsModule, MatSnackBarModule, MatProgressSpinnerModule
  ],
  templateUrl: './saved-configs.html',
  styleUrl: './saved-configs.css',
})
export class SavedConfigsComponent implements OnInit {
  protected configService = inject(ConfigService);
  protected orchestratorService = inject(OrchestratorService);
  private snackBar = inject(MatSnackBar);
  private router = inject(Router);

  // Credenciales hardcoded (configuración interna)
  private readonly ORCHESTRATOR_USER = 'usr_orquestador';
  private readonly ORCHESTRATOR_PASSWORD = 'usr_orquestador';

  sendingConfigId: string | null = null;

  ngOnInit(): void {
    this.configService.loadSavedConfigsFromLocalStorage();

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
        if (response.error) {
          console.warn('Error en autenticación automática:', response.mensaje);
        }
      },
      error: (error) => {
        console.warn('No se pudo conectar al orquestador:', error);
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

    this.orchestratorService.sendToOrchestrator(savedConfig.config).subscribe({
      next: (response) => {
        this.sendingConfigId = null;
        this.configService.loadSavedConfiguration(savedConfig.id); // Actualiza lastUsed
        this.snackBar.open('Configuración ejecutada exitosamente', 'Cerrar', { duration: 3000 });
      },
      error: (error) => {
        this.sendingConfigId = null;
        const errorMsg = error.error?.mensaje || error.message || 'Error desconocido';
        this.snackBar.open('Error al ejecutar: ' + errorMsg, 'Cerrar', { duration: 5000 });
      }
    });
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
}
