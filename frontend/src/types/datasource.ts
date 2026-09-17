export interface DatasourceInfo {
  name: string
  type: string
  host: string
  port: number
}

export interface DatabaseListResponse {
  datasource: string
  databases: string[]
}

export interface TableListResponse {
  datasource: string
  database: string
  tables: string[]
}
