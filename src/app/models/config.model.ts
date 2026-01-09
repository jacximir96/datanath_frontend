export interface Origin {
  servidor: string;
  puerto: string;
  user: string;
  password: string;
  repository: string;
  adapter: string;
  // Campos para asociar items del catálogo a esta conexión específica
  associatedStores?: string[]; // IDs de items del catálogo asociados a esta conexión
  storeFilterField?: string; // Campo para filtrar por item del catálogo (ej: "restaurant_name", "store_id")
  // Campos internos para separación por tiendas (no se exportan al orquestador)
  _internalStores?: {
    storeIds: string[];           // ["G008", "G009", "G010"]
    filterField: string;          // "restaurant_name"
    detectionCollection: string;  // "PurchaseOrders_POS_Order"
  };
}

export interface Filter {
  name: string;
  operator: string;
  value: string;
  isDynamic?: boolean;
  dynamicSource?: {
    entityName: string;
    fieldName: string;
  };
}

export interface Property {
  name: string;
  type: string;
}

export interface EntityRelation {
  fromTable: string; // The table where the foreign key originates
  relatedTable: string;
  fromColumn: string;
  toColumn: string;
  relationType: 'ForeignKey' | 'ReferencedBy';
  joinType?: 'left' | 'inner' | 'right'; // Type of join for transformation
}

export interface Entity {
  name: string;
  properties: Property[];
  filters: Filter[];
  relations?: EntityRelation[];  // Guardar info de FK para auto-merge
  originRepository?: string;
  fixedConnection?: boolean; // Si está en true, usa la misma conexión en todos los grupos (no rota)
}

// NEW: Intermediate Stage (Etapa intermedia con Cosmos)
export interface IntermediateStorage {
  enabled: boolean;
  cosmosConnection: {
    endpoint: string;
    key: string;
    database: string;
    collection: string;
  };
  ttl?: number; // Time to live en segundos (opcional)
}

export interface StageOrigin {
  type: 'database' | 'cosmos' | 'api';
  // Si type === 'database', usar Origin
  database?: Origin;
  // Si type === 'cosmos', usar referencia a stage anterior
  cosmosReference?: {
    stageNumber: number; // Número de etapa previa
    collection: string;
    queryFields?: string[]; // Campos a extraer para siguiente consulta
  };
  // Si type === 'api', configuración de API
  api?: {
    baseUrl: string;
    method: 'GET' | 'POST';
    headers?: { [key: string]: string };
    authType?: 'none' | 'bearer' | 'basic';
    token?: string;
  };
}

export interface Stage {
  stageNumber: number;
  name: string; // Ej: "Extracción de ventas por tienda"
  description: string;
  origin: StageOrigin;
  entities: Entity[];
  intermediateStorage?: IntermediateStorage; // Guardar en Cosmos antes de siguiente etapa
  dependsOn?: number[]; // Números de stages previos requeridos
}

// Transformation Models
export interface MergeOn {
  left: string;
  right: string;
  type?: 'left' | 'inner' | 'right'; // Optional type for each condition
}

export interface MergeConfig {
  base: string;
  type: 'left' | 'right' | 'inner' | 'outer';
  targets: string[];
  on: MergeOn[];
}

export interface TransformationProperty {
  entities: Array<{ name: string }>;
  merge: MergeConfig[];
}

export interface WrapStructure {
  [key: string]: any;
}

export interface TransformationFilter {
  output_format: string;
  wrap_structure: WrapStructure;
}

export interface Transformation {
  code: string;
  country: string;
  properties?: TransformationProperty[];
  filter: TransformationFilter[];
}

export interface TargetConnection {
  server: string;
  port: string;
  user: string;
  password: string;
  repository: string;
  adapter: string;
  sasToken?: string;
}

export interface TargetEntity {
  name: string;
  toName: string;
  properties: Property[];
  filters: Filter[];
}

export interface EntityGroup {
  name: string;
  type: 'Modelo' | 'Metamodelo';
  entities: Entity[];
  // For query results
  isExecuting?: boolean;
  queryResult?: any;
  queryError?: any;
  sentConfigJson?: any; // New property to store the sent config
  persistentId?: string; // UUID del resultado guardado en Cosmos
}

export interface Target {
  connection: TargetConnection;
  entities: TargetEntity[];
}

export interface DataConfiguration {
  clients: string[]; // Changed from client: string to support multiple clients
  // LEGACY MODE (modo simple - un solo origen)
  origins: Origin[];
  entityGroups: EntityGroup[]; // Replaces entities: Entity[]
  // NEW: MULTI-STAGE MODE (modo avanzado - múltiples etapas)
  stages?: Stage[]; // Si existe, usar flujo multi-etapa
  executionMode?: 'simple' | 'multi-stage'; // Modo de ejecución
  transformation: Transformation;
  target: Target;
  entities: Entity[];
}

export interface StoreItem {
  id: string;
  code: string; // G008, G009, etc.
  name: string; // Nombre descriptivo (opcional)
  description?: string;
  createdAt?: string;
}

export interface ClientConfig {
  id: string;
  name: string;
  description: string;
  stores: Origin[]; // Cada conexión (Origin) puede tener sus propios associatedStores y storeFilterField
  structureType: 'same' | 'different'; // 'same' = todas las conexiones tienen la misma estructura, 'different' = cada conexión tiene estructura diferente
  createdAt?: string;
}

export interface Template {
  id: string;
  name: string;
  description: string;
  entities: Entity[];
  transformation: Transformation;
  targetFormat: string;
}

export interface SavedConfiguration {
  id: string;
  name: string;
  description: string;
  config: DataConfiguration;
  scenarios?: Array<{
    id: number;
    name: string;
    isReadOnly: boolean;
    assignments: Array<[string, string]>;
    storeFilter?: string;
  }>; // Escenarios/Grupos de conexión serializados
  createdAt: string;
  lastUsed?: string;
}
