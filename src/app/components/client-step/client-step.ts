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
  selectedClientId = '';
  showManualInput = false;

  constructor() {
    this.clientForm = this.fb.group({
      clientName: ['', Validators.required]
    });
  }

  ngOnInit() {
    this.configService.loadClientConfigsFromLocalStorage();
    // Si ya hay un cliente en la config, actualizar el formulario
    const currentClient = this.configService.config().client;
    if (currentClient) {
      this.clientForm.patchValue({ clientName: currentClient });
      this.clientForm.markAsTouched();
      this.showManualInput = true;
    }

    // Suscribirse a cambios en la configuración para mantener el form sincronizado
    this.updateFormValidity();
  }

  updateFormValidity() {
    const clientName = this.configService.config().client;
    if (clientName) {
      this.clientForm.patchValue({ clientName: clientName }, { emitEvent: false });
      this.clientForm.markAsTouched();
    }
  }

  get clients(): ClientConfig[] {
    return this.configService.clientConfigs();
  }

  get clientName(): string {
    return this.configService.config().client;
  }

  selectClient() {
    if (this.selectedClientId) {
      this.configService.loadClientConfig(this.selectedClientId);
      this.updateFormValidity();
      this.selectedClientId = '';
    }
  }

  setManualClient() {
    const clientName = this.clientForm.get('clientName')?.value;
    if (clientName?.trim()) {
      this.configService.updateClient(clientName.trim());
    }
  }

  toggleManualInput() {
    this.showManualInput = !this.showManualInput;
    if (this.showManualInput) {
      this.clientForm.patchValue({ clientName: this.clientName });
    }
  }

  changeClient() {
    this.configService.updateClient('');
    this.configService.updateOrigins([]);
    this.showManualInput = false;
    this.clientForm.reset();
    this.selectedClientId = '';
  }

  isValid(): boolean {
    return this.clientForm.valid && this.configService.config().client !== '';
  }
}
