import { Component, inject, computed, signal, effect } from '@angular/core';
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
export class ConnectionGroupsStepComponent {
  protected configService = inject(ConfigService);

  readonly scenarios = this.configService.scenarios;
  
  readonly allEntities = computed(() => 
    this.configService.config().entityGroups.flatMap(group => group.entities)
  );
  
  readonly allOrigins = computed(() => this.configService.config().origins);

  constructor() {
    // Re-enable effect to react to data changes from other steps.
    effect(() => {
      this.updatePrincipalScenario();
    }, { allowSignalWrites: true });
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
