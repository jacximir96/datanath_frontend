import { Component, inject, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatCardModule } from '@angular/material/card';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatTableModule } from '@angular/material/table';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatPaginatorModule, PageEvent } from '@angular/material/paginator';
import { ConfigService } from '../../services/config.service';
import { GraphqlService } from '../../services/graphql.service';
import { StoreItem } from '../../models/config.model';
import { environment } from '../../../environments/environment';

@Component({
  selector: 'app-store-catalog-management',
  standalone: true,
  imports: [
    CommonModule, FormsModule, MatCardModule, MatFormFieldModule,
    MatInputModule, MatButtonModule, MatIconModule, MatTableModule,
    MatSnackBarModule, MatProgressSpinnerModule, MatPaginatorModule
  ],
  templateUrl: './store-catalog-management.html',
  styleUrl: './store-catalog-management.css',
})
export class StoreCatalogManagementComponent implements OnInit {
  protected configService = inject(ConfigService);
  private graphqlService = inject(GraphqlService);
  private snackBar = inject(MatSnackBar);

  editingStore: StoreItem | null = null;
  showForm = false;

  storeForm = signal<StoreItem>({
    id: '',
    code: '',
    name: '',
    description: ''
  });

  // GraphQL data
  private readonly clientName = environment.clientName;
  availableConnections = signal<any[]>([]);
  loading = signal<boolean>(false);

  // Search
  searchInput = signal<string>(''); // Input temporal
  searchTerm = signal<string>('');  // Término de búsqueda activo

  // Pagination
  totalCount = signal<number>(0);
  pageSize = signal<number>(10);
  pageIndex = signal<number>(0);

  displayedColumns: string[] = ['code', 'actions'];

  ngOnInit() {
    this.configService.loadStoreCatalogFromLocalStorage();
    // Cargar automáticamente las conexiones al iniciar
    this.loadConnections();
  }

  get stores(): StoreItem[] {
    return this.configService.storeCatalog();
  }

  loadConnections() {
    if (!this.clientName) {
      this.snackBar.open('No se ha configurado el nombre de cliente', 'Cerrar', { duration: 3000 });
      return;
    }

    this.loading.set(true);
    const skip = this.pageIndex() * this.pageSize();
    const take = this.pageSize();
    const clientIdFilter = this.searchTerm().trim() || undefined;

    this.graphqlService.getConnections(this.clientName, skip, take, clientIdFilter).subscribe({
      next: (response) => {
        this.loading.set(false);
        if (response.data && response.data.getConnections) {
          const data = response.data.getConnections;
          this.availableConnections.set(data.items);
          this.totalCount.set(data.totalCount);

          // Sincronizar con config.service (solo la página actual por paginación)
          // Nota: Para exportJSON, connection-groups-step o client-management ya cargan todas
          this.configService.setGraphqlConnections(data.items);
        } else {
          this.snackBar.open('No se encontraron conexiones', 'Cerrar', { duration: 3000 });
        }
      },
      error: (error) => {
        this.loading.set(false);
        this.snackBar.open('Error al cargar conexiones: ' + error.message, 'Cerrar', { duration: 5000 });
      }
    });
  }

  performSearch() {
    this.searchTerm.set(this.searchInput());
    this.pageIndex.set(0); // Reset to first page when searching
    this.loadConnections();
  }

  clearSearch() {
    this.searchInput.set('');
    this.searchTerm.set('');
    this.pageIndex.set(0);
    this.loadConnections();
  }

  onPageChange(event: PageEvent) {
    this.pageIndex.set(event.pageIndex);
    this.pageSize.set(event.pageSize);
    this.loadConnections();
  }

  addConnectionToCatalog(connection: any) {
    const newStore: StoreItem = {
      id: connection.id,
      code: connection.clientId,
      name: connection.repository,
      description: connection.clientName
    };

    // Check if already exists
    const exists = this.stores.some(s => s.code === newStore.code);
    if (exists) {
      this.snackBar.open('Este código ya existe en el catálogo', 'Cerrar', { duration: 3000 });
      return;
    }

    this.configService.addStoreToCatalog(newStore);
    this.snackBar.open('Código agregado al catálogo', 'Cerrar', { duration: 3000 });
  }

  startNewStore() {
    this.editingStore = null;
    this.storeForm.set({
      id: Date.now().toString(),
      code: '',
      name: '',
      description: ''
    });
    this.showForm = true;
  }

  editStore(store: StoreItem) {
    this.editingStore = store;
    this.storeForm.set({ ...store });
    this.showForm = true;
  }

  deleteStore(id: string) {
    if (confirm('¿Seguro que deseas eliminar esta tienda del catálogo?')) {
      this.configService.deleteStoreFromCatalog(id);
      this.snackBar.open('Tienda eliminada del catálogo', 'Cerrar', { duration: 3000 });
    }
  }

  saveStore() {
    const store = this.storeForm();
    if (store.code && store.name) {
      if (this.editingStore) {
        this.configService.updateStoreInCatalog(store.id, store);
        this.snackBar.open('Tienda actualizada', 'Cerrar', { duration: 3000 });
      } else {
        // Check if code already exists
        const exists = this.stores.some(s => s.code === store.code);
        if (exists) {
          this.snackBar.open('Ya existe una tienda con ese código', 'Cerrar', { duration: 3000 });
          return;
        }
        this.configService.addStoreToCatalog(store);
        this.snackBar.open('Tienda agregada al catálogo', 'Cerrar', { duration: 3000 });
      }
      this.cancelForm();
    }
  }

  cancelForm() {
    this.showForm = false;
    this.editingStore = null;
    this.storeForm.set({
      id: '',
      code: '',
      name: '',
      description: ''
    });
  }
}
