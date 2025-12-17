export interface ColumnInfo {
  columnName: string;
  dataType: string;
  maxLength: number | null;
  isNullable: boolean;
  isPrimaryKey: boolean;
  defaultValue: string | null;
}

export interface RelationInfo {
  relationName: string;
  fromTable: string;
  fromColumn: string;
  toTable: string;
  toColumn: string;
  relationType: 'ForeignKey' | 'ReferencedBy';
}

export interface TableMetadata {
  tableName: string;
  columns?: ColumnInfo[];
  relations?: RelationInfo[];
}

export interface GraphQLResponse<T> {
  data: T;
  errors?: Array<{
    message: string;
    extensions?: any;
  }>;
}

export interface LoginResponse {
  login: {
    success: boolean;
    message: string;
    token: string;
  };
}

export interface GetTablesResponse {
  getTables: string[];
}

export interface GetTableColumnsResponse {
  getTableColumns: ColumnInfo[];
}

export interface GetTableRelationsResponse {
  getTableRelations: RelationInfo[];
}
