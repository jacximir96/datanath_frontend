import { Component, inject, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
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
    CommonModule, FormsModule, MatFormFieldModule, MatInputModule,
    MatCardModule, MatSelectModule, MatButtonModule, MatIconModule
  ],
  templateUrl: './client-step.html',
  styleUrl: './client-step.css',
})
export class ClientStepComponent implements OnInit {
  protected configService = inject(ConfigService);

  selectedClientIds: string[] = [];

  ngOnInit() {
    this.configService.loadClientConfigsFromGraphQL();
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
      this.selectedClientIds = [];
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
    this.selectedClientIds = [];
  }

  isValid(): boolean {
    return this.configService.config().clients.length > 0;
  }
}
