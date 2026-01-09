import { Component, inject, signal, OnInit, ViewChild } from '@angular/core';
import { FormsModule, NgForm } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { MatCardModule } from '@angular/material/card';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatExpansionModule } from '@angular/material/expansion';
import { MatSelectModule } from '@angular/material/select';
import { ConfigService } from '../../services/config.service';
import { Origin, ClientConfig } from '../../models/config.model';

@Component({
  selector: 'app-origins-step',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    MatCardModule,
    MatFormFieldModule,
    MatInputModule,
    MatButtonModule,
    MatIconModule,
    MatExpansionModule,
    MatSelectModule
  ],
  templateUrl: './origins-step.html',
  styleUrl: './origins-step.css',
})
export class OriginsStepComponent implements OnInit {
  protected configService = inject(ConfigService);

  @ViewChild('originForm') originForm?: NgForm;

  newOrigin = signal<Origin>({
    servidor: '',
    puerto: '1433',
    user: '',
    password: '',
    repository: '',
    adapter: 'SqlServerSP'
  });

  adapters = ['SqlServerSP', 'MySQL', 'PostgreSQL', 'Oracle', 'SqlServerTrust', 'SqlServer', 'MongoLocal', 'MongoSrv'];
  selectedClientId = '';
  showManualAdd = false;

  ngOnInit() {
    this.configService.loadClientConfigsFromLocalStorage();
  }

  get origins(): Origin[] {
    return this.configService.config().origins;
  }

  get clientName(): string {
    const clients = this.configService.config().clients;
    return clients && clients.length > 0 ? clients.join(', ') : '';
  }

  get clients(): ClientConfig[] {
    return this.configService.clientConfigs();
  }

  loadClientStores() {
    if (this.selectedClientId) {
      this.configService.loadClientConfig(this.selectedClientId);
      this.selectedClientId = '';
    }
  }

  addOrigin() {
    const origin = this.newOrigin();
    if (origin.servidor && origin.user && origin.repository) {
      this.configService.addOrigin({ ...origin });
      // Resetear el formulario primero
      if (this.originForm) {
        this.originForm.resetForm();
      }
      // Luego resetear los valores
      this.resetNewOrigin();
    }
  }

  removeOrigin(index: number) {
    this.configService.removeOrigin(index);
  }

  resetNewOrigin() {
    this.newOrigin.set({
      servidor: '',
      puerto: '1433',
      user: '',
      password: '',
      repository: '',
      adapter: 'SqlServerSP'
    });
  }

  toggleManualAdd() {
    this.showManualAdd = !this.showManualAdd;
  }

  isOriginFormValid(): boolean {
    const origin = this.newOrigin();
    return !!(origin.servidor && origin.user && origin.password &&
              origin.repository && origin.adapter);
  }

  isValid(): boolean {
    return this.configService.config().origins.length > 0;
  }
}
