import { Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { MatCardModule } from '@angular/material/card';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatChipsModule } from '@angular/material/chips';
import { ConfigService } from '../../services/config.service';
import { TargetEntity } from '../../models/config.model';

@Component({
  selector: 'app-target-step',
  standalone: true,
  imports: [
    CommonModule, FormsModule, MatCardModule, MatFormFieldModule,
    MatInputModule, MatSelectModule, MatButtonModule, MatIconModule,
    MatChipsModule
  ],
  templateUrl: './target-step.html',
  styleUrl: './target-step.css',
})
export class TargetStepComponent {
  protected configService = inject(ConfigService);
  newTargetEntity = signal<TargetEntity>({
    name: '',
    toName: '',
    properties: [],
    filters: []
  });

  // Property fields
  newPropertyName = '*';
  newPropertyType = 'text';

  dataTypes = ['text', 'number', 'date', 'boolean'];
  adapters = ['SqlServerSP', 'MySQL', 'PostgreSQL', 'Oracle', 'SqlServerTrust', 'SqlServer', 'MongoLocal', 'MongoSrv', 'blobStorage'];

  get target() {
    return this.configService.config().target;
  }

  updateConnection(field: string, value: string) {
    const target = this.target;
    this.configService.updateTarget({
      ...target,
      connection: { ...target.connection, [field]: value }
    });
  }

  addProperty() {
    if (this.newPropertyName) {
      const entity = this.newTargetEntity();
      entity.properties.push({
        name: this.newPropertyName,
        type: this.newPropertyType
      });
      this.newPropertyName = '*';
      this.newPropertyType = 'text';
    }
  }

  removeProperty(index: number) {
    const entity = this.newTargetEntity();
    entity.properties.splice(index, 1);
  }

  addTargetEntity() {
    const entity = this.newTargetEntity();
    if (entity.name) {
      const target = this.target;
      this.configService.updateTarget({
        ...target,
        entities: [...target.entities, { ...entity }]
      });
      this.newTargetEntity.set({
        name: '',
        toName: '',
        properties: [],
        filters: []
      });
    }
  }

  removeTargetEntity(index: number) {
    const target = this.target;
    this.configService.updateTarget({
      ...target,
      entities: target.entities.filter((_, i) => i !== index)
    });
  }

  isTargetEntityFormValid(): boolean {
    const entity = this.newTargetEntity();
    return !!entity.name;
  }

  isValid(): boolean {
    const connection = this.target.connection;

    // Server y adapter son siempre obligatorios
    if (!connection.server || !connection.adapter) {
      return false;
    }

    // Si hay SAS Token, no se requieren user, password, repository
    const hasSasToken = !!(connection.sasToken && connection.sasToken.trim());

    if (!hasSasToken) {
      // Si no hay SAS Token, se requieren user, password, repository
      if (!connection.password || !connection.repository) {
        return false;
      }
    }

    // Port es siempre opcional
    const hasEntities = this.target.entities.length > 0;
    return hasEntities;
  }
}
