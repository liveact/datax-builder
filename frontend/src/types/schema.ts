export interface ColumnSchema {
  name: string
  data_type: string
  column_type: string
  length: number | null
  precision: number | null
  scale: number | null
  nullable: boolean
  default_value: string | null
  comment: string
  primary_key: boolean
  auto_increment: boolean
  extra: string
  column_key: string
  ordinal_position: number
}

export interface TableSchema {
  datasource: string
  database: string
  table: string
  columns: ColumnSchema[]
  table_comment: string
  engine: string
  charset: string
  row_count: number
  data_size: number
}
