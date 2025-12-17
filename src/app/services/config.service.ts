import { Injectable, signal, computed } from '@angular/core';
import { DataConfiguration, Origin, Entity, Target, Transformation, Template, ClientConfig, SavedConfiguration, EntityGroup } from '../models/config.model';

// Represents a scenario, which the user calls a "Group"
export interface Scenario {
  id: number;
  name: string;
  isReadOnly: boolean;
  assignments: Map<string, string>; // Map<entityName, originRepository>
  _assignmentsArray?: Array<[string, string]>; // Serialized version for signal storage
}

@Injectable({
  providedIn: 'root'
})
export class ConfigService {
  private configSignal = signal<DataConfiguration>({
    client: '',
    origins: [],
    entities: [],
    entityGroups: [], // Initialize new property
    transformation: {
      code: '',
      country: '',
      filter: []
    },
    target: {
      connection: {
        server: '',
        port: '',
        user: '',
        password: '',
        repository: '',
        adapter: ''
      },
      entities: []
    }
  });

  private templatesSignal = signal<Template[]>([]);
  private clientConfigsSignal = signal<ClientConfig[]>([]);
  private savedConfigsSignal = signal<SavedConfiguration[]>([]);
  private scenariosSignal = signal<Scenario[]>([]);

  config = this.configSignal.asReadonly();
  templates = this.templatesSignal.asReadonly();
  clientConfigs = this.clientConfigsSignal.asReadonly();
  savedConfigs = this.savedConfigsSignal.asReadonly();

  // Computed signal that deserializes Maps from arrays
  scenarios = computed(() => {
    return this.scenariosSignal().map(scenario => ({
      ...scenario,
      assignments: new Map(scenario._assignmentsArray || [])
    }));
  });

  updateScenarios(scenarios: Scenario[]) {
    // Serialize Maps to arrays before storing in signal
    const serializedScenarios = scenarios.map(scenario => ({
      ...scenario,
      _assignmentsArray: Array.from(scenario.assignments.entries())
    }));
    this.scenariosSignal.set(serializedScenarios);
  }

  updateClient(client: string) {
    this.configSignal.update(config => ({ ...config, client }));
  }

  updateOrigins(origins: Origin[]) {
    this.configSignal.update(config => ({ ...config, origins }));
  }

  addOrigin(origin: Origin) {
    this.configSignal.update(config => ({
      ...config,
      origins: [...config.origins, origin]
    }));
  }

  removeOrigin(index: number) {
    this.configSignal.update(config => ({
      ...config,
      origins: config.origins.filter((_, i) => i !== index)
    }));
  }

  updateOrigin(index: number, origin: Origin) {
    this.configSignal.update(config => ({
      ...config,
      origins: config.origins.map((o, i) => i === index ? origin : o)
    }));
  }

  // ===== START: NEW GROUP-BASED ENTITY MANAGEMENT =====
  addEntityGroup(group: EntityGroup) {
    this.configSignal.update(config => ({
      ...config,
      entityGroups: [...(config.entityGroups || []), group]
    }));
  }

  removeEntityGroup(index: number) {
    this.configSignal.update(config => ({
      ...config,
      entityGroups: (config.entityGroups || []).filter((_, i) => i !== index)
    }));
  }

  updateEntityGroup(index: number, group: EntityGroup) {
    this.configSignal.update(config => ({
      ...config,
      entityGroups: (config.entityGroups || []).map((g, i) => i === index ? group : g)
    }));
  }
  // ===== END: NEW GROUP-BASED ENTITY MANAGEMENT =====

  // LEGACY entity methods - keep for now for other parts of the app if needed
  addEntity(entity: Entity) {
    this.configSignal.update(config => ({
      ...config,
      entities: [...config.entities, entity]
    }));
  }

  removeEntity(index: number) {
    this.configSignal.update(config => ({
      ...config,
      entities: config.entities.filter((_, i) => i !== index)
    }));
  }

  updateTransformation(transformation: Transformation) {
    this.configSignal.update(config => ({
      ...config,
      transformation
    }));
  }

  updateTarget(target: Target) {
    this.configSignal.update(config => ({ ...config, target }));
  }

  loadConfiguration(config: DataConfiguration) {
    // Migration logic for old format
    if (config.entities && config.entities.length > 0 && (!config.entityGroups || config.entityGroups.length === 0)) {
      const migratedGroups: EntityGroup[] = config.entities.map(entity => ({
        name: entity.name,
        type: 'Modelo',
        entities: [entity]
      }));
      config.entityGroups = migratedGroups;
    } else if (!config.entityGroups) {
      config.entityGroups = [];
    }

    this.configSignal.set(config);
  }

  getConfiguration(): DataConfiguration {
    return this.configSignal();
  }

  resetConfiguration() {
    this.configSignal.set({
      client: '',
      origins: [],
      entities: [],
      entityGroups: [],
      transformation: {
        code: '',
        country: '',
        filter: []
      },
      target: {
        connection: {
          server: '',
          port: '',
          user: '',
          password: '',
          repository: '',
          adapter: ''
        },
        entities: []
      }
    });
  }

  exportJSON(): string {
    const config = this.configSignal();
    const scenarios = this.scenarios();

    // Conditional logic for multi-group scenarios
    if (scenarios.length > 1) {
      const newOrigins: any[] = [];
      const allMasterOrigins = config.origins;

      scenarios.forEach(scenario => {
        scenario.assignments.forEach((repoName, entityName) => {
          const origin = allMasterOrigins.find(o => o.repository === repoName);
          if (origin) {
            // Create a copy of the origin and add the groupId
            newOrigins.push({
              ...origin,
              groupId: scenario.name
            });
          }
        });
      });

      // Create entitiesPattern from entityGroups
      const entitiesPattern = config.entityGroups.map((group, index) => ({
        relativePosition: index,
        entities: group.entities.map(e => {
          // Return a clean entity object without internal properties
          const { relations, originRepository, ...cleanEntity } = e;
          return cleanEntity;
        })
      }));

      // Build export config in the correct order
      const exportConfig: any = {
        client: config.client,
        origins: newOrigins,
        entitiesPattern: entitiesPattern,
        transformation: config.transformation,
        target: config.target
      };

      return JSON.stringify(exportConfig, null, 2);

    } else {
      // Original behavior for single-group scenario
      const cleanEntities = (config.entityGroups || []).flatMap(group =>
        group.entities.map(e => {
          const { relations, originRepository, ...cleanEntity } = e;
          return cleanEntity;
        })
      );

      // Build export config in the correct order
      const exportConfig: any = {
        client: config.client,
        origins: config.origins,
        entities: cleanEntities,
        transformation: config.transformation,
        target: config.target
      };

      return JSON.stringify(exportConfig, null, 2);
    }
  }

  importJSON(jsonString: string): boolean {
    try {
      const config = JSON.parse(jsonString);
      this.loadConfiguration(config);
      return true;
    } catch (error) {
      console.error('Error parsing JSON:', error);
      return false;
    }
  }

  // Template management
  saveTemplate(name: string, description: string) {
    const config = this.configSignal();
    const allEntities = (config.entityGroups || []).flatMap(group => group.entities);

    const template: Template = {
      id: Date.now().toString(),
      name,
      description,
      entities: allEntities,
      transformation: config.transformation,
      targetFormat: 'json'
    };
    this.templatesSignal.update(templates => [...templates, template]);
    this.saveTemplatesToLocalStorage();
  }

  loadTemplate(templateId: string) {
    const template = this.templatesSignal().find(t => t.id === templateId);
    if (template && template.entities) {
      // Convert flat list from template into groups
      const newGroups: EntityGroup[] = template.entities.map(entity => ({
          name: entity.name,
          type: 'Modelo',
          entities: [entity],
      }));

      this.configSignal.update(config => ({
        ...config,
        entityGroups: newGroups, // Load as groups
        entities: [], // Clear legacy field
        transformation: template.transformation
      }));
    }
  }

  deleteTemplate(templateId: string) {
    this.templatesSignal.update(templates =>
      templates.filter(t => t.id !== templateId)
    );
    this.saveTemplatesToLocalStorage();
  }

  private saveTemplatesToLocalStorage() {
    localStorage.setItem('datanath_templates', JSON.stringify(this.templatesSignal()));
  }

  loadTemplatesFromLocalStorage() {
    const stored = localStorage.getItem('datanath_templates');
    if (stored) {
      try {
        const templates = JSON.parse(stored);
        this.templatesSignal.set(templates);
      } catch (error) {
        console.error('Error loading templates:', error);
      }
    }
  }

  // Client Configuration management
  addClientConfig(clientConfig: ClientConfig) {
    this.clientConfigsSignal.update(configs => [...configs, clientConfig]);
    this.saveClientConfigsToLocalStorage();
  }

  updateClientConfig(id: string, clientConfig: ClientConfig) {
    this.clientConfigsSignal.update(configs =>
      configs.map(c => c.id === id ? clientConfig : c)
    );
    this.saveClientConfigsToLocalStorage();
  }

  deleteClientConfig(id: string) {
    this.clientConfigsSignal.update(configs =>
      configs.filter(c => c.id !== id)
    );
    this.saveClientConfigsToLocalStorage();
  }

  loadClientConfig(id: string) {
    const clientConfig = this.clientConfigsSignal().find(c => c.id === id);
    if (clientConfig) {
      this.configSignal.update(config => ({
        ...config,
        client: clientConfig.name,
        origins: clientConfig.stores
      }));
    }
  }

  private saveClientConfigsToLocalStorage() {
    localStorage.setItem('datanath_client_configs', JSON.stringify(this.clientConfigsSignal()));
  }

  loadClientConfigsFromLocalStorage() {
    const stored = localStorage.getItem('datanath_client_configs');
    if (stored) {
      try {
        const configs = JSON.parse(stored);
        this.clientConfigsSignal.set(configs);
      } catch (error) {
        console.error('Error loading client configs:', error);
      }
    }
  }

  // Saved Configuration management
  saveConfiguration(name: string, description: string): SavedConfiguration {
    const config = this.configSignal();
    const savedConfig: SavedConfiguration = {
      id: Date.now().toString(),
      name,
      description,
      config: { ...config },
      createdAt: new Date().toISOString()
    };
    this.savedConfigsSignal.update(configs => [...configs, savedConfig]);
    this.saveSavedConfigsToLocalStorage();
    return savedConfig;
  }

  loadSavedConfiguration(id: string): void {
    const savedConfig = this.savedConfigsSignal().find(c => c.id === id);
    if (savedConfig) {
      this.configSignal.set({ ...savedConfig.config });
      // Actualizar lastUsed
      this.updateSavedConfigLastUsed(id);
    }
  }

  deleteSavedConfiguration(id: string): void {
    this.savedConfigsSignal.update(configs =>
      configs.filter(c => c.id !== id)
    );
    this.saveSavedConfigsToLocalStorage();
  }

  private updateSavedConfigLastUsed(id: string): void {
    this.savedConfigsSignal.update(configs =>
      configs.map(c =>
        c.id === id
          ? { ...c, lastUsed: new Date().toISOString() }
          : c
      )
    );
    this.saveSavedConfigsToLocalStorage();
  }

  private saveSavedConfigsToLocalStorage(): void {
    localStorage.setItem('datanath_saved_configs', JSON.stringify(this.savedConfigsSignal()));
  }

  loadSavedConfigsFromLocalStorage(): void {
    const stored = localStorage.getItem('datanath_saved_configs');
    if (stored) {
      try {
        const configs = JSON.parse(stored);
        this.savedConfigsSignal.set(configs);
      } catch (error) {
        console.error('Error loading saved configs:', error);
      }
    }
  }
}
