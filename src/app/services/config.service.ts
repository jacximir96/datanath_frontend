import { Injectable, signal, computed } from '@angular/core';
import { DataConfiguration, Origin, Entity, Target, Transformation, Template, ClientConfig, SavedConfiguration, EntityGroup, StoreItem } from '../models/config.model';

// Represents a scenario, which the user calls a "Group"
export interface Scenario {
  id: number;
  name: string;
  isReadOnly: boolean;
  assignments: Map<string, string>; // Map<entityName, originRepository>
  _assignmentsArray?: Array<[string, string]>; // Serialized version for signal storage
  storeFilter?: string; // NEW: ID of store to filter by (for store-based groups)
}

@Injectable({
  providedIn: 'root'
})
export class ConfigService {
  private configSignal = signal<DataConfiguration>({
    clients: [], // Changed from client: '' to support multiple clients
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
  private storeCatalogSignal = signal<StoreItem[]>([]);
  private graphqlConnectionsSignal = signal<any[]>([]);
  private currentLoadedConfigIdSignal = signal<string | null>(null);

  config = this.configSignal.asReadonly();
  templates = this.templatesSignal.asReadonly();
  clientConfigs = this.clientConfigsSignal.asReadonly();
  savedConfigs = this.savedConfigsSignal.asReadonly();
  storeCatalog = this.storeCatalogSignal.asReadonly();
  graphqlConnections = this.graphqlConnectionsSignal.asReadonly();
  currentLoadedConfigId = this.currentLoadedConfigIdSignal.asReadonly();

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

  setPrincipalScenario(principalScenario: Scenario) {
    const serializedPrincipal = {
      ...principalScenario,
      _assignmentsArray: Array.from(principalScenario.assignments.entries())
    };
  
    this.scenariosSignal.update(currentScenarios => {
      const otherScenarios = currentScenarios.filter(s => !s.isReadOnly);
      return [serializedPrincipal, ...otherScenarios];
    });
  }

  // Updated methods to handle multiple clients
  updateClients(clients: string[]) {
    this.configSignal.update(config => ({ ...config, clients }));
  }

  addClient(clientName: string) {
    this.configSignal.update(config => ({
      ...config,
      clients: [...config.clients, clientName]
    }));
  }

  removeClient(clientName: string) {
    this.configSignal.update(config => ({
      ...config,
      clients: config.clients.filter(c => c !== clientName)
    }));
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

    // Migration logic: convert old 'client' (string) to 'clients' (array)
    if ((config as any).client && typeof (config as any).client === 'string') {
      config.clients = [(config as any).client];
      delete (config as any).client;
    } else if (!config.clients) {
      config.clients = [];
    }

    this.configSignal.set(config);
  }

  getConfiguration(): DataConfiguration {
    return this.configSignal();
  }

    resetConfiguration() {

      this.configSignal.set({

        clients: [], // Changed from client: ''

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

  

    public transformEntityForExport(e: Entity): Entity {

      // Create a deep copy to avoid modifying the original signal state

      const entityToExport: Entity = JSON.parse(JSON.stringify(e));



      if (entityToExport.filters) {

        entityToExport.filters.forEach(filter => {

          if (filter.isDynamic && filter.dynamicSource) {

            filter.value = `\${${filter.dynamicSource.entityName}.${filter.dynamicSource.fieldName}}`;

            delete filter.isDynamic;

            delete filter.dynamicSource;

          }

        });

      }

      // Filter properties to avoid duplicates (parent array vs specific fields)
      // If "items" is selected, don't include "items.menu_description", etc.
      if (entityToExport.properties && entityToExport.properties.length > 0) {
        const propertyNames = entityToExport.properties.map(p => p.name);

        // Remove entity name prefix to work with relative names
        const entityPrefix = `${entityToExport.name}.`;
        const relativeNames = propertyNames.map(name =>
          name.startsWith(entityPrefix) ? name.substring(entityPrefix.length) : name
        );

        // Find parent arrays (properties that have children in the list)
        const parentArrays = relativeNames.filter(name => {
          const hasChildren = relativeNames.some(otherName =>
            otherName !== name && otherName.startsWith(name + '.')
          );
          return hasChildren;
        });

        // If there are parent arrays, remove their children
        if (parentArrays.length > 0) {
          entityToExport.properties = entityToExport.properties.filter(prop => {
            const relativeName = prop.name.startsWith(entityPrefix)
              ? prop.name.substring(entityPrefix.length)
              : prop.name;

            // Keep the parent array
            if (parentArrays.includes(relativeName)) {
              return true;
            }
            // Remove children of parent arrays
            return !parentArrays.some(parent => relativeName.startsWith(parent + '.'));
          });
        }
      }

      delete entityToExport.relations;

      delete entityToExport.originRepository;

      return entityToExport;

    }

    private transformTargetForExport(target: Target): any {
      // Create a deep copy to avoid modifying the original
      const exportedTarget = JSON.parse(JSON.stringify(target));

      // Si el adapter es blobStorage, agregar "format": "json" a cada entidad
      if (exportedTarget.connection.adapter === 'blobStorage') {
        exportedTarget.entities = exportedTarget.entities.map((entity: any) => ({
          name: entity.name,
          toName: entity.toName,
          format: 'json',
          properties: entity.properties,
          filters: entity.filters
        }));
      }

      return exportedTarget;
    }


    private autoGeneratePropertiesFromDynamicFilters(): any[] {
      const config = this.configSignal();
      const groups = config.entityGroups;

      if (!groups || groups.length === 0) {
        return [];
      }

      // Detect dynamic filters and build dependency graph
      const dependencies: Array<{ entity: string, dependsOn: string, field: string, targetField: string }> = [];
      const allEntityNames: string[] = [];

      groups.forEach(group => {
        group.entities.forEach(entity => {
          allEntityNames.push(entity.name);

          entity.filters?.forEach(filter => {
            if (filter.isDynamic && filter.dynamicSource) {
              dependencies.push({
                entity: entity.name,
                dependsOn: filter.dynamicSource.entityName,
                field: filter.name,
                targetField: filter.dynamicSource.fieldName
              });
            }
          });
        });
      });

      // Find base entity (the one that no other entity depends on, or has no dynamic filters)
      const dependentEntities = new Set(dependencies.map(d => d.entity));
      const baseEntity = allEntityNames.find(name => !dependentEntities.has(name)) || allEntityNames[0];

      // Build ON conditions from dependencies (empty if no dependencies)
      const onConditions = dependencies.map(dep => ({
        left: `${dep.dependsOn}.${dep.targetField}`,  // Principal/base entity
        right: `${dep.entity}.${dep.field}`,           // Dependent entity
        type: 'left' as const
      }));

      // Build entities list
      const entities = allEntityNames.map(name => ({ name }));

      // Build targets (all entities including base)
      const targets = [...allEntityNames];

      // Build merge config (always generate, even if on is empty)
      const merge = [{
        base: baseEntity,
        type: 'left' as const,
        targets: targets,
        on: onConditions // Will be empty array if no dependencies
      }];

      return [{
        entities,
        merge
      }];
    }

    exportJSON(): string {

      const config = this.configSignal();

      const scenarios = this.scenarios();



      // Apply transformation rules before exporting

      // Auto-generate properties from dynamic filters if they exist
      const autoGeneratedProperties = this.autoGeneratePropertiesFromDynamicFilters();

      const finalTransformation: any = {
        code: config.transformation.code,
        country: config.transformation.country,
        properties: autoGeneratedProperties.length > 0 ? autoGeneratedProperties : [],
        filter: config.transformation.filter
      };

      if (finalTransformation.code === 'T012') {
        // Solo aplicar filtro por defecto si no hay uno configurado
        if (!finalTransformation.filter || finalTransformation.filter.length === 0) {
          finalTransformation.filter = [
            { output_format: 'json', wrap_structure: {} }
          ];
        }
        // Si ya hay filtro configurado, mantenerlo (usa el wrap_structure del usuario)
      }

      // NEW: Detectar si hay escenarios basados en tiendas (store-based scenarios)
      const storeBasedScenarios = scenarios.filter(s => s.storeFilter);

      if (storeBasedScenarios.length > 0) {
        const multipleRequirements: any[] = [];
        const clientConfigs = this.clientConfigsSignal();
        const graphqlConnections = this.graphqlConnectionsSignal();
        const allEntities = (config.entityGroups || []).flatMap(group => group.entities || []);

        // Para cada escenario basado en tienda, generar un requerimiento completo
        storeBasedScenarios.forEach(scenario => {
          const storeId = scenario.storeFilter!;

          // Buscar en las conexiones de GraphQL
          const connection = graphqlConnections.find(c => c.id === storeId);

          if (!connection) {
            return;
          }

          // Mapear la conexión de GraphQL al formato de store
          const store = {
            id: connection.id,
            code: connection.clientId,
            name: connection.repository,
            description: connection.clientName
          };

          // Obtener el primer origin del scenario (usando assignments)
          const firstEntityName = allEntities[0]?.name;
          const repoName = firstEntityName ? scenario.assignments.get(firstEntityName) : null;
          const origin = repoName ? config.origins.find(o => o.repository === repoName) : null;

          if (!origin) {
            return;
          }

          // Verificar que el origin tenga storeFilterField configurado
          if (!origin.storeFilterField) {
            return;
          }

          // Crear origin con groupId = nombre del grupo
          const processedOrigin = {
            servidor: origin.servidor === 'localhost' ? 'host.docker.internal' : origin.servidor,
            puerto: origin.puerto,
            user: origin.user,
            password: origin.password,
            repository: origin.repository,
            adapter: origin.adapter,
            groupId: scenario.name  // Usar el nombre del grupo (ej: "Tienda: G008")
          };

          // Agrupar entidades por repository
          const entitiesByRepo = new Map<string, any[]>();
          const repositoryOrigins = new Map<string, any>();

          allEntities.forEach(e => {
            const repo = e.originRepository || origin.repository;

            // Exportar y agregar filtro automático de tienda
            const exportedEntity = this.transformEntityForExport(e);
            exportedEntity.filters = [
              ...(exportedEntity.filters || []),
              {
                name: origin.storeFilterField!,
                operator: 'equals',
                value: store.code
              }
            ];

            // Agrupar por repository
            if (!entitiesByRepo.has(repo)) {
              entitiesByRepo.set(repo, []);

              // Obtener el origin para este repository
              const repoOrigin = config.origins.find(o => o.repository === repo);
              if (repoOrigin) {
                repositoryOrigins.set(repo, {
                  servidor: repoOrigin.servidor === 'localhost' ? 'host.docker.internal' : repoOrigin.servidor,
                  puerto: repoOrigin.puerto,
                  user: repoOrigin.user,
                  password: repoOrigin.password,
                  repository: repoOrigin.repository,
                  adapter: repoOrigin.adapter,
                  groupId: scenario.name
                });
              }
            }

            entitiesByRepo.get(repo)!.push(exportedEntity);
          });

          // Crear arrays de origins y entitiesPattern
          const requirementOrigins: any[] = [];
          const requirementEntitiesPattern: any[] = [];

          let relativePos = 0;
          entitiesByRepo.forEach((entities, repo) => {
            const repoOrigin = repositoryOrigins.get(repo);
            if (repoOrigin) {
              requirementOrigins.push(repoOrigin);
              requirementEntitiesPattern.push({
                relativePosition: relativePos++,
                entities: entities
              });
            }
          });

          // Crear JSON individual para esta tienda
          const processedTarget = this.transformTargetForExport(config.target);

          // Si el target es blobStorage, usar el código de la tienda como toName
          if (processedTarget.connection?.adapter === 'blobStorage') {
            processedTarget.entities = processedTarget.entities.map((entity: any) => ({
              ...entity,
              toName: store.code  // Solo el código de la tienda (G008, G009, etc.)
            }));
          }

          const requirement = {
            client: config.clients.join(','),
            origins: requirementOrigins,
            entitiesPattern: requirementEntitiesPattern,
            transformation: finalTransformation,
            target: processedTarget
          };

          multipleRequirements.push(requirement);
        });

        // Retornar múltiples JSONs separados por "---REQUIREMENT---"
        return multipleRequirements.map(req => JSON.stringify(req, null, 2)).join('\n\n---REQUIREMENT---\n\n');
      }

      // Detectar si hay separación por tiendas (nuevo modelo - LEGACY)
      const storesWithInternalStores = config.origins.filter(o =>
        o._internalStores && o._internalStores.storeIds.length > 0
      );

      // Si hay separación por tiendas, generar múltiples JSONs (uno por tienda)
      if (storesWithInternalStores.length > 0) {
        const multipleRequirements: any[] = [];

        // Iterar por cada store con separación de tiendas
        storesWithInternalStores.forEach(store => {
          // Generar un JSON por cada tienda en el array storeIds
          store._internalStores!.storeIds.forEach(storeId => {
            // Crear origin para este requerimiento
            const processedOrigin = {
              servidor: store.servidor === 'localhost' ? 'host.docker.internal' : store.servidor,
              puerto: store.puerto,
              user: store.user,
              password: store.password,
              repository: store.repository,
              adapter: store.adapter,
              groupId: storeId  // Usar el ID de la tienda como groupId
            };

            // Obtener las entidades de todos los entityGroups
            const allEntities = (config.entityGroups || []).flatMap(group => group.entities || []);

            // Crear entitiesPattern con filtro automático de tienda
            const entities = allEntities.map(e => {
              const exportedEntity = this.transformEntityForExport(e);

              // Agregar filtro automático de tienda con operator "equals"
              exportedEntity.filters = [
                ...(exportedEntity.filters || []),
                {
                  name: store._internalStores!.filterField,
                  operator: 'equals',
                  value: storeId
                }
              ];

              return exportedEntity;
            });

            // Crear JSON individual para esta tienda
            const requirement = {
              client: config.clients.join(','),
              origins: [processedOrigin],  // Solo 1 origin
              entitiesPattern: [{
                relativePosition: 0,  // Siempre 0 porque es un solo grupo por JSON
                entities: entities
              }],
              transformation: finalTransformation,
              target: this.transformTargetForExport(config.target)
            };

            multipleRequirements.push(requirement);
          });
        });

        // Retornar múltiples JSONs separados por "---REQUIREMENT---"
        return multipleRequirements.map(req => JSON.stringify(req, null, 2)).join('\n\n---REQUIREMENT---\n\n');
      }

      // Conditional logic for multi-group scenarios

      if (scenarios.length > 1) {

        const allMasterOrigins = config.origins;
        const newOrigins: any[] = [];
        const entitiesPattern: any[] = [];

        // Crear un origin por cada combinación de (repository, scenario)
        // y construir entitiesPattern en el mismo orden
        const repositoryScenarioToIndex = new Map<string, number>();

        // Generar origins para TODOS los grupos
        scenarios.forEach(scenario => {
          // Para CADA entidad asignada en este scenario, crear un origin individual
          scenario.assignments.forEach((repoName, entityName) => {
            const origin = allMasterOrigins.find(o => o.repository === repoName);
            if (origin) {
              // Crear origin para esta entidad específica
              const processedOrigin: any = {
                servidor: origin.servidor === 'localhost' ? 'host.docker.internal' : origin.servidor,
                puerto: origin.puerto,
                user: origin.user,
                password: origin.password,
                repository: origin.repository,
                adapter: origin.adapter,
                groupId: scenario.name
              };

              newOrigins.push(processedOrigin);
            }
          });
        });

        // Generar entitiesPattern SOLO para el Grupo Principal (primer scenario)
        const principalScenario = scenarios[0];
        if (principalScenario) {
          let relativePos = 0;
          principalScenario.assignments.forEach((repoName, entityName) => {
            // Buscar la entidad correspondiente
            const entity = config.entityGroups
              .flatMap(g => g.entities)
              .find(e => e.name === entityName);

            if (entity) {
              // Crear entry en entitiesPattern con UNA SOLA entidad
              entitiesPattern.push({
                relativePosition: relativePos++,
                entities: [this.transformEntityForExport(entity)]
              });
            }
          });
        }



        const exportConfig: any = {

          client: config.clients.join(','), // Concatenate clients as a single string

          origins: newOrigins,

          entitiesPattern: entitiesPattern,

          transformation: finalTransformation,

          target: this.transformTargetForExport(config.target)

        };



        return JSON.stringify(exportConfig, null, 2);



      } else {

        // Original behavior for single-group scenario

        const cleanEntities = (config.entityGroups || []).flatMap(group =>

          group.entities.map(e => this.transformEntityForExport(e))

        );



        // Reemplazar localhost por host.docker.internal en origins
        // Excluir campos internos (_internal*)
        const processedOrigins = config.origins.map(origin => ({
          servidor: origin.servidor === 'localhost' ? 'host.docker.internal' : origin.servidor,
          puerto: origin.puerto,
          user: origin.user,
          password: origin.password,
          repository: origin.repository,
          adapter: origin.adapter
        }));

        const exportConfig: any = {

          client: config.clients.join(','), // Concatenate clients as a single string

          origins: processedOrigins,

        entities: cleanEntities,

          transformation: finalTransformation,

          target: this.transformTargetForExport(config.target)

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
      this.configSignal.update(config => {
        // Add client if not already in the list
        const clients = config.clients.includes(clientConfig.name)
          ? config.clients
          : [...config.clients, clientConfig.name];

        // Add origins from this client
        const newOrigins = clientConfig.stores.filter(store =>
          !config.origins.some(o =>
            o.servidor === store.servidor &&
            o.puerto === store.puerto &&
            o.repository === store.repository
          )
        );

        return {
          ...config,
          clients,
          origins: [...config.origins, ...newOrigins]
        };
      });
    }
  }

  // Store Catalog management
  addStoreToCatalog(store: StoreItem) {
    this.storeCatalogSignal.update(stores => [...stores, store]);
    this.saveStoreCatalogToLocalStorage();
  }

  updateStoreInCatalog(id: string, store: StoreItem) {
    this.storeCatalogSignal.update(stores =>
      stores.map(s => s.id === id ? store : s)
    );
    this.saveStoreCatalogToLocalStorage();
  }

  deleteStoreFromCatalog(id: string) {
    this.storeCatalogSignal.update(stores =>
      stores.filter(s => s.id !== id)
    );
    this.saveStoreCatalogToLocalStorage();
  }

  getStoreById(id: string): StoreItem | undefined {
    return this.storeCatalogSignal().find(s => s.id === id);
  }

  getStoresByIds(ids: string[]): StoreItem[] {
    return this.storeCatalogSignal().filter(s => ids.includes(s.id));
  }

  private saveStoreCatalogToLocalStorage() {
    localStorage.setItem('storeCatalog', JSON.stringify(this.storeCatalogSignal()));
  }

  loadStoreCatalogFromLocalStorage() {
    const stored = localStorage.getItem('storeCatalog');
    if (stored) {
      try {
        const stores = JSON.parse(stored);
        this.storeCatalogSignal.set(stores);
      } catch (error) {
        console.error('Error loading store catalog from localStorage:', error);
      }
    }
  }

  // GraphQL Connections management
  setGraphqlConnections(connections: any[]) {
    this.graphqlConnectionsSignal.set(connections);
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
    const scenarios = this.scenariosSignal(); // Obtener escenarios actuales

    const savedConfig: SavedConfiguration = {
      id: Date.now().toString(),
      name,
      description,
      config: { ...config },
      scenarios: scenarios.map(s => ({
        id: s.id,
        name: s.name,
        isReadOnly: s.isReadOnly,
        assignments: s._assignmentsArray || [],
        storeFilter: s.storeFilter
      })),
      createdAt: new Date().toISOString()
    };
    this.savedConfigsSignal.update(configs => [...configs, savedConfig]);
    this.saveSavedConfigsToLocalStorage();

    // Establecer como la configuración cargada actualmente
    this.currentLoadedConfigIdSignal.set(savedConfig.id);

    return savedConfig;
  }

  loadSavedConfiguration(id: string): void {
    const savedConfig = this.savedConfigsSignal().find(c => c.id === id);
    if (savedConfig) {
      this.configSignal.set({ ...savedConfig.config });

      // Cargar escenarios si existen
      if (savedConfig.scenarios && savedConfig.scenarios.length > 0) {
        const loadedScenarios = savedConfig.scenarios.map(s => ({
          id: s.id,
          name: s.name,
          isReadOnly: s.isReadOnly,
          assignments: new Map(s.assignments),
          _assignmentsArray: s.assignments,
          storeFilter: s.storeFilter
        }));
        this.scenariosSignal.set(loadedScenarios);
      }

      // Guardar el ID de la configuración cargada
      this.currentLoadedConfigIdSignal.set(id);

      // Actualizar lastUsed
      this.updateSavedConfigLastUsed(id);
    }
  }

  updateConfiguration(id: string, name: string, description: string): SavedConfiguration | null {
    const config = this.configSignal();
    const scenarios = this.scenariosSignal();

    const existingConfigIndex = this.savedConfigsSignal().findIndex(c => c.id === id);
    if (existingConfigIndex === -1) {
      return null; // Config not found
    }

    const updatedConfig: SavedConfiguration = {
      id, // Mantener el mismo ID
      name,
      description,
      config: { ...config },
      scenarios: scenarios.map(s => ({
        id: s.id,
        name: s.name,
        isReadOnly: s.isReadOnly,
        assignments: s._assignmentsArray || [],
        storeFilter: s.storeFilter
      })),
      createdAt: this.savedConfigsSignal()[existingConfigIndex].createdAt, // Mantener fecha de creación
      lastUsed: new Date().toISOString() // Actualizar lastUsed
    };

    this.savedConfigsSignal.update(configs =>
      configs.map((c, idx) => idx === existingConfigIndex ? updatedConfig : c)
    );
    this.saveSavedConfigsToLocalStorage();
    return updatedConfig;
  }

  clearCurrentLoadedConfig(): void {
    this.currentLoadedConfigIdSignal.set(null);
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
