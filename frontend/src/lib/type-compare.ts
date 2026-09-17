import type { ColumnSchema } from '@/types/schema'
import type { TypeRisk, ColumnPrediction } from '@/types/compare'

const STRING_TYPES = new Set(['varchar', 'char'])
const INTEGER_TYPES = new Set(['tinyint', 'smallint', 'mediumint', 'int', 'bigint'])
const DECIMAL_TYPES = new Set(['decimal', 'numeric', 'float', 'double'])
const TEXT_TYPES = new Set(['text', 'tinytext', 'mediumtext', 'longtext'])
const DATETIME_TYPES = new Set(['datetime', 'timestamp', 'date'])
const TIME_TYPES = new Set(['time'])

const TYPE_GROUPS: Record<string, Set<string>> = {
  integer: INTEGER_TYPES,
  decimal: DECIMAL_TYPES,
  string: new Set([...STRING_TYPES, ...TEXT_TYPES]),
  datetime: new Set([...DATETIME_TYPES, ...TIME_TYPES]),
}

const INTEGER_ORDER = ['tinyint', 'smallint', 'mediumint', 'int', 'bigint']
const TEXT_ORDER = ['tinytext', 'text', 'mediumtext', 'longtext']

function getTypeGroup(dataType: string): string | null {
  const normalized = dataType.toLowerCase()
  for (const [groupName, types] of Object.entries(TYPE_GROUPS)) {
    if (types.has(normalized)) return groupName
  }
  return null
}

function hasUnsigned(columnType: string): boolean {
  return columnType.toLowerCase().includes('unsigned')
}

function isNarrowing(srcCol: ColumnSchema, tgtCol: ColumnSchema): boolean {
  const srcType = srcCol.data_type.toLowerCase()
  const tgtType = tgtCol.data_type.toLowerCase()

  if (INTEGER_TYPES.has(srcType) && INTEGER_TYPES.has(tgtType)) {
    const srcIdx = INTEGER_ORDER.indexOf(srcType)
    const tgtIdx = INTEGER_ORDER.indexOf(tgtType)
    if (srcIdx >= 0 && tgtIdx >= 0 && srcIdx > tgtIdx) return true
    if (srcIdx === tgtIdx && hasUnsigned(srcCol.column_type) && !hasUnsigned(tgtCol.column_type)) return true
  }

  if (TEXT_TYPES.has(srcType) && TEXT_TYPES.has(tgtType)) {
    const srcIdx = TEXT_ORDER.indexOf(srcType)
    const tgtIdx = TEXT_ORDER.indexOf(tgtType)
    if (srcIdx >= 0 && tgtIdx >= 0 && srcIdx > tgtIdx) return true
  }

  if (STRING_TYPES.has(srcType) && STRING_TYPES.has(tgtType)) {
    if ((srcCol.length ?? 0) > (tgtCol.length ?? 0)) return true
  }

  if (DECIMAL_TYPES.has(srcType) && DECIMAL_TYPES.has(tgtType)) {
    if ((srcCol.precision ?? 0) > (tgtCol.precision ?? 0)) return true
    if ((srcCol.scale ?? 0) > (tgtCol.scale ?? 0)) return true
  }

  return false
}

export function computeTypeRisk(
  srcCol: ColumnSchema,
  tgtCol: ColumnSchema,
  targetStrict?: boolean | null,
): { risk: TypeRisk; message: string | null } {
  if (srcCol.column_type.toLowerCase() === tgtCol.column_type.toLowerCase()) {
    return { risk: 'ok', message: null }
  }

  const srcGroup = getTypeGroup(srcCol.data_type)
  const tgtGroup = getTypeGroup(tgtCol.data_type)

  if (srcGroup && srcGroup === tgtGroup) {
    const srcLower = srcCol.data_type.toLowerCase()
    const tgtLower = tgtCol.data_type.toLowerCase()

    if (srcGroup === 'datetime' && srcLower === 'datetime' && tgtLower === 'date') {
      return {
        risk: 'danger',
        message: `高危：datetime → date 会丢失时间部分（${srcCol.column_type} → ${tgtCol.column_type}）`,
      }
    }
    if (srcGroup === 'datetime' && srcLower === 'timestamp' && tgtLower === 'datetime') {
      return {
        risk: 'warn',
        message: `类型不同：${srcCol.column_type} → ${tgtCol.column_type}，timestamp 含时区语义而 datetime 不含，跨时区场景可能偏移`,
      }
    }

    if (isNarrowing(srcCol, tgtCol)) {
      const unsignedNote = hasUnsigned(srcCol.column_type) && !hasUnsigned(tgtCol.column_type)
        ? '（unsigned → signed 可能溢出）'
        : ''
      return {
        risk: 'danger',
        message: `高危：目标类型更窄（${srcCol.column_type} → ${tgtCol.column_type}）${unsignedNote}，可能截断/报错`,
      }
    }
    return {
      risk: 'warn',
      message: `类型不同：${srcCol.column_type} → ${tgtCol.column_type}，隐式转换，注意语义`,
    }
  }

  if (srcGroup !== tgtGroup) {
    if (targetStrict === true) {
      return {
        risk: 'danger',
        message: `高危：跨类型转换（${srcCol.column_type} → ${tgtCol.column_type}），STRICT 模式下可能报错`,
      }
    }
  }

  return {
    risk: 'warn',
    message: `类型不同：${srcCol.column_type} → ${tgtCol.column_type}，隐式转换，注意语义`,
  }
}

export function isGenerated(col: ColumnSchema): boolean {
  const extra = (col.extra || '').toLowerCase()
  return extra.includes('virtual generated') || extra.includes('stored generated')
}

export function predictExtraCol(tgtCol: ColumnSchema, targetStrict: boolean | null): ColumnPrediction {
  if (tgtCol.default_value !== null && tgtCol.default_value !== 'NULL') {
    return { result: 'default', text: `填默认值 ${tgtCol.default_value}`, color: 'info' }
  }
  if (tgtCol.nullable) {
    return { result: 'null', text: '置 NULL（该列可空且无默认值）', color: 'info' }
  }
  if (tgtCol.auto_increment) {
    return { result: 'auto', text: '自增列，自动分配', color: 'info' }
  }
  if (isGenerated(tgtCol)) {
    return { result: 'auto', text: '生成列，由表达式自动计算', color: 'info' }
  }
  if (targetStrict === true) {
    return { result: 'error', text: '报错：NOT NULL 且无默认值（目标库 STRICT 模式，任务会失败）', color: 'danger' }
  }
  if (targetStrict === null) {
    return { result: 'error', text: '报错风险：NOT NULL 且无默认值（STRICT 模式未知，按最坏情况处理）', color: 'danger' }
  }
  return { result: 'implicit', text: '非严格模式：填隐式默认（数值 0 / 空串），并产生 warning', color: 'warning' }
}

export function suggestSplitPk(columns: ColumnSchema[]): string | null {
  const integerTypes = new Set([...INTEGER_TYPES, ...Array.from(INTEGER_TYPES).map((t) => `${t} unsigned`)])
  for (const col of columns) {
    if (col.auto_increment && integerTypes.has(col.data_type.toLowerCase())) return col.name
  }
  const pkCols = columns.filter((c) => c.primary_key)
  const intPks = pkCols.filter((c) => INTEGER_TYPES.has(c.data_type.toLowerCase()))
  if (intPks.length === 1) return intPks[0].name
  if (intPks.length > 1) {
    intPks.sort((a, b) => a.ordinal_position - b.ordinal_position)
    return intPks[0].name
  }
  return null
}

export function checkIncrementalFieldIndex(col: ColumnSchema): string | null {
  if (!col.column_key) {
    return `增量字段 '${col.name}' 无索引，大表查询可能很慢`
  }
  return null
}

export function checkIncrementalFieldType(col: ColumnSchema): string | null {
  if (TIME_TYPES.has(col.data_type.toLowerCase())) {
    return `增量字段 '${col.name}' 类型为 time，不适合作为增量条件（无日期信息）`
  }
  return null
}

export function checkCreateTimeField(col: ColumnSchema, isIncremental: boolean): string | null {
  const name = col.name.toLowerCase()
  if (isIncremental && (name === 'create_time' || name === 'created_at')) {
    return `'${col.name}' 仅记录创建时间，若数据有更新操作，增量同步可能遗漏已修改的行`
  }
  return null
}
