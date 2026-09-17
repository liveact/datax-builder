import type { FieldMapping, IncrementalConfig, SyncConfig } from '@/types/job'

function q(identifier: string): string {
  return `\`${identifier}\``
}

function quoteColumns(columns: string[]): string[] {
  return columns.map(q)
}

function buildJdbcUrl(host: string, port: number, database: string): string {
  return `jdbc:mysql://${host}:${port}/${database}?useUnicode=true&characterEncoding=utf8`
}

function placeholderCredentials(datasourceName: string): { username: string; password: string } {
  return {
    username: `\${${datasourceName}_username}`,
    password: `\${${datasourceName}_password}`,
  }
}

function buildIncrementalWhere(incremental: IncrementalConfig): string {
  const timePart = incremental.time_field
    ? `${q(incremental.time_field)} > \${${incremental.time_parameter || 'last_time'}}`
    : ''
  const idPart = incremental.id_field
    ? `${q(incremental.id_field)} > \${${incremental.id_parameter || 'last_id'}}`
    : ''

  if (incremental.type === 'time') return timePart
  if (incremental.type === 'id') return idPart
  if (incremental.type === 'time_id') {
    if (timePart && idPart) {
      return `${timePart} OR (${q(incremental.time_field!)} = \${${incremental.time_parameter || 'last_time'}} AND ${idPart})`
    }
    return timePart || idPart
  }
  return ''
}

function buildIncrementalPresql(
  targetTable: string,
  incremental: IncrementalConfig,
  windowDays: number,
): string[] | null {
  if (incremental.type === 'time' || incremental.type === 'time_id') {
    if (incremental.time_field) {
      const timeVar = incremental.time_parameter || 'last_time'
      return [
        `DELETE FROM ${q(targetTable)} WHERE ${q(incremental.time_field)} >= DATE_SUB(\${${timeVar}}, INTERVAL ${windowDays} DAY)`,
      ]
    }
  }
  return null
}

export interface DataSourceInfo {
  datasource: string
  database: string
  table: string
  host: string
  port: number
}

export interface GenerateInput {
  source: DataSourceInfo
  target: DataSourceInfo
  mappings: FieldMapping[]
  syncConfig: SyncConfig
  fkReferenced: boolean
  fkParentTables: string[]
  generatedColumns: string[]
}

export interface GenerateOutput {
  dataxJson: Record<string, unknown>
  warnings: string[]
}

export function generateDataxJson(input: GenerateInput): GenerateOutput {
  const warnings: string[] = []
  const { source, target, mappings, syncConfig, fkReferenced, fkParentTables, generatedColumns } = input

  const selectedMappings = mappings.filter((m) => m.selected)

  const generatedSet = new Set(generatedColumns)
  const strippedGenerated: string[] = []
  const cleanMappings: FieldMapping[] = []
  for (const m of selectedMappings) {
    if (generatedSet.has(m.source_column)) {
      strippedGenerated.push(m.source_column)
      continue
    }
    cleanMappings.push(m)
  }

  if (strippedGenerated.length > 0) {
    warnings.unshift(
      `已自动剔除生成列：${strippedGenerated.join(', ')}（GENERATED ALWAYS AS 表达式列不可写入）`,
    )
  }

  const readerColumns = quoteColumns(cleanMappings.map((m) => m.source_column))
  const writerColumns = quoteColumns(cleanMappings.map((m) => m.target_column))

  const isFullSync = syncConfig.mode === 'full'
  const whereClause = isFullSync
    ? ''
    : syncConfig.incremental
      ? buildIncrementalWhere(syncConfig.incremental)
      : ''

  const splitPk = syncConfig.split_pk ? q(syncConfig.split_pk) : null

  const srcCreds = placeholderCredentials(source.datasource)
  const srcJdbcUrl = buildJdbcUrl(source.host, source.port, source.database)

  const readerParameter: Record<string, unknown> = {
    username: srcCreds.username,
    password: srcCreds.password,
    column: readerColumns,
    connection: [{ jdbcUrl: [srcJdbcUrl], table: [source.table] }],
  }
  if (whereClause) readerParameter.where = whereClause
  if (splitPk) readerParameter.splitPk = splitPk

  let preSql: string[] | null = null
  let writeMode = 'insert'
  let effectiveChannel = syncConfig.channel

  if (isFullSync) {
    if (fkReferenced) {
      preSql = [
        'SET FOREIGN_KEY_CHECKS=0',
        `TRUNCATE TABLE ${q(target.table)}`,
        'SET FOREIGN_KEY_CHECKS=1',
      ]
      warnings.push(
        `目标表 ${target.table} 被外键引用，preSql 已自动调整为「禁用外键检查 → TRUNCATE → 恢复」`,
      )
    } else {
      preSql = [`TRUNCATE TABLE ${q(target.table)}`]
    }

  } else {
    if (syncConfig.incremental) {
      preSql = buildIncrementalPresql(target.table, syncConfig.incremental, syncConfig.incremental_window_days)
      writeMode = preSql ? 'insert' : 'replace'
    }
  }

  if (fkParentTables.length > 0) {
    warnings.push(
      `本表外键依赖父表（${fkParentTables.join(', ')}），请确保父表数据先同步完成后再执行本表任务`,
    )
  }

  const tgtCreds = placeholderCredentials(target.datasource)
  const tgtJdbcUrl = buildJdbcUrl(target.host, target.port, target.database)

  const writerParameter: Record<string, unknown> = {
    username: tgtCreds.username,
    password: tgtCreds.password,
    column: writerColumns,
    writeMode,
    batchSize: syncConfig.batch_size,
    connection: [{ jdbcUrl: tgtJdbcUrl, table: [target.table] }],
  }
  if (preSql) writerParameter.preSql = preSql

  const dataxJson: Record<string, unknown> = {
    job: {
      content: [
        {
          reader: { name: 'mysqlreader', parameter: readerParameter },
          writer: { name: 'mysqlwriter', parameter: writerParameter },
        },
      ],
      setting: {
        speed: { channel: effectiveChannel },
        errorLimit: { record: 0, percentage: 0.0 },
      },
    },
  }

  return { dataxJson, warnings }
}
