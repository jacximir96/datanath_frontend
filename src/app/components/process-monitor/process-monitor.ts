import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatCardModule } from '@angular/material/card';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatChipsModule } from '@angular/material/chips';
import { MatExpansionModule } from '@angular/material/expansion';
import { OrchestratorService, ProcessStatus } from '../../services/orchestrator.service';

@Component({
  selector: 'app-process-monitor',
  standalone: true,
  imports: [
    CommonModule,
    MatCardModule,
    MatIconModule,
    MatButtonModule,
    MatChipsModule,
    MatExpansionModule
  ],
  templateUrl: './process-monitor.html',
  styleUrl: './process-monitor.css',
})
export class ProcessMonitorComponent {
  orchestratorService = inject(OrchestratorService);

  get processes(): ProcessStatus[] {
    return this.orchestratorService.processes();
  }

  getStatusIcon(status: ProcessStatus['status']): string {
    switch (status) {
      case 'pending':
        return 'schedule';
      case 'processing':
        return 'sync';
      case 'success':
        return 'check_circle';
      case 'error':
        return 'error';
      default:
        return 'help';
    }
  }

  getStatusColor(status: ProcessStatus['status']): string {
    switch (status) {
      case 'pending':
        return 'primary';
      case 'processing':
        return 'accent';
      case 'success':
        return 'primary';
      case 'error':
        return 'warn';
      default:
        return '';
    }
  }

  getStatusClass(status: ProcessStatus['status']): string {
    return `status-${status}`;
  }

  removeProcess(id: string): void {
    this.orchestratorService.removeProcess(id);
  }

  clearAll(): void {
    this.orchestratorService.clearProcesses();
  }

  formatTimestamp(date: Date): string {
    return new Date(date).toLocaleString('es-ES', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit'
    });
  }
}
