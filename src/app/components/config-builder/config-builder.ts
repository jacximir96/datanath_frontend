import { Component, inject, ViewChild } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatStepper, MatStepperModule } from '@angular/material/stepper';
import { MatButtonModule } from '@angular/material/button';
import { MatToolbarModule } from '@angular/material/toolbar';
import { MatIconModule } from '@angular/material/icon';
import { MatCardModule } from '@angular/material/card';

import { ClientStepComponent } from '../client-step/client-step';
import { OriginsStepComponent } from '../origins-step/origins-step';
import { EntitiesStepComponent } from '../entities-step/entities-step';
import { TransformationStepComponent } from '../transformation-step/transformation-step';
import { TargetStepComponent } from '../target-step/target-step';
import { SummaryStepComponent } from '../summary-step/summary-step';
import { ConnectionGroupsStepComponent } from '../connection-groups-step/connection-groups-step';
import { ConfigService } from '../../services/config.service';

@Component({
  selector: 'app-config-builder',
  standalone: true,
  imports: [
    CommonModule,
    MatStepperModule,
    MatButtonModule,
    MatToolbarModule,
    MatIconModule,
    MatCardModule,
    ClientStepComponent,
    OriginsStepComponent,
    EntitiesStepComponent,
    TransformationStepComponent,
    TargetStepComponent,
    ConnectionGroupsStepComponent,
    SummaryStepComponent
  ],
  templateUrl: './config-builder.html',
  styleUrl: './config-builder.css',
})
export class ConfigBuilderComponent {
  protected configService = inject(ConfigService);

  @ViewChild('stepper') stepper!: MatStepper;

  resetConfiguration() {
    if (confirm('¿Está seguro de que desea reiniciar toda la configuración?')) {
      this.configService.resetConfiguration();
    }
  }

  resetAll() {
    if (confirm('⚠️ ¿Está seguro de que desea reiniciar TODO? Se borrarán:\n\n• Clientes seleccionados\n• Orígenes configurados\n• Entidades seleccionadas\n• Transformaciones\n• Destino\n• Grupos de conexión\n\nEsta acción NO se puede deshacer.')) {
      // Reset configuration (clients, origins, entities, transformation, target)
      this.configService.resetConfiguration();

      // Reset scenarios (connection groups)
      this.configService.updateScenarios([]);

      // Reset stepper to first step
      this.stepper.reset();
    }
  }
}
