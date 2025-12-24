import { Component, inject, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators, FormsModule } from '@angular/forms';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatCardModule } from '@angular/material/card';
import { MatSelectModule } from '@angular/material/select';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { ConfigService } from '../../services/config.service';
import { ClientConfig } from '../../models/config.model';

@Component({
  selector: 'app-client-step',
  standalone: true,
  imports: [
    CommonModule, ReactiveFormsModule, FormsModule, MatFormFieldModule, MatInputModule,
    MatCardModule, MatSelectModule, MatButtonModule, MatIconModule
  ],
  templateUrl: './client-step.html',
  styleUrl: './client-step.css',
})
export class ClientStepComponent implements OnInit {
  protected configService = inject(ConfigService);
  private fb = inject(FormBuilder);

  clientForm: FormGroup;
  selectedClientIds: string[] = []; // Changed to array for multi-select
  showManualInput = false;

  constructor() {
    this.clientForm = this.fb.group({
      clientName: ['', Validators.required]
    });
  }

  ngOnInit() {
    this.configService.loadClientConfigsFromLocalStorage();
    // Si ya hay clientes en la config, actualizar el formulario
    const currentClients = this.configService.config().clients;
    if (currentClients && currentClients.length > 0) {
      // No need to patch form for multiple clients display
      this.clientForm.markAsTouched();
    }

    // Suscribirse a cambios en la configuración para mantener el form sincronizado
    this.updateFormValidity();
  }

  updateFormValidity() {
    const clients = this.configService.config().clients;
    if (clients && clients.length > 0) {
      this.clientForm.markAsTouched();
    }
  }

  get clients(): ClientConfig[] {
    return this.configService.clientConfigs();
  }

  get selectedClients(): string[] {
    return this.configService.config().clients;
  }

  get hasClients(): boolean {
    return this.configService.config().clients.length > 0;
  }

  selectClients() {
    if (this.selectedClientIds && this.selectedClientIds.length > 0) {
      this.selectedClientIds.forEach(id => {
        this.configService.loadClientConfig(id);
      });
      this.updateFormValidity();
      this.selectedClientIds = [];
    }
  }

  setManualClient() {
    const clientName = this.clientForm.get('clientName')?.value;
    if (clientName?.trim()) {
      this.configService.addClient(clientName.trim());
      this.clientForm.reset();
      this.showManualInput = false;
    }
  }

  toggleManualInput() {
    this.showManualInput = !this.showManualInput;
    if (this.showManualInput) {
      this.clientForm.reset();
    }
  }

  removeClient(clientName: string) {
    this.configService.removeClient(clientName);
    // Optionally clear origins if no more clients
    if (this.configService.config().clients.length === 0) {
      this.configService.updateOrigins([]);
    }
  }

  clearAllClients() {
    this.configService.updateClients([]);
    this.configService.updateOrigins([]);
    this.showManualInput = false;
    this.clientForm.reset();
    this.selectedClientIds = [];
  }

  isValid(): boolean {
    return this.configService.config().clients.length > 0;
  }
}
