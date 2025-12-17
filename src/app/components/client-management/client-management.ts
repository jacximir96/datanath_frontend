import { Component, inject, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatCardModule } from '@angular/material/card';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatExpansionModule } from '@angular/material/expansion';
import { MatSelectModule } from '@angular/material/select';
import { MatTableModule } from '@angular/material/table';
import { MatDialogModule, MatDialog } from '@angular/material/dialog';
import { ConfigService } from '../../services/config.service';
import { ClientConfig, Origin } from '../../models/config.model';

@Component({
  selector: 'app-client-management',
  standalone: true,
  imports: [
    CommonModule, FormsModule, MatCardModule, MatFormFieldModule,
    MatInputModule, MatButtonModule, MatIconModule, MatExpansionModule,
    MatSelectModule, MatTableModule, MatDialogModule
  ],
  templateUrl: './client-management.html',
  styleUrl: './client-management.css',
})
export class ClientManagementComponent implements OnInit {
  protected configService = inject(ConfigService);

  editingClient: ClientConfig | null = null;
  showForm = false;

  clientForm = signal<ClientConfig>({
    id: '',
    name: '',
    description: '',
    stores: []
  });

  newStore = signal<Origin>({
    servidor: '',
    puerto: '1433',
    user: '',
    password: '',
    repository: '',
    adapter: 'SqlServerSP'
  });

  editingStoreIndex: number | null = null;

  adapters = ['SqlServerSP', 'MySQL', 'PostgreSQL', 'Oracle', 'SqlServerTrust', 'SqlServer', 'MongoLocal'];

  ngOnInit() {
    this.configService.loadClientConfigsFromLocalStorage();
  }

  get clients(): ClientConfig[] {
    return this.configService.clientConfigs();
  }

  startNewClient() {
    this.editingClient = null;
    this.clientForm.set({
      id: Date.now().toString(),
      name: '',
      description: '',
      stores: []
    });
    this.showForm = true;
  }

  editClient(client: ClientConfig) {
    this.editingClient = client;
    this.clientForm.set({ ...client, stores: [...client.stores] });
    this.showForm = true;
  }

  deleteClient(id: string) {
    if (confirm('¿Seguro que deseas eliminar este cliente?')) {
      this.configService.deleteClientConfig(id);
    }
  }

  addStore() {
    const store = this.newStore();
    if (store.servidor && store.user && store.repository) {
      const client = this.clientForm();

      if (this.editingStoreIndex !== null) {
        // Actualizar tienda existente
        client.stores[this.editingStoreIndex] = { ...store };
        this.editingStoreIndex = null;
      } else {
        // Agregar nueva tienda
        client.stores.push({ ...store });
      }

      this.resetNewStore();
    }
  }

  editStore(index: number) {
    const client = this.clientForm();
    const store = client.stores[index];
    this.newStore.set({ ...store });
    this.editingStoreIndex = index;
  }

  removeStore(index: number) {
    const client = this.clientForm();
    client.stores.splice(index, 1);

    // Si estamos editando esta tienda, cancelar la edición
    if (this.editingStoreIndex === index) {
      this.editingStoreIndex = null;
      this.resetNewStore();
    } else if (this.editingStoreIndex !== null && this.editingStoreIndex > index) {
      // Ajustar el índice si eliminamos una tienda antes de la que estamos editando
      this.editingStoreIndex--;
    }
  }

  cancelEditStore() {
    this.editingStoreIndex = null;
    this.resetNewStore();
  }

  resetNewStore() {
    this.newStore.set({
      servidor: '',
      puerto: '1433',
      user: '',
      password: '',
      repository: '',
      adapter: 'SqlServerSP'
    });
  }

  saveClient() {
    const client = this.clientForm();
    if (client.name && client.stores.length > 0) {
      if (this.editingClient) {
        this.configService.updateClientConfig(client.id, client);
      } else {
        this.configService.addClientConfig(client);
      }
      this.cancelForm();
    }
  }

  cancelForm() {
    this.showForm = false;
    this.editingClient = null;
    this.clientForm.set({
      id: '',
      name: '',
      description: '',
      stores: []
    });
    this.resetNewStore();
  }
}
