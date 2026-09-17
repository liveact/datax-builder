import { useMemo } from 'react'
import { Checkbox } from '@/components/ui/checkbox'
import { useBuilder } from '@/stores/builder'
import { computeTypeRisk, predictExtraCol } from '@/lib/type-compare'
import type { FieldMapping } from '@/types/job'
import type { ColumnSchema } from '@/types/schema'
import type { ColumnPrediction, TypeRisk } from '@/types/compare'

const GRID_CLS = 'grid grid-cols-[1.5rem_1fr_2rem_1fr] gap-x-2 items-start'

function formatSize(bytes: number): string {
  if (bytes === 0) return '0 B'
  const units = ['B', 'KB', 'MB', 'GB', 'TB']
  const i = Math.floor(Math.log(bytes) / Math.log(1024))
  const value = bytes / Math.pow(1024, i)
  return `${value.toFixed(i === 0 ? 0 : 1)} ${units[i]}`
}

function FieldInfo({ col, children }: { col: ColumnSchema; children?: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-0.5 min-w-0">
      <div className="flex items-baseline gap-1.5">
        <span className="text-sm font-semibold truncate">{col.name}</span>
        <span className="text-xs text-muted-foreground truncate">{col.column_type}</span>
      </div>
      {col.comment && (
        <div className="text-xs text-muted-foreground/70 truncate" title={col.comment}>{col.comment}</div>
      )}
      {children}
    </div>
  )
}

function Badge({ text, color }: { text: string; color: 'danger' | 'warn' | 'info' | 'grey' | 'yellow' }) {
  const cls: Record<string, string> = {
    danger: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
    warn: 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400',
    info: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
    grey: 'bg-muted text-muted-foreground',
    yellow: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400',
  }
  return (
    <span className={`inline-flex items-center rounded px-1.5 py-0.5 text-[10px] font-medium shrink-0 ${cls[color]}`}>
      {text}
    </span>
  )
}

function InfoLine({ badge, badgeColor, text, textColor }: {
  badge: string
  badgeColor: 'danger' | 'warn' | 'info' | 'grey' | 'yellow'
  text: string
  textColor?: string
}) {
  return (
    <div className="flex items-center gap-1.5 mt-0.5">
      <Badge text={badge} color={badgeColor} />
      <span className={`text-xs ${textColor || 'text-muted-foreground'}`}>{text}</span>
    </div>
  )
}

function PredictionLine({ prediction }: { prediction: ColumnPrediction }) {
  const colorMap: Record<string, 'info' | 'danger' | 'warn' | 'grey'> = {
    info: 'info',
    danger: 'danger',
    warning: 'warn',
  }
  const badgeColor = colorMap[prediction.color] || 'grey'
  const badgeText: Record<string, string> = {
    default: '默认值',
    null: '置NULL',
    auto: '自动',
    error: '高危',
    implicit: '注意',
  }
  return (
    <InfoLine
      badge={badgeText[prediction.result] ?? '提示'}
      badgeColor={badgeColor}
      text={prediction.text}
      textColor={
        prediction.color === 'danger' ? 'text-red-600 dark:text-red-400'
          : prediction.color === 'warning' ? 'text-amber-600 dark:text-amber-400'
            : 'text-green-600 dark:text-green-400'
      }
    />
  )
}

function riskToBadge(risk: TypeRisk): { badge: string; color: 'danger' | 'warn' } {
  return risk === 'danger'
    ? { badge: '高危', color: 'danger' }
    : { badge: '注意', color: 'warn' }
}

interface StableRow {
  key: string
  type: 'mapping' | 'tgt_only'
  sourceColumn: string | null
  targetColumn: string | null
}

export function FieldMappingEditor() {
  const { state, dispatch } = useBuilder()
  const { sourceSchema, targetSchema, compareResult, mappings } = state
  const targetStrict = compareResult?.target_strict

  const sourceColumns = useMemo(() => sourceSchema?.columns ?? [], [sourceSchema])
  const targetColumns = useMemo(() => targetSchema?.columns ?? [], [targetSchema])
  const sourceColMap = useMemo(() => new Map(sourceColumns.map((c) => [c.name, c])), [sourceColumns])
  const targetColMap = useMemo(() => new Map(targetColumns.map((c) => [c.name, c])), [targetColumns])

  const generatedSet = useMemo(
    () => new Set(compareResult?.generated_columns ?? []),
    [compareResult],
  )

  const sourceUsageCount = useMemo(() => {
    const map = new Map<string, number>()
    for (const m of mappings) {
      if (m.selected && m.target_column) {
        map.set(m.source_column, (map.get(m.source_column) || 0) + 1)
      }
    }
    return map
  }, [mappings])

  const stableOrder = useMemo<StableRow[]>(() => {
    const rows: StableRow[] = []
    const srcNames = new Set(sourceColumns.map((c) => c.name))
    for (const m of mappings) {
      rows.push({
        key: `src:${m.source_column}:${m.target_column || ''}`,
        type: 'mapping',
        sourceColumn: m.source_column,
        targetColumn: m.target_column || null,
      })
    }
    for (const tc of targetColumns) {
      if (!srcNames.has(tc.name)) {
        const alreadyMapped = mappings.some((m) => m.target_column === tc.name)
        if (!alreadyMapped) {
          rows.push({
            key: `tgt:${tc.name}`,
            type: 'tgt_only',
            sourceColumn: null,
            targetColumn: tc.name,
          })
        }
      }
    }
    return rows
  }, [sourceColumns, targetColumns, mappings])

  if (!sourceSchema || !targetSchema) return null

  const updateMapping = (index: number, updates: Partial<FieldMapping>) => {
    const next = mappings.map((m, i) => (i === index ? { ...m, ...updates } : m))
    dispatch({ type: 'SET_MAPPINGS', payload: next })
  }

  const computeRisk = (srcName: string, tgtName: string) => {
    const srcCol = sourceColMap.get(srcName)
    const tgtCol = targetColMap.get(tgtName)
    if (srcCol && tgtCol) return computeTypeRisk(srcCol, tgtCol, targetStrict ?? null)
    return null
  }

  const handleCheckChange = (index: number, checked: boolean) => {
    updateMapping(index, { selected: checked })
  }

  const findMappingIndex = (srcCol: string, tgtCol: string) => {
    return mappings.findIndex((m) => m.source_column === srcCol && m.target_column === tgtCol)
  }

  function MappingRowView({ m, mappingIdx }: { rowKey: string; m: FieldMapping; mappingIdx: number }) {
    const srcCol = sourceColMap.get(m.source_column)
    if (!srcCol) return null

    const gen = generatedSet.has(srcCol.name)
    const tgtCol = m.target_column ? targetColMap.get(m.target_column) : null
    const hasTarget = !!tgtCol
    const risk = hasTarget ? computeRisk(srcCol.name, m.target_column) : null
    const multiTarget = (sourceUsageCount.get(srcCol.name) || 0) > 1

    const prediction = hasTarget && !m.selected
      ? predictExtraCol(tgtCol!, targetStrict ?? null)
      : null

    return (
      <div className="rounded-lg border px-3 py-2">
        <div className={GRID_CLS}>
          <div className="flex justify-center pt-1">
            <Checkbox
              checked={m.selected}
              onCheckedChange={(checked) => handleCheckChange(mappingIdx, checked === true)}
              disabled={gen}
            />
          </div>

          <div className="flex flex-col min-w-0">
            <FieldInfo col={srcCol}>
              {gen && <InfoLine badge="生成列" badgeColor="yellow" text="由表达式自动计算，不可写入" />}
              {!gen && !hasTarget && (
                m.selected
                  ? <InfoLine badge="高危" badgeColor="danger" text="目标无此列，执行将报 Unknown column" textColor="text-red-600 dark:text-red-400" />
                  : <InfoLine badge="提示" badgeColor="grey" text="目标无此列" />
              )}
              {multiTarget && <InfoLine badge="一源多目标" badgeColor="yellow" text={`此源列映射了 ${sourceUsageCount.get(srcCol.name)} 个目标列`} />}
            </FieldInfo>
          </div>

          <div className="flex justify-center pt-1 text-muted-foreground/50">→</div>

          <div className="flex flex-col min-w-0">
            {gen ? (
              tgtCol ? (
                <FieldInfo col={tgtCol}>
                  <InfoLine badge="生成列" badgeColor="yellow" text="由表达式自动计算，不可写入" />
                </FieldInfo>
              ) : (
                <span className="text-sm text-muted-foreground/40">—</span>
              )
            ) : tgtCol ? (
              <FieldInfo col={tgtCol}>
                {risk && risk.risk !== 'ok' && risk.message && (
                  <InfoLine
                    badge={riskToBadge(risk.risk).badge}
                    badgeColor={riskToBadge(risk.risk).color}
                    text={risk.message}
                    textColor={risk.risk === 'danger' ? 'text-red-600 dark:text-red-400' : 'text-amber-600 dark:text-amber-400'}
                  />
                )}
                {prediction && (
                  <InfoLine
                    badge="不同步"
                    badgeColor="grey"
                    text={prediction.text}
                    textColor={
                      prediction.color === 'info' ? 'text-green-600 dark:text-green-400'
                        : prediction.color === 'danger' ? 'text-red-600 dark:text-red-400'
                          : 'text-amber-600 dark:text-amber-400'
                    }
                  />
                )}
              </FieldInfo>
            ) : (
              <span className="text-sm text-muted-foreground/40">—</span>
            )}
          </div>
        </div>
      </div>
    )
  }

  function TargetOnlyRowView({ tgtCol }: { rowKey: string; tgtCol: ColumnSchema }) {
    const prediction = predictExtraCol(tgtCol, targetStrict ?? null)

    return (
      <div className="rounded-lg border border-dashed px-3 py-2 opacity-80">
        <div className={GRID_CLS}>
          <div className="flex justify-center pt-1" />

          <div className="flex flex-col min-w-0">
            <span className="text-sm text-muted-foreground/40">—</span>
          </div>

          <div className="flex justify-center pt-1 text-muted-foreground/50">→</div>

          <div className="flex flex-col min-w-0">
            <FieldInfo col={tgtCol}>
              <PredictionLine prediction={prediction} />
            </FieldInfo>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-2">
      {/* Summary row — single line, centered */}
      <div className={`${GRID_CLS} rounded-lg bg-muted/50 px-3 py-1.5 text-sm`}>
        <div />
        <div className="flex items-center gap-1.5 justify-center">
          <span className="text-muted-foreground">源表</span>
          <span className="font-semibold text-foreground">{sourceSchema.table}</span>
          <span className="text-xs text-muted-foreground">
            ({sourceSchema.row_count.toLocaleString()} 行, {formatSize(sourceSchema.data_size)})
          </span>
        </div>
        <div className="flex justify-center text-muted-foreground/50">→</div>
        <div className="flex items-center gap-1.5 justify-center flex-wrap">
          <span className="text-muted-foreground">目标表</span>
          <span className="font-semibold text-foreground">{targetSchema.table}</span>
          <span className="text-xs text-muted-foreground">
            ({targetSchema.row_count.toLocaleString()} 行, {formatSize(targetSchema.data_size)})
          </span>
          <span className="text-[10px] text-muted-foreground ml-1">STRICT</span>
          {targetStrict === null || targetStrict === undefined
            ? <Badge text="未知" color="warn" />
            : targetStrict
              ? <Badge text="是" color="danger" />
              : <Badge text="否" color="grey" />}
        </div>
      </div>

      {/* Single continuous list */}
      <div className="flex flex-col gap-1.5">
        {stableOrder.map((row) => {
          if (row.type === 'mapping') {
            const idx = findMappingIndex(row.sourceColumn!, row.targetColumn || '')
            if (idx === -1) return null
            return <MappingRowView key={row.key} rowKey={row.key} m={mappings[idx]} mappingIdx={idx} />
          }
          const tgtCol = targetColMap.get(row.targetColumn!)
          if (!tgtCol) return null
          return <TargetOnlyRowView key={row.key} rowKey={row.key} tgtCol={tgtCol} />
        })}
      </div>
    </div>
  )
}
