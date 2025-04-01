export interface IColumnDefinition {
  name: string;
  type: 'TEXT' | 'INTEGER' | 'REAL' | 'BLOB' | 'NULL';
  primaryKey?: boolean;
  notNull?: boolean;
  unique?: boolean;
  defaultValue?: any;
}

export interface ITableDefinition {
  name: string;
  columns: IColumnDefinition[];
}

export interface IJsonToSqliteOptions {
  tables?: ITableDefinition[];
  inferTypes?: boolean;
}

export interface ICsvToSqliteOptions {
  tableName: string;
  columns: IColumnDefinition[];
}

export interface ISqliteServiceResult {
  key?: string;
  message?: string;
  error?: string;
}
