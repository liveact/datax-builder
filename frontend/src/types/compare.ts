export type ColumnStatus = 'common' | 'src_only' | 'tgt_only' | 'generated'
export type TypeRisk = 'ok' | 'danger' | 'warn'

export interface ColumnPrediction {
  result: string  // default / null / auto / error / implicit
  text: string
  color: string   // info / danger / warning
}

export interface SchemaCheckState {
  source: { datasource: string; database: string; table: string }
  target: { datasource: string; database: string; table: string }
  target_strict: boolean | null
  split_pk_suggestion: string | null
  fk_referenced_by: string[] | null
  fk_depends_on: string[] | null
  generated_columns: string[]
}
