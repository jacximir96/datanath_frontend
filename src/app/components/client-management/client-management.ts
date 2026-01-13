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

  // Paginación para lista de tiendas
  storesPageSize = 10;
  storesCurrentPage = signal(0);
  storesSearchControl = new FormControl('');

  adapters = ['SqlServerSP', 'MySQL', 'PostgreSQL', 'Oracle', 'SqlServerTrust', 'SqlServer', 'MongoLocal', 'MongoSrv'];

  // Signal para el valor de búsqueda de tiendas
  private storesSearchValue = toSignal(
    this.storesSearchControl.valueChanges.pipe(
      startWith(''),
      map(value => value || '')
    ),
    { initialValue: '' }
  );

  // Computed para tiendas filtradas
  filteredClientStores = computed(() => {
    const stores = this.clientForm().stores;
    const searchTerm = this.storesSearchValue().toLowerCase();

    if (!searchTerm) {
      return stores;
    }

    return stores.filter(store =>
      store.servidor.toLowerCase().includes(searchTerm) ||
      store.repository.toLowerCase().includes(searchTerm) ||
      store.adapter.toLowerCase().includes(searchTerm) ||
      store.user.toLowerCase().includes(searchTerm)
    );
  });

  // Computed para tiendas paginadas (usando las filtradas)
  paginatedStores = computed(() => {
    const stores = this.filteredClientStores();
    const page = this.storesCurrentPage();
    const start = page * this.storesPageSize;
    const end = start + this.storesPageSize;
    return stores.slice(start, end);
  });

  get totalStoresPages(): number {
    return Math.ceil(this.filteredClientStores().length / this.storesPageSize);
  }

  ngOnInit() {
    this.configService.loadClientConfigsFromGraphQL();
    this.configService.loadStoreCatalogFromLocalStorage();
    // Cargar conexiones desde GraphQL automáticamente
    this.loadConnectionsFromGraphQL();

    // Resetear página cuando cambia la búsqueda
    this.storesSearchControl.valueChanges.subscribe(() => {
      this.storesCurrentPage.set(0);
    });
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
    this.storesCurrentPage.set(0); // Reset pagination
    this.storesSearchControl.setValue(''); // Reset search
    this.clientForm.set({
      ...client,
      stores: [...client.stores],
      structureType: client.structureType || 'same' // Retrocompatibilidad para clientes existentes
    });
    this.showForm = true;
  }

  nextStoresPage() {
    if (this.storesCurrentPage() < this.totalStoresPages - 1) {
      this.storesCurrentPage.update(p => p + 1);
    }
  }

  previousStoresPage() {
    if (this.storesCurrentPage() > 0) {
      this.storesCurrentPage.update(p => p - 1);
    }
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
    const client = this.clientForm();

    // Validar que el nombre del cliente esté ingresado
    if (!client.name) {
      this.snackBar.open('Debes ingresar el nombre del cliente primero', 'Cerrar', { duration: 3000 });
      return;
    }

    if (store.servidor && store.user && store.repository) {
      const selectedStores = this.selectedStoresForConnection();

      // Extraer clientId del repository (ej: "MAXPOINT_A013" -> "A013")
      let clientId = '';
      if (client.name === 'MAXPOINT_LEGACY' && store.repository.includes('_')) {
        const parts = store.repository.split('_');
        clientId = parts.length > 1 ? parts[1] : '';
      }

      // Verificar si necesitamos crear el ClientConfig primero
      const needsClientConfig = !client.id || !this.editingClient;

      if (needsClientConfig) {
        // Crear ClientConfig primero para clientes nuevos
        const clientConfigInput = {
          name: client.name,
          description: client.description || null,
          structureType: client.structureType || 'same'
        };

        this.graphqlService.createClientConfig(clientConfigInput).subscribe({
          next: (response) => {
            const newClientConfig = response.data.createClientConfig;
            // Actualizar el formulario con el ID del ClientConfig
            this.clientForm.update(c => ({ ...c, id: newClientConfig.id }));
            // Continuar con la creación de la conexión
            this.createOrUpdateConnection(newClientConfig.id, store, selectedStores, clientId);
          },
          error: (error) => {
            console.error('Error al crear ClientConfig:', error);
            this.snackBar.open('Error al crear configuración del cliente', 'Cerrar', { duration: 3000 });
          }
        });
      } else {
        // Cliente existente, usar el ID que ya tiene
        this.createOrUpdateConnection(client.id, store, selectedStores, clientId);
      }
    } else {
      this.snackBar.open('Por favor completa todos los campos requeridos de la tienda', 'Cerrar', { duration: 3000 });
    }
  }

  private createOrUpdateConnection(clientConfigId: string, store: Origin, selectedStores: string[], clientId: string) {
    const client = this.clientForm();

    // Preparar input para GraphQL
    const input = {
      clientConfigId: clientConfigId,
      clientName: client.name,
      clientId: clientId,
      servidor: store.servidor,
      puerto: store.puerto,
      user: store.user,
      password: store.password,
      repository: store.repository,
      adapter: store.adapter,
      associatedStores: selectedStores.length > 0 ? selectedStores : [],
      storeFilterField: selectedStores.length > 0 && store.storeFilterField ? store.storeFilterField : null
    };

      if (this.editingStoreIndex !== null) {
        // Actualizar tienda existente en GraphQL
        const existingStore = client.stores[this.editingStoreIndex];
        const connectionId = existingStore._connectionId;

        if (connectionId) {
          this.graphqlService.updateConnection(connectionId, input).subscribe({
            next: (response) => {
              // Actualizar en el formulario local
              const updatedStore: Origin = {
                _connectionId: connectionId,
                ...store,
                associatedStores: selectedStores.length > 0 ? [...selectedStores] : undefined,
                storeFilterField: selectedStores.length > 0 && store.storeFilterField ? store.storeFilterField : undefined
              };
              client.stores[this.editingStoreIndex!] = updatedStore;
              this.editingStoreIndex = null;
              this.resetNewStore();
              this.selectedStoresForConnection.set([]);
              this.snackBar.open('Tienda actualizada exitosamente', 'Cerrar', { duration: 2000 });

              // Recargar configuraciones
              this.configService.loadClientConfigsFromGraphQL();
            },
            error: (error) => {
              console.error('Error al actualizar tienda:', error);
              this.snackBar.open('Error al actualizar tienda', 'Cerrar', { duration: 3000 });
            }
          });
        }
      } else {
        // Crear nueva tienda en GraphQL
        this.graphqlService.createConnection(input).subscribe({
          next: (response) => {
            const newConnection = response.data.createConnection;

            // Agregar al formulario local con el ID de GraphQL
            const storeWithId: Origin = {
              _connectionId: newConnection.id,
              ...store,
              associatedStores: selectedStores.length > 0 ? [...selectedStores] : undefined,
              storeFilterField: selectedStores.length > 0 && store.storeFilterField ? store.storeFilterField : undefined
            };
            client.stores.push(storeWithId);

            this.resetNewStore();
            this.selectedStoresForConnection.set([]);
            this.snackBar.open('Tienda agregada exitosamente', 'Cerrar', { duration: 2000 });

            // Recargar configuraciones
            this.configService.loadClientConfigsFromGraphQL();
          },
          error: (error) => {
            console.error('Error al crear tienda:', error);
            this.snackBar.open('Error al crear tienda', 'Cerrar', { duration: 3000 });
          }
        });
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

  // Método nuevo que busca por connectionId (funciona con filtros)
  editStoreByConnectionId(connectionId: string | undefined) {
    if (!connectionId) return;

    const client = this.clientForm();
    const index = client.stores.findIndex(s => s._connectionId === connectionId);

    if (index !== -1) {
      this.editStore(index);
    }
  }

  removeStore(index: number) {
    const client = this.clientForm();
    const store = client.stores[index];
    const connectionId = store._connectionId;

    if (connectionId) {
      // Eliminar de GraphQL
      this.graphqlService.deleteConnection(connectionId).subscribe({
        next: () => {
          // Eliminar del formulario local
          client.stores.splice(index, 1);

          // Si estamos editando esta tienda, cancelar la edición
          if (this.editingStoreIndex === index) {
            this.editingStoreIndex = null;
            this.resetNewStore();
          } else if (this.editingStoreIndex !== null && this.editingStoreIndex > index) {
            // Ajustar el índice si eliminamos una tienda antes de la que estamos editando
            this.editingStoreIndex--;
          }

          this.snackBar.open('Tienda eliminada exitosamente', 'Cerrar', { duration: 2000 });

          // Recargar configuraciones
          this.configService.loadClientConfigsFromGraphQL();
        },
        error: (error) => {
          console.error('Error al eliminar tienda:', error);
          this.snackBar.open('Error al eliminar tienda', 'Cerrar', { duration: 3000 });
        }
      });
    } else {
      // Si no tiene connectionId (no debería pasar), solo eliminar localmente
      client.stores.splice(index, 1);
      if (this.editingStoreIndex === index) {
        this.editingStoreIndex = null;
        this.resetNewStore();
      } else if (this.editingStoreIndex !== null && this.editingStoreIndex > index) {
        this.editingStoreIndex--;
      }
    }
  }

  // Método nuevo que busca por connectionId (funciona con filtros)
  removeStoreByConnectionId(connectionId: string | undefined) {
    if (!connectionId) return;

    const client = this.clientForm();
    const index = client.stores.findIndex(s => s._connectionId === connectionId);

    if (index !== -1) {
      this.removeStore(index);
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

    if (!client.name) {
      this.snackBar.open('Debes ingresar el nombre del cliente', 'Cerrar', { duration: 3000 });
      return;
    }

    if (client.stores.length === 0) {
      this.snackBar.open('Debes agregar al menos una tienda', 'Cerrar', { duration: 3000 });
      return;
    }

    // Las tiendas ya están guardadas en GraphQL
    // Actualizar el ClientConfig con los cambios (nombre, descripción, structureType)
    if (client.id) {
      const clientConfigInput = {
        name: client.name,
        description: client.description || null,
        structureType: client.structureType || 'same'
      };

      this.graphqlService.updateClientConfig(client.id, clientConfigInput).subscribe({
        next: () => {
          this.snackBar.open('Cliente guardado exitosamente', 'Cerrar', { duration: 2000 });
          this.cancelForm();
          // Recargar la lista de clientes
          this.configService.loadClientConfigsFromGraphQL();
        },
        error: (error) => {
          console.error('Error al actualizar ClientConfig:', error);
          this.snackBar.open('Error al guardar cliente', 'Cerrar', { duration: 3000 });
        }
      });
    } else {
      this.snackBar.open('Error: Cliente sin ID', 'Cerrar', { duration: 3000 });
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
