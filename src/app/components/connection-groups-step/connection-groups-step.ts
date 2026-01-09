import { Component, inject, computed, signal, effect, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ConfigService, Scenario } from '../../services/config.service';
import { Origin, Entity } from '../../models/config.model';
import { GraphqlService } from '../../services/graphql.service';
import { MatCardModule } from '@angular/material/card';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatTooltipModule } from '@angular/material/tooltip';
import { CdkDrag, CdkDropList, CdkDragDrop } from '@angular/cdk/drag-drop';
import { environment } from '../../../environments/environment';

@Component({
  selector: 'app-connection-groups-step',
  standalone: true,
  imports: [
    CommonModule,
    CdkDrag,
    CdkDropList,
    MatCardModule,
    MatIconModule,
    MatButtonModule,
    MatTooltipModule
  ],
  templateUrl: './connection-groups-step.html',
  styleUrl: './connection-groups-step.css'
})
export class ConnectionGroupsStepComponent implements OnInit {
  protected configService = inject(ConfigService);
  private graphqlService = inject(GraphqlService);

  readonly scenarios = this.configService.scenarios;

  readonly allEntities = computed(() =>
    this.configService.config().entityGroups.flatMap(group => group.entities)
  );

  readonly allOrigins = computed(() => this.configService.config().origins);

  // Track selected stores for group generation
  selectedStoresForGroups = signal<Set<string>>(new Set());

  // GraphQL connections (reemplaza storeCatalog)
  private readonly clientName = environment.clientName;
  availableConnections = signal<any[]>([]);

  // Computed: Clients with associated stores that have entities in use
  // ONLY checks the FIRST entity to determine if catalog items section should appear
  readonly clientsWithStores = computed(() => {
    const entities = this.allEntities();
    const clientConfigs = this.configService.clientConfigs();
    const graphqlConnections = this.availableConnections();

    const clientsMap = new Map<string, { client: any, stores: any[], connection: any }>();

    // Only check the FIRST entity
    const firstEntity = entities[0];
    if (!firstEntity || !firstEntity.originRepository) {
      return [];
    }

    const client = clientConfigs.find(c =>
      c.stores.some(store => store.repository === firstEntity.originRepository)
    );

    if (client) {
      // Encontrar la conexión específica que corresponde a este repository
      const connection = client.stores.find(store => store.repository === firstEntity.originRepository);

      // Si la conexión tiene items del catálogo asociados
      if (connection && connection.associatedStores && connection.associatedStores.length > 0) {
        const connectionKey = `${client.id}-${connection.repository}`;

        // Buscar en las conexiones de GraphQL en lugar de localStorage
        const clientStores = connection.associatedStores
          .map((storeId: string) => {
            const conn = graphqlConnections.find(c => c.id === storeId);
            if (conn) {
              return {
                id: conn.id,
                code: conn.clientId,
                name: conn.repository,
                description: conn.clientName
              };
            }
            return undefined;
          })
          .filter((s: any) => s !== undefined);

        clientsMap.set(connectionKey, { client, stores: clientStores, connection });
      }
    }

    return Array.from(clientsMap.values());
  });

  private lastEntityCount = 0;
  private lastMaxConnections = 0;
  private lastFixedConnectionSignature = '';

  constructor() {
    // Auto-select stores when clients with stores are detected
    effect(() => {
      const clientsWithStores = this.clientsWithStores();
      if (clientsWithStores.length > 0) {
        const allStoreIds = new Set<string>();
        clientsWithStores.forEach(clientWithStores => {
          clientWithStores.stores.forEach(store => {
            allStoreIds.add(store.id);
          });
        });

        // Only update if different
        const current = this.selectedStoresForGroups();
        if (current.size !== allStoreIds.size ||
            !Array.from(allStoreIds).every(id => current.has(id))) {
          this.selectedStoresForGroups.set(allStoreIds);
        }
      }
    }, { allowSignalWrites: true });

    // React to changes in selected stores and recreate groups
    effect(() => {
      const selectedStores = this.selectedStoresForGroups();
      const clientsWithStores = this.clientsWithStores();

      // Only recreate if we have clients with stores
      if (clientsWithStores.length > 0) {
        this.createStoreBasedGroupsAutomatic();
      }
    }, { allowSignalWrites: true });

    // Re-enable effect to react to data changes from other steps.
    effect(() => {
      this.updatePrincipalScenario();

      // Only recreate automatic scenarios if entities or connections changed
      const currentEntityCount = this.allEntities().length;
      const currentMaxConnections = this.calculateMaxConnections();

      // Create signature of fixedConnection flags to detect changes
      const currentFixedSignature = this.allEntities()
        .map(e => `${e.name}:${e.fixedConnection || false}`)
        .join('|');

      if (currentEntityCount !== this.lastEntityCount ||
          currentMaxConnections !== this.lastMaxConnections ||
          currentFixedSignature !== this.lastFixedConnectionSignature) {
        this.lastEntityCount = currentEntityCount;
        this.lastMaxConnections = currentMaxConnections;
        this.lastFixedConnectionSignature = currentFixedSignature;
        this.createAutomaticScenarios();
      }
    }, { allowSignalWrites: true });
  }

  ngOnInit(): void {
    // Initialize on component load
    this.lastEntityCount = this.allEntities().length;
    this.lastMaxConnections = this.calculateMaxConnections();
    this.lastFixedConnectionSignature = this.allEntities()
      .map(e => `${e.name}:${e.fixedConnection || false}`)
      .join('|');

    // Load client configs and GraphQL connections
    this.configService.loadClientConfigsFromLocalStorage();
    this.loadConnectionsFromGraphQL();
  }

  private loadConnectionsFromGraphQL() {
    if (!this.clientName) return;

    // Cargar TODAS las conexiones (sin paginación limitada)
    this.graphqlService.getConnections(this.clientName, 0, 1000).subscribe({
      next: (response) => {
        if (response.data && response.data.getConnections) {
          const connections = response.data.getConnections.items;
          this.availableConnections.set(connections);
          // Sincronizar con config.service para que exportJSON tenga acceso
          this.configService.setGraphqlConnections(connections);
        }
      },
      error: (error) => {
        console.error('Error al cargar conexiones en grupos de conexión:', error);
      }
    });
  }

  private calculateMaxConnections(): number {
    const entities = this.allEntities();
    const clientConfigs = this.configService.clientConfigs();
    let maxConnections = 1;

    entities.forEach(entity => {
      if (!entity.originRepository) return;

      const client = clientConfigs.find(c =>
        c.stores.some(store => store.repository === entity.originRepository)
      );

      if (client) {
        maxConnections = Math.max(maxConnections, client.stores.length);
      }
    });

    return maxConnections;
  }

  private updatePrincipalScenario(): void {
    // Skip principal scenario if we have clients with associated stores
    // (store-based groups will be created instead)
    if (this.clientsWithStores().length > 0) {
      return;
    }

    const origins = this.allOrigins();
    const principalAssignments = new Map<string, string>();

    this.allEntities().forEach(entity => {
      let repository = entity.originRepository;

      // Si la entidad no tiene originRepository asignado, intentar inferirlo
      if (!repository) {
        // Si solo hay un origen disponible, usarlo automáticamente
        if (origins.length === 1) {
          repository = origins[0].repository;
        }
      }

      if (repository) {
        principalAssignments.set(entity.name, repository);
      }
    });

    const principalScenario: Scenario = {
      id: 1,
      name: 'Grupo Principal',
      isReadOnly: true,
      assignments: principalAssignments
    };

    // Use the new, safe method to prevent infinite loops.
    this.configService.setPrincipalScenario(principalScenario);
  }

  private createAutomaticScenarios(): void {
    // If we have clients with associated stores, create store-based groups instead
    if (this.clientsWithStores().length > 0) {
      this.createStoreBasedGroupsAutomatic();
      return;
    }

    // Otherwise, use the normal flow (connection-based groups)
    const entities = this.allEntities();
    const clientConfigs = this.configService.clientConfigs();

    // Map each entity to its client and get connection counts
    const entityClientMap = new Map<string, { clientName: string, connectionCount: number }>();
    let maxConnections = 1; // At least 1 (the principal group)

    entities.forEach(entity => {
      if (!entity.originRepository) {
        return;
      }

      // Find which client this entity belongs to
      const client = clientConfigs.find(c =>
        c.stores.some(store => store.repository === entity.originRepository)
      );

      if (client) {
        const connectionCount = client.stores.length;
        entityClientMap.set(entity.name, {
          clientName: client.name,
          connectionCount
        });
        maxConnections = Math.max(maxConnections, connectionCount);
      }
    });

    // Create automatic scenarios for connections beyond the first
    const currentScenarios = this.scenarios();
    const newScenarios: Scenario[] = [currentScenarios[0]]; // Keep principal scenario

    // Create automatic scenarios for each additional connection (2 to maxConnections)
    const principalAssignments = currentScenarios[0]?.assignments || new Map();

    for (let i = 2; i <= maxConnections; i++) {
      const assignments = new Map<string, string>();

      entities.forEach(entity => {
        // If the entity has a fixed connection, always use the same repository
        if (entity.fixedConnection) {
          const principalRepo = principalAssignments.get(entity.name);
          if (principalRepo) {
            assignments.set(entity.name, principalRepo);
          }
          return; // Skip rotation logic
        }

        // Otherwise, use rotation logic
        const entityClient = entityClientMap.get(entity.name);

        if (entityClient) {
          // Entity has a known client with multiple connections
          const client = clientConfigs.find(c => c.name === entityClient.clientName);
          if (client) {
            // Assign the i-th connection if it exists, otherwise use the last available
            const connectionIndex = Math.min(i - 1, client.stores.length - 1);
            const connection = client.stores[connectionIndex];

            if (connection) {
              assignments.set(entity.name, connection.repository);
            }
          }
        } else {
          // Entity doesn't have a client in the map, use principal assignment
          // (This happens when the entity's client only has 1 connection)
          const principalRepo = principalAssignments.get(entity.name);
          if (principalRepo) {
            assignments.set(entity.name, principalRepo);
          }
        }
      });

      const autoScenario: Scenario = {
        id: i,
        name: `Grupo ${i}`,
        isReadOnly: false, // Automatic groups can be modified
        assignments
      };

      newScenarios.push(autoScenario);
    }

    // Always update scenarios (assignments may have changed even if count is the same)
    this.configService.updateScenarios(newScenarios);
  }

  addScenario(): void {
    const currentScenarios = this.scenarios();
    const nextId = currentScenarios.length + 1;
    const newScenario: Scenario = {
      id: nextId,
      name: `Grupo ${nextId}`,
      isReadOnly: false,
      assignments: new Map<string, string>() // Start with empty assignments
    };
    this.configService.updateScenarios([...currentScenarios, newScenario]);
  }

  deleteScenario(scenario: Scenario): void {
    // No permitir borrar el grupo principal
    if (scenario.isReadOnly) {
      return;
    }

    // If this scenario has a storeFilter, deselect that store
    if (scenario.storeFilter) {
      this.selectedStoresForGroups.update(current => {
        const newSet = new Set(current);
        newSet.delete(scenario.storeFilter!);
        return newSet;
      });
    }

    const currentScenarios = this.scenarios();
    const updatedScenarios = currentScenarios.filter(s => s.id !== scenario.id);
    this.configService.updateScenarios(updatedScenarios);
  }

  // Store selection methods
  toggleStoreSelection(storeId: string): void {
    this.selectedStoresForGroups.update(current => {
      const newSet = new Set(current);
      if (newSet.has(storeId)) {
        newSet.delete(storeId);
      } else {
        newSet.add(storeId);
      }
      return newSet;
    });
  }

  isStoreSelected(storeId: string): boolean {
    return this.selectedStoresForGroups().has(storeId);
  }

  selectAllStoresForClient(clientId: string): void {
    const clientWithStores = this.clientsWithStores().find(c => c.client.id === clientId);
    if (!clientWithStores) return;

    this.selectedStoresForGroups.update(current => {
      const newSet = new Set(current);
      clientWithStores.stores.forEach(store => newSet.add(store.id));
      return newSet;
    });
  }

  deselectAllStoresForClient(clientId: string): void {
    const clientWithStores = this.clientsWithStores().find(c => c.client.id === clientId);
    if (!clientWithStores) return;

    this.selectedStoresForGroups.update(current => {
      const newSet = new Set(current);
      clientWithStores.stores.forEach(store => newSet.delete(store.id));
      return newSet;
    });
  }

  // Create groups for selected stores AUTOMATICALLY (called from effect)
  private createStoreBasedGroupsAutomatic(): void {
    const selectedStores = Array.from(this.selectedStoresForGroups());
    if (selectedStores.length === 0) {
      // If no stores selected, clear scenarios
      this.configService.updateScenarios([]);
      return;
    }

    const graphqlConnections = this.availableConnections();
    const origins = this.allOrigins();
    const newGroups: Scenario[] = [];

    // Get principal assignments (from first entity's repository)
    const principalAssignments = new Map<string, string>();
    this.allEntities().forEach(entity => {
      let repository = entity.originRepository;
      if (!repository && origins.length === 1) {
        repository = origins[0].repository;
      }
      if (repository) {
        principalAssignments.set(entity.name, repository);
      }
    });

    // Create one group per selected store
    selectedStores.forEach((storeId, index) => {
      // Buscar en las conexiones de GraphQL
      const connection = graphqlConnections.find(c => c.id === storeId);
      if (!connection) return;

      const assignments = new Map(principalAssignments); // Copy assignments

      const newGroup: Scenario = {
        id: index + 1, // Start from 1 (no principal group in this mode)
        name: `Tienda: ${connection.repository || connection.clientId}`,
        isReadOnly: false,
        assignments,
        storeFilter: storeId // Track which store this group is for
      };

      newGroups.push(newGroup);
    });

    // Replace all scenarios with store-based groups
    this.configService.updateScenarios(newGroups);
  }

  // Helper to get the full Origin object for display purposes
  getOriginForEntityInScenario(entity: Entity, scenario: Scenario): Origin | undefined {
    const repoName = scenario.assignments.get(entity.name);
    if (!repoName) {
      return undefined;
    }
    return this.allOrigins().find(o => o.repository === repoName);
  }

  // Handles dropping a connection onto an entity in a specific scenario
  drop(event: CdkDragDrop<any>, entity: Entity, scenario: Scenario): void {
    if (scenario.isReadOnly) {
      return; // Do not allow dropping on the principal group
    }

    const draggedOrigin: Origin = event.item.data;

    // Update the assignments for the specific scenario
    const newScenarios = this.scenarios().map(s => {
      if (s.id === scenario.id) {
        const newAssignments = new Map(s.assignments);
        newAssignments.set(entity.name, draggedOrigin.repository);
        return { ...s, assignments: newAssignments };
      }
      return s;
    });
    this.configService.updateScenarios(newScenarios);
  }

  // Generate a unique ID for each drop list
  getDropListId(scenario: Scenario, entity: Entity): string {
    return `scenario-${scenario.id}-entity-${entity.name}`;
  }

  // Get all drop list IDs for connecting the palette
  getAllDropListIds(): string[] {
    const ids: string[] = [];
    this.scenarios().forEach(scenario => {
      if (!scenario.isReadOnly) {
        this.allEntities().forEach(entity => {
          ids.push(this.getDropListId(scenario, entity));
        });
      }
    });
    return ids;
  }

  // The step is valid if all entities in the principal scenario have an assigned connection.
  isValid(): boolean {
    const principalScenario = this.scenarios()[0]; // Assuming principal is always the first
    if (!principalScenario) {
        return false; // Should not happen if initialized correctly
    }
    return this.allEntities().every(entity => principalScenario.assignments.has(entity.name));
  }
}
