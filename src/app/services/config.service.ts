import { Injectable, signal, computed, inject } from '@angular/core';
import { DataConfiguration, Origin, Entity, Target, Transformation, Template, ClientConfig, SavedConfiguration, EntityGroup, StoreItem } from '../models/config.model';
import { GraphqlService } from './graphql.service';
import { map, forkJoin, switchMap, of } from 'rxjs';

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
  private isLoadingClientConfigs = false;

  private graphqlService = inject(GraphqlService);

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

  // Client Configuration management (using GraphQL)
  private _createConnections(clientConfig: ClientConfig): Promise<void> {
    // Create one connection per store in the ClientConfig
    const connectionPromises = clientConfig.stores.map(store => {
      const input = {
        clientName: clientConfig.name,
        servidor: store.servidor,
        puerto: store.puerto,
        user: store.user,
        password: store.password,
        repository: store.repository,
        adapter: store.adapter,
        associatedStores: store.associatedStores || [],
        storeFilterField: store.storeFilterField || null
      };

      return this.graphqlService.createConnection(input).toPromise();
    });

    // Execute all connection creations
    return Promise.all(connectionPromises)
      .then(() => {
        console.log('Conexiones creadas exitosamente');
        // Reload client configs from GraphQL to update the signal
        this.loadClientConfigsFromGraphQL();
      });
  }

  addClientConfig(clientConfig: ClientConfig): void {
    // Check if this client already has connections in GraphQL
    const existingConnections = this.graphqlConnectionsSignal().filter(
      conn => conn.clientName === clientConfig.name
    );

    if (existingConnections.length > 0) {
      // Client already exists, update instead of creating duplicates
      console.log('Cliente ya existe, actualizando en lugar de crear duplicados...');
      const existingConfig = this.clientConfigsSignal().find(c => c.name === clientConfig.name);
      if (existingConfig) {
        this.updateClientConfig(existingConfig.id, clientConfig);
        return;
      }
    }

    // Create connections for new client
    this._createConnections(clientConfig)
      .then(() => {
        console.log('ClientConfig guardado exitosamente');
      })
      .catch(error => {
        console.error('Error al guardar ClientConfig:', error);
      });
  }

  updateClientConfig(id: string, clientConfig: ClientConfig): void {
    // First, delete all existing connections for this client
    const existingConfig = this.clientConfigsSignal().find(c => c.id === id);
    if (!existingConfig) {
      console.error('ClientConfig no encontrado:', id);
      return;
    }

    // Find all connections with this clientName and delete them
    const connectionsToDelete = this.graphqlConnectionsSignal().filter(
      conn => conn.clientName === existingConfig.name
    );

    const deletePromises = connectionsToDelete.map(conn =>
      this.graphqlService.deleteConnection(conn.id).toPromise()
    );

    Promise.all(deletePromises)
      .then(() => {
        // Now create new connections using the private method
        return this._createConnections(clientConfig);
      })
      .then(() => {
        console.log('ClientConfig actualizado exitosamente');
      })
      .catch(error => {
        console.error('Error al actualizar ClientConfig:', error);
      });
  }

  deleteClientConfig(id: string): void {
    const clientConfig = this.clientConfigsSignal().find(c => c.id === id);
    if (!clientConfig) {
      console.error('ClientConfig no encontrado:', id);
      return;
    }

    // Find all connections with this clientName and delete them
    const connectionsToDelete = this.graphqlConnectionsSignal().filter(
      conn => conn.clientName === clientConfig.name
    );

    const deletePromises = connectionsToDelete.map(conn =>
      this.graphqlService.deleteConnection(conn.id).toPromise()
    );

    Promise.all(deletePromises)
      .then(() => {
        console.log('ClientConfig eliminado exitosamente:', id);
        // Update the signal by removing this config
        this.clientConfigsSignal.update(configs =>
          configs.filter(c => c.id !== id)
        );
      })
      .catch(error => {
        console.error('Error al eliminar ClientConfig:', error);
      });
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

  loadClientConfigsFromGraphQL(): void {
    // Guard: evitar cargas múltiples simultáneas
    if (this.isLoadingClientConfigs) {
      console.log('⏸️ Ya hay una carga en proceso, ignorando...');
      return;
    }

    this.isLoadingClientConfigs = true;
    console.log('🔄 Iniciando carga de ClientConfigs y Connections...');
    console.time('⏱️ Total loadClientConfigsFromGraphQL');
    console.time('⏱️ GraphQL queries (backend)');

    // Cargar ClientConfigs y Connections en paralelo
    forkJoin({
      clientConfigs: this.graphqlService.getClientConfigs(),
      connections: this.graphqlService.getAllConnections()
    }).subscribe({
      next: ({ clientConfigs, connections }) => {
        console.timeEnd('⏱️ GraphQL queries (backend)');
        console.time('⏱️ Data processing (frontend)');

        const clientConfigsData = clientConfigs.data.getClientConfigs;
        const connectionsData = connections.data.getConnections.items;

        console.log(`📊 ClientConfigs encontrados: ${clientConfigsData.length}`);
        console.log(`📊 Connections encontradas: ${connectionsData.length}`);

        // Store all connections in the graphqlConnectionsSignal
        this.graphqlConnectionsSignal.set(connectionsData);

        // PRIMERO: Consolidar ClientConfigs duplicados (SIEMPRE)
        console.time('⏱️ Consolidation');
        this.consolidateDuplicateClientConfigs(clientConfigsData).subscribe({
          next: (result: { configs: any[], hadDuplicates: boolean }) => {
            console.timeEnd('⏱️ Consolidation');
            const consolidatedConfigs = result.configs;
            const hadDuplicates = result.hadDuplicates;

            console.log(`✅ Consolidación completada. ClientConfigs finales: ${consolidatedConfigs.length}`);

            // SEGUNDO: Detectar conexiones legacy (sin clientConfigId)
            const legacyConnectionsByClientName = new Map<string, any[]>();
            const modernConnections: any[] = [];

            connectionsData.forEach((conn: any) => {
              if (!conn.clientConfigId && conn.clientName) {
                // Conexión legacy sin clientConfigId
                if (!legacyConnectionsByClientName.has(conn.clientName)) {
                  legacyConnectionsByClientName.set(conn.clientName, []);
                }
                legacyConnectionsByClientName.get(conn.clientName)!.push(conn);
              } else if (conn.clientConfigId) {
                // Conexión moderna con clientConfigId
                modernConnections.push(conn);
              }
            });

            // Si hay conexiones legacy, migrarlas
            if (legacyConnectionsByClientName.size > 0) {
              console.log(`🔄 Migrando ${legacyConnectionsByClientName.size} clientes legacy...`);
              this.migrateLegacyConnectionsOnly(legacyConnectionsByClientName, consolidatedConfigs);
            } else {
              console.log('✅ No hay conexiones legacy, procesando normalmente...');
              console.log(`📦 Conexiones modernas (con clientConfigId): ${modernConnections.length}`);

              // Solo recargar si hubo consolidación, sino usar los datos actuales
              if (hadDuplicates) {
                console.log('🔄 Recargando datos después de consolidación...');
                this.reloadAfterConsolidation();
              } else {
                console.log('✅ No hubo cambios, usando datos actuales');
                console.time('⏱️ buildClientConfigsFromData');
                this.buildClientConfigsFromData(consolidatedConfigs, connectionsData);
                console.timeEnd('⏱️ buildClientConfigsFromData');
                console.timeEnd('⏱️ Data processing (frontend)');
                console.timeEnd('⏱️ Total loadClientConfigsFromGraphQL');
                this.isLoadingClientConfigs = false; // Liberar el flag
              }
            }
          },
          error: (consolidationError: any) => {
            console.error('❌ Error durante la consolidación:', consolidationError);
            console.timeEnd('⏱️ Data processing (frontend)');
            console.timeEnd('⏱️ Total loadClientConfigsFromGraphQL');
            this.isLoadingClientConfigs = false; // Liberar el flag en caso de error
          }
        });
      },
      error: (error) => {
        console.error('Error al cargar ClientConfigs desde GraphQL:', error);
        console.timeEnd('⏱️ GraphQL queries (backend)');
        console.timeEnd('⏱️ Total loadClientConfigsFromGraphQL');
        this.isLoadingClientConfigs = false; // Liberar el flag en caso de error
      }
    });
  }

  private reloadAfterConsolidation(): void {
    // Recargar datos después de consolidación, pero SIN consolidar de nuevo (evitar loop)
    console.log('🔄 Recargando datos después de consolidación...');
    console.time('⏱️ Reload after consolidation');
    forkJoin({
      clientConfigs: this.graphqlService.getClientConfigs(),
      connections: this.graphqlService.getAllConnections()
    }).subscribe({
      next: ({ clientConfigs, connections }) => {
        const clientConfigsData = clientConfigs.data.getClientConfigs;
        const connectionsData = connections.data.getConnections.items;
        console.log(`📊 Recarga: ClientConfigs: ${clientConfigsData.length}, Connections: ${connectionsData.length}`);
        this.graphqlConnectionsSignal.set(connectionsData);
        console.time('⏱️ buildClientConfigsFromData (reload)');
        this.buildClientConfigsFromData(clientConfigsData, connectionsData);
        console.timeEnd('⏱️ buildClientConfigsFromData (reload)');
        console.timeEnd('⏱️ Reload after consolidation');
        console.timeEnd('⏱️ Data processing (frontend)');
        console.timeEnd('⏱️ Total loadClientConfigsFromGraphQL');
        this.isLoadingClientConfigs = false; // Liberar el flag
      },
      error: (error) => {
        console.error('❌ Error al recargar después de consolidación:', error);
        console.timeEnd('⏱️ Reload after consolidation');
        console.timeEnd('⏱️ Data processing (frontend)');
        console.timeEnd('⏱️ Total loadClientConfigsFromGraphQL');
        this.isLoadingClientConfigs = false; // Liberar el flag en caso de error
      }
    });
  }

  private migrateLegacyConnectionsOnly(legacyConnectionsByClientName: Map<string, any[]>, consolidatedConfigs: any[]): void {
    // Migrar conexiones legacy (sin consolidación, eso ya se hizo)
    const migrationTasks: any[] = [];

    legacyConnectionsByClientName.forEach((connections, clientName) => {
      // Buscar si ya existe un ClientConfig con este nombre
      const existingConfig = consolidatedConfigs.find((cc: any) => cc.name === clientName);

      if (existingConfig) {
        // Ya existe, solo actualizar las conexiones
        console.log(`📌 ClientConfig ya existe para ${clientName}, actualizando conexiones...`);
        const updateTasks = connections.map((conn: any) => {
          const updateInput = {
            clientConfigId: existingConfig.id,
            clientName: conn.clientName,
            clientId: conn.clientId || '',
            servidor: conn.servidor,
            puerto: conn.puerto,
            user: conn.user,
            password: conn.password,
            repository: conn.repository,
            adapter: conn.adapter,
            associatedStores: conn.associatedStores || [],
            storeFilterField: conn.storeFilterField || null
          };
          return this.graphqlService.updateConnection(conn.id, updateInput);
        });
        migrationTasks.push(forkJoin(updateTasks));
      } else {
        // No existe, crear nuevo ClientConfig
        const clientConfigInput = {
          name: clientName,
          description: 'Migrado automáticamente',
          structureType: 'same'
        };

        const createTask = this.graphqlService.createClientConfig(clientConfigInput).pipe(
          switchMap((response: any) => {
            const newClientConfig = response.data.createClientConfig;
            console.log(`✅ ClientConfig creado para ${clientName}: ${newClientConfig.id}`);

            const updateTasks = connections.map((conn: any) => {
              const updateInput = {
                clientConfigId: newClientConfig.id,
                clientName: conn.clientName,
                clientId: conn.clientId || '',
                servidor: conn.servidor,
                puerto: conn.puerto,
                user: conn.user,
                password: conn.password,
                repository: conn.repository,
                adapter: conn.adapter,
                associatedStores: conn.associatedStores || [],
                storeFilterField: conn.storeFilterField || null
              };
              return this.graphqlService.updateConnection(conn.id, updateInput);
            });

            return forkJoin(updateTasks);
          })
        );

        migrationTasks.push(createTask);
      }
    });

    // Ejecutar todas las migraciones
    if (migrationTasks.length > 0) {
      forkJoin(migrationTasks).subscribe({
        next: () => {
          console.log('✅ Migración completada. Recargando datos...');
          this.isLoadingClientConfigs = false; // Liberar el flag antes de recargar
          this.loadClientConfigsFromGraphQL();
        },
        error: (error) => {
          console.error('❌ Error durante la migración:', error);
          this.isLoadingClientConfigs = false; // Liberar el flag antes de recargar
          this.reloadAfterConsolidation();
        }
      });
    } else {
      // No hay tareas de migración, liberar el flag
      this.isLoadingClientConfigs = false;
    }
  }

  private consolidateDuplicateClientConfigs(clientConfigs: any[]): any {
    // Agrupar ClientConfigs por nombre
    const configsByName = new Map<string, any[]>();
    clientConfigs.forEach((config: any) => {
      if (!configsByName.has(config.name)) {
        configsByName.set(config.name, []);
      }
      configsByName.get(config.name)!.push(config);
    });

    // Identificar duplicados y consolidar
    const consolidationTasks: any[] = [];
    const configsToKeep: any[] = [];

    configsByName.forEach((configs, name) => {
      if (configs.length > 1) {
        console.log(`🔄 Consolidando ${configs.length} ClientConfigs duplicados de "${name}"...`);

        // Ordenar por fecha de creación (más antiguo primero)
        configs.sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());

        const primaryConfig = configs[0]; // El más antiguo
        const duplicates = configs.slice(1); // Los demás

        configsToKeep.push(primaryConfig);

        // Cargar conexiones y reasignar al primario
        duplicates.forEach(duplicate => {
          const task = this.graphqlService.getAllConnections().pipe(
            switchMap((response: any) => {
              const allConnections = response.data.getConnections.items;
              const connectionsToMove = allConnections.filter((conn: any) => conn.clientConfigId === duplicate.id);

              if (connectionsToMove.length > 0) {
                console.log(`📦 Moviendo ${connectionsToMove.length} conexiones de ${duplicate.id} a ${primaryConfig.id}`);

                const updateTasks = connectionsToMove.map((conn: any) => {
                  const updateInput = {
                    clientConfigId: primaryConfig.id,
                    clientName: conn.clientName,
                    clientId: conn.clientId || '',
                    servidor: conn.servidor,
                    puerto: conn.puerto,
                    user: conn.user,
                    password: conn.password,
                    repository: conn.repository,
                    adapter: conn.adapter,
                    associatedStores: conn.associatedStores || [],
                    storeFilterField: conn.storeFilterField || null
                  };
                  return this.graphqlService.updateConnection(conn.id, updateInput);
                });

                return forkJoin(updateTasks).pipe(
                  switchMap(() => {
                    console.log(`🗑️ Eliminando ClientConfig duplicado: ${duplicate.id}`);
                    return this.graphqlService.deleteClientConfig(duplicate.id);
                  })
                );
              } else {
                // No tiene conexiones, simplemente eliminar
                console.log(`🗑️ Eliminando ClientConfig duplicado vacío: ${duplicate.id}`);
                return this.graphqlService.deleteClientConfig(duplicate.id);
              }
            })
          );

          consolidationTasks.push(task);
        });
      } else {
        configsToKeep.push(configs[0]);
      }
    });

    if (consolidationTasks.length > 0) {
      return forkJoin(consolidationTasks).pipe(
        map(() => {
          console.log('✅ Consolidación de duplicados completada');
          return { configs: configsToKeep, hadDuplicates: true };
        })
      );
    } else {
      // No hay duplicados, retornar los configs originales inmediatamente
      console.log('✅ No hay duplicados, continuando...');
      return of({ configs: clientConfigs, hadDuplicates: false });
    }
  }

  private buildClientConfigsFromData(clientConfigsData: any[], connectionsData: any[]): void {
    console.time('⏱️ Map connections by clientConfigId');
    // Map connections by clientConfigId
    const connectionsByClientConfigId = new Map<string, any[]>();
    connectionsData.forEach((conn: any) => {
      if (!conn.clientConfigId) return;

      if (!connectionsByClientConfigId.has(conn.clientConfigId)) {
        connectionsByClientConfigId.set(conn.clientConfigId, []);
      }
      connectionsByClientConfigId.get(conn.clientConfigId)!.push(conn);
    });
    console.timeEnd('⏱️ Map connections by clientConfigId');

    console.time('⏱️ Build ClientConfig objects');
    // Build ClientConfigs from clientconfig data + connections
    const clientConfigsResult: ClientConfig[] = clientConfigsData.map((cc: any) => {
      const clientConnections = connectionsByClientConfigId.get(cc.id) || [];

      return {
        id: cc.id,
        name: cc.name,
        description: cc.description || '',
        structureType: cc.structureType || 'same',
        stores: clientConnections.map((conn: any) => ({
          _connectionId: conn.id,
          servidor: conn.servidor,
          puerto: conn.puerto,
          user: conn.user,
          password: conn.password,
          repository: conn.repository,
          adapter: conn.adapter,
          associatedStores: conn.associatedStores || [],
          storeFilterField: conn.storeFilterField || undefined
        })),
        createdAt: cc.createdAt
      };
    });
    console.timeEnd('⏱️ Build ClientConfig objects');

    console.time('⏱️ Set signal');
    this.clientConfigsSignal.set(clientConfigsResult);
    console.timeEnd('⏱️ Set signal');
    console.log('ClientConfigs cargados desde GraphQL:', clientConfigsResult.length);
  }

  // Saved Configuration management
  saveConfiguration(name: string, description: string): void {
    const config = this.configSignal();
    const scenarios = this.scenariosSignal();

    const input = {
      name,
      description: description || '',
      config: JSON.stringify(config),
      scenarios: scenarios.map(s => ({
        id: s.id,
        name: s.name,
        isReadOnly: s.isReadOnly,
        assignments: s._assignmentsArray || [],
        storeFilter: s.storeFilter
      }))
    };

    this.graphqlService.saveSavedConfiguration(input).subscribe({
      next: (response) => {
        const savedConfig = response.data.saveSavedConfiguration;
        // Parsear el config de string a objeto
        savedConfig.config = JSON.parse(savedConfig.config);

        this.savedConfigsSignal.update(configs => [...configs, savedConfig]);
        this.currentLoadedConfigIdSignal.set(savedConfig.id);
        console.log('Configuración guardada exitosamente:', savedConfig.id);
      },
      error: (error) => {
        console.error('Error al guardar configuración:', error);
      }
    });
  }

  loadSavedConfiguration(id: string): void {
    const savedConfig = this.savedConfigsSignal().find(c => c.id === id);
    if (savedConfig) {
      this.applyLoadedConfig(savedConfig);
      this.currentLoadedConfigIdSignal.set(id);
      this.updateSavedConfigLastUsed(id);
    } else {
      // Si no está en memoria, buscar en GraphQL
      this.graphqlService.getSavedConfigurationById(id).subscribe({
        next: (response) => {
          const config = response.data.getSavedConfigurationById;
          if (config) {
            config.config = JSON.parse(config.config);
            this.applyLoadedConfig(config);
            this.currentLoadedConfigIdSignal.set(id);
            this.updateSavedConfigLastUsed(id);
          }
        },
        error: (error) => {
          console.error('Error al cargar configuración:', error);
        }
      });
    }
  }

  private applyLoadedConfig(savedConfig: SavedConfiguration): void {
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
  }

  updateConfiguration(id: string, name: string, description: string): void {
    const config = this.configSignal();
    const scenarios = this.scenariosSignal();

    const input = {
      name,
      description: description || '',
      config: JSON.stringify(config),
      scenarios: scenarios.map(s => ({
        id: s.id,
        name: s.name,
        isReadOnly: s.isReadOnly,
        assignments: s._assignmentsArray || [],
        storeFilter: s.storeFilter
      }))
    };

    this.graphqlService.updateSavedConfiguration(id, input).subscribe({
      next: (response) => {
        const updatedConfig = response.data.updateSavedConfiguration;
        if (updatedConfig) {
          updatedConfig.config = JSON.parse(updatedConfig.config);

          this.savedConfigsSignal.update(configs =>
            configs.map(c => c.id === id ? updatedConfig : c)
          );
          console.log('Configuración actualizada exitosamente:', id);
        }
      },
      error: (error) => {
        console.error('Error al actualizar configuración:', error);
      }
    });
  }

  clearCurrentLoadedConfig(): void {
    this.currentLoadedConfigIdSignal.set(null);
  }

  deleteSavedConfiguration(id: string): void {
    this.graphqlService.deleteSavedConfiguration(id).subscribe({
      next: (response) => {
        const success = response.data.deleteSavedConfiguration;
        if (success) {
          this.savedConfigsSignal.update(configs =>
            configs.filter(c => c.id !== id)
          );
          console.log('Configuración eliminada exitosamente:', id);
        }
      },
      error: (error) => {
        console.error('Error al eliminar configuración:', error);
      }
    });
  }

  private updateSavedConfigLastUsed(id: string): void {
    this.graphqlService.updateLastUsed(id).subscribe({
      next: (response) => {
        const updatedConfig = response.data.updateLastUsed;
        if (updatedConfig) {
          this.savedConfigsSignal.update(configs =>
            configs.map(c =>
              c.id === id
                ? { ...c, lastUsed: updatedConfig.lastUsed }
                : c
            )
          );
        }
      },
      error: (error) => {
        console.error('Error al actualizar lastUsed:', error);
      }
    });
  }

  loadSavedConfigsFromGraphQL(): void {
    this.graphqlService.getSavedConfigurations().subscribe({
      next: (response) => {
        const configs = response.data.getSavedConfigurations;
        // Parsear el config de cada configuración
        const parsedConfigs = configs.map((c: any) => ({
          ...c,
          config: JSON.parse(c.config)
        }));
        this.savedConfigsSignal.set(parsedConfigs);
        console.log('Configuraciones cargadas desde GraphQL:', parsedConfigs.length);
      },
      error: (error) => {
        console.error('Error al cargar configuraciones desde GraphQL:', error);
      }
    });
  }
}
