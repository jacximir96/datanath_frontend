import { Component, inject, computed, signal, effect, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ConfigService, Scenario } from '../../services/config.service';
import { Origin, Entity } from '../../models/config.model';
import { MatCardModule } from '@angular/material/card';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatTooltipModule } from '@angular/material/tooltip';
import { CdkDrag, CdkDropList, CdkDragDrop } from '@angular/cdk/drag-drop';

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

  readonly scenarios = this.configService.scenarios;

  readonly allEntities = computed(() =>
    this.configService.config().entityGroups.flatMap(group => group.entities)
  );

  readonly allOrigins = computed(() => this.configService.config().origins);

  private lastEntityCount = 0;
  private lastMaxConnections = 0;

  constructor() {
    // Re-enable effect to react to data changes from other steps.
    effect(() => {
      this.updatePrincipalScenario();

      // Only recreate automatic scenarios if entities or connections changed
      const currentEntityCount = this.allEntities().length;
      const currentMaxConnections = this.calculateMaxConnections();

      if (currentEntityCount !== this.lastEntityCount ||
          currentMaxConnections !== this.lastMaxConnections) {
        this.lastEntityCount = currentEntityCount;
        this.lastMaxConnections = currentMaxConnections;
        this.createAutomaticScenarios();
      }
    }, { allowSignalWrites: true });
  }

  ngOnInit(): void {
    // Initialize on component load
    this.lastEntityCount = this.allEntities().length;
    this.lastMaxConnections = this.calculateMaxConnections();
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
    const entities = this.allEntities();
    const clientConfigs = this.configService.clientConfigs();

    // Map each entity to its client and get connection counts
    const entityClientMap = new Map<string, { clientName: string, connectionCount: number }>();
    let maxConnections = 1; // At least 1 (the principal group)

    entities.forEach(entity => {
      if (!entity.originRepository) return;

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
    for (let i = 2; i <= maxConnections; i++) {
      const assignments = new Map<string, string>();

      entities.forEach(entity => {
        const entityClient = entityClientMap.get(entity.name);
        if (!entityClient) return;

        // Find the client config
        const client = clientConfigs.find(c => c.name === entityClient.clientName);
        if (!client) return;

        // Assign the i-th connection if it exists, otherwise use the last available
        const connectionIndex = Math.min(i - 1, client.stores.length - 1);
        const connection = client.stores[connectionIndex];

        if (connection) {
          assignments.set(entity.name, connection.repository);
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

    // Only update if the number of scenarios changed (prevent unnecessary updates)
    if (currentScenarios.length !== newScenarios.length) {
      this.configService.updateScenarios(newScenarios);
    }
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

    const currentScenarios = this.scenarios();
    const updatedScenarios = currentScenarios.filter(s => s.id !== scenario.id);
    this.configService.updateScenarios(updatedScenarios);
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
