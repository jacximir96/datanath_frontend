import { Component, inject, OnInit, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { FormControl } from '@angular/forms';
import { MatCardModule } from '@angular/material/card';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatExpansionModule } from '@angular/material/expansion';
import { MatSelectModule } from '@angular/material/select';
import { MatTableModule } from '@angular/material/table';
import { MatDialogModule, MatDialog } from '@angular/material/dialog';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatChipsModule } from '@angular/material/chips';
import { MatDividerModule } from '@angular/material/divider';
import { NgxMatSelectSearchModule } from 'ngx-mat-select-search';
import { ConfigService } from '../../services/config.service';
import { MetadataService } from '../../services/metadata.service';
import { GraphqlService } from '../../services/graphql.service';
import { ClientConfig, Origin, StoreItem } from '../../models/config.model';
import { toSignal } from '@angular/core/rxjs-interop';
import { startWith, map } from 'rxjs/operators';
import { environment } from '../../../environments/environment';

@Component({
  selector: 'app-client-management',
  standalone: true,
  imports: [
    CommonModule, FormsModule, ReactiveFormsModule, MatCardModule, MatFormFieldModule,
    MatInputModule, MatButtonModule, MatIconModule, MatExpansionModule,
    MatSelectModule, MatTableModule, MatDialogModule, MatSnackBarModule,
    MatProgressSpinnerModule, MatCheckboxModule, MatChipsModule, MatDividerModule,
    NgxMatSelectSearchModule
  ],
  templateUrl: './client-management.html',
  styleUrl: './client-management.css',
})
export class ClientManagementComponent implements OnInit {
  protected configService = inject(ConfigService);
  private metadataService = inject(MetadataService);
  private graphqlService = inject(GraphqlService);
  private snackBar = inject(MatSnackBar);

  editingClient: ClientConfig | null = null;
  showForm = false;

  // Items del catálogo asociados a la conexión actual - convertido a signal para mejor reactividad
  selectedStoresForConnection = signal<string[]>([]);
  storeSearchControl = new FormControl('');

  // GraphQL connections (reemplaza storeCatalog)
  private readonly clientName = environment.clientName;
  availableConnections = signal<any[]>([]);
  loadingConnections = signal<boolean>(false);

  // Filtrado de tiendas para búsqueda (ahora usa GraphQL)
  filteredStores = computed(() => {
    const searchTerm = this.storeSearchValue().toLowerCase();
    const connections = this.availableConnections();

    // Mapear conexiones a formato StoreItem para compatibilidad
    const stores: StoreItem[] = connections.map(conn => ({
      id: conn.id,
      code: conn.clientId,
      name: conn.repository,
      description: conn.clientName
    }));

    if (!searchTerm) {
      return stores;
    }
    return stores.filter(store =>
      store.code.toLowerCase().includes(searchTerm) ||
      store.name.toLowerCase().includes(searchTerm)
    );
  });

  // Signal para el valor de búsqueda
  private storeSearchValue = toSignal(
    this.storeSearchControl.valueChanges.pipe(
      startWith(''),
      map(value => value || '')
    ),
    { initialValue: '' }
  );

  clientForm = signal<ClientConfig>({
    id: '',
    name: '',
    description: '',
    stores: [],
    structureType: 'same' // Por defecto asumimos misma estructura
  });

  newStore = signal<Origin>({
    servidor: '',
    puerto: '1433',
    user: '',
    password: '',
    repository: '',
    adapter: 'SqlServerSP',
    associatedStores: [],
    storeFilterField: ''
  });

  editingStoreIndex: number | null = null;

  adapters = ['SqlServerSP', 'MySQL', 'PostgreSQL', 'Oracle', 'SqlServerTrust', 'SqlServer', 'MongoLocal', 'MongoSrv'];

  ngOnInit() {
    this.configService.loadClientConfigsFromLocalStorage();
    this.configService.loadStoreCatalogFromLocalStorage();
    // Cargar conexiones desde GraphQL automáticamente
    this.loadConnectionsFromGraphQL();
  }

  get clients(): ClientConfig[] {
    return this.configService.clientConfigs();
  }

  getStoreById(storeId: string) {
    // Buscar en las conexiones de GraphQL
    const connection = this.availableConnections().find(c => c.id === storeId);
    if (connection) {
      return {
        id: connection.id,
        code: connection.clientId,
        name: connection.repository,
        description: connection.clientName
      };
    }
    return undefined;
  }

  loadConnectionsFromGraphQL() {
    if (!this.clientName) return;

    this.loadingConnections.set(true);

    // Cargar TODAS las conexiones (sin paginación limitada)
    this.graphqlService.getConnections(this.clientName, 0, 1000).subscribe({
      next: (response) => {
        this.loadingConnections.set(false);
        if (response.data && response.data.getConnections) {
          const connections = response.data.getConnections.items;
          this.availableConnections.set(connections);
          // Sincronizar con config.service para que exportJSON tenga acceso
          this.configService.setGraphqlConnections(connections);
        }
      },
      error: (error) => {
        this.loadingConnections.set(false);
        console.error('Error al cargar conexiones:', error);
      }
    });
  }

  getTotalItemsForClient(client: ClientConfig): number {
    return client.stores.reduce((total, store) => {
      return total + (store.associatedStores?.length || 0);
    }, 0);
  }

  startNewClient() {
    this.editingClient = null;
    this.selectedStoresForConnection.set([]);
    this.clientForm.set({
      id: Date.now().toString(),
      name: '',
      description: '',
      stores: [],
      structureType: 'same'
    });
    this.showForm = true;
  }

  editClient(client: ClientConfig) {
    this.editingClient = client;
    this.selectedStoresForConnection.set([]);
    this.clientForm.set({
      ...client,
      stores: [...client.stores],
      structureType: client.structureType || 'same' // Retrocompatibilidad para clientes existentes
    });
    this.showForm = true;
  }

  deleteClient(id: string) {
    if (confirm('¿Seguro que deseas eliminar este cliente?')) {
      this.configService.deleteClientConfig(id);
    }
  }

  // Métodos para seleccionar/deseleccionar todos los items para una conexión
  selectAllStoresForConnection() {
    this.selectedStoresForConnection.set(this.availableConnections().map(c => c.id));
  }

  deselectAllStoresForConnection() {
    this.selectedStoresForConnection.set([]);
  }


  addStore() {
    const store = this.newStore();
    if (store.servidor && store.user && store.repository) {
      const client = this.clientForm();
      const selectedStores = this.selectedStoresForConnection();

      // Copiar los items seleccionados a la conexión
      const storeWithItems: Origin = {
        ...store,
        associatedStores: selectedStores.length > 0
          ? [...selectedStores]
          : undefined,
        storeFilterField: selectedStores.length > 0 && store.storeFilterField
          ? store.storeFilterField
          : undefined
      };

      if (this.editingStoreIndex !== null) {
        // Actualizar tienda existente
        client.stores[this.editingStoreIndex] = storeWithItems;
        this.editingStoreIndex = null;
      } else {
        // Agregar store
        client.stores.push(storeWithItems);
      }

      this.resetNewStore();
      this.selectedStoresForConnection.set([]);
    }
  }

  editStore(index: number) {
    const client = this.clientForm();
    const store = client.stores[index];

    this.newStore.set({
      servidor: store.servidor,
      puerto: store.puerto,
      user: store.user,
      password: store.password,
      repository: store.repository,
      adapter: store.adapter,
      associatedStores: store.associatedStores || [],
      storeFilterField: store.storeFilterField || ''
    });

    // Cargar los items asociados para edición
    this.selectedStoresForConnection.set([...(store.associatedStores || [])]);

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
    this.selectedStoresForConnection.set([]);
  }

  resetNewStore() {
    this.newStore.set({
      servidor: '',
      puerto: '1433',
      user: '',
      password: '',
      repository: '',
      adapter: 'SqlServerSP',
      associatedStores: [],
      storeFilterField: ''
    });
  }

  updateClientName(value: string) {
    const current = this.clientForm();
    this.clientForm.set({
      ...current,
      name: value
    });
  }

  updateClientDescription(value: string) {
    const current = this.clientForm();
    this.clientForm.set({
      ...current,
      description: value
    });
  }

  updateStructureType(value: 'same' | 'different') {
    const current = this.clientForm();
    this.clientForm.set({
      ...current,
      structureType: value
    });
  }

  updateNewStoreField(field: keyof Origin, value: any) {
    const current = this.newStore();
    this.newStore.set({
      ...current,
      [field]: value
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
    this.selectedStoresForConnection.set([]);
    this.clientForm.set({
      id: '',
      name: '',
      description: '',
      stores: [],
      structureType: 'same'
    });
    this.resetNewStore();
  }
}
