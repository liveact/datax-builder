import type { FieldMapping, SyncConfig } from '@/types/job'
import type { ColumnSchema } from '@/types/schema'
import { isGenerated } from '@/lib/type-compare'

export interface ValidateInput {
  source: { datasource: string; database: string; table: string }
  target: { datasource: string; database: string; table: string }
  mappings: FieldMapping[]
  syncConfig: SyncConfig
  generatedColumns: string[]
  sourceColumns: ColumnSchema[]
}

export function validateGenerateRequest(input: ValidateInput): string[] {
  const errors: string[] = []

  const selectedMappings = input.mappings.filter((m) => m.selected)
  if (selectedMappings.length === 0) {
    errors.push('至少需要选择一个字段映射')
  }

  if (
    input.source.datasource === input.target.datasource &&
    input.source.database === input.target.database &&
    input.source.table === input.target.table
  ) {
    errors.push('源端和目标端不能是同一张表')
  }

  const generatedSet = new Set(input.generatedColumns)
  for (const m of selectedMappings) {
    if (generatedSet.has(m.source_column)) continue
    if (!m.target_column) {
      errors.push(`字段 '${m.source_column}' 已勾选同步但未指定目标列`)
    }
  }

  if (input.syncConfig.mode === 'incremental') {
    const incremental = input.syncConfig.incremental
    if (!incremental) {
      errors.push('增量同步需要增量配置')
    } else {
      const sourceColumnNames = new Set(input.sourceColumns.map((c) => c.name))
      const generatedNames = new Set(
        input.sourceColumns.filter((c) => isGenerated(c)).map((c) => c.name),
      )

      if (incremental.type === 'time' || incremental.type === 'time_id') {
        if (!incremental.time_field) {
          errors.push('增量时间同步需要 time_field')
        } else if (!sourceColumnNames.has(incremental.time_field)) {
          errors.push(`增量时间字段 '${incremental.time_field}' 不在源表列中`)
        } else if (generatedNames.has(incremental.time_field)) {
          errors.push(`增量时间字段 '${incremental.time_field}' 是生成列，不可用`)
        }
      }
      if (incremental.type === 'id' || incremental.type === 'time_id') {
        if (!incremental.id_field) {
          errors.push('增量 ID 同步需要 id_field')
        } else if (!sourceColumnNames.has(incremental.id_field)) {
          errors.push(`增量 ID 字段 '${incremental.id_field}' 不在源表列中`)
        }
      }
    }
  }

  return errors
}

export function validateSameTable(
  source: { datasource: string; database: string; table: string },
  target: { datasource: string; database: string; table: string },
): string | null {
  if (
    source.datasource === target.datasource &&
    source.database === target.database &&
    source.table === target.table
  ) {
    return '源端和目标端不能是同一张表'
  }
  return null
}
