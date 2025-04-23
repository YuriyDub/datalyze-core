export interface ITableSchema {
  name: string;
  columns: {
    name: string;
    type: string;
  }[];
}

export interface IDatabaseSchema {
  tables: ITableSchema[];
}

export interface ILLMResponse {
  content: string;
  sqlQuery?: string;
  title?: string;
  visualizationType?: string;
  error?: string;
}

export interface IVisualizationData {
  type: string;
  data: any;
  labels?: string[];
  title?: string;
  xAxis?: string;
  yAxis?: string;
}

export type VisualizationType = 'bar' | 'line' | 'pie' | 'scatter' | 'table' | 'none';
