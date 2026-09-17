export interface FieldMapping {
  source_column: string
  target_column: string
  selected: boolean
}

export interface IncrementalConfig {
  type: 'time' | 'id' | 'time_id'
  time_field: string | null
  id_field: string | null
  time_parameter: string
  id_parameter: string
}

export interface SyncConfig {
  mode: 'full' | 'incremental'
  incremental: IncrementalConfig | null
  split_pk: string | null
  channel: number
  batch_size: number
  incremental_window_days: number
}

