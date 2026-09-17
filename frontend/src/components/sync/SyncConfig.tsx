import { useEffect, useMemo, useState } from 'react'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { useBuilder } from '@/stores/builder'
import { checkIncrementalFieldIndex, checkIncrementalFieldType, checkCreateTimeField } from '@/lib/type-compare'
import type { IncrementalConfig } from '@/types/job'
import type { ColumnSchema } from '@/types/schema'

const DATETIME_TYPES = new Set(['datetime', 'timestamp', 'date'])
const INTEGER_TYPES = new Set(['tinyint', 'smallint', 'mediumint', 'int', 'bigint'])

function filterColumnsByType(
  columns: ColumnSchema[],
  types: Set<string>,
): ColumnSchema[] {
  return columns.filter((col) => types.has(col.data_type.toLowerCase()))
}

function filterNonGenerated(columns: ColumnSchema[]): ColumnSchema[] {
  return columns.filter((col) => {
    const extra = col.extra.toLowerCase()
    return !(extra.includes('virtual generated') || extra.includes('stored generated'))
  })
}

function recommendConfig(
  rowCount: number,
  isIncremental: boolean,
) {
  if (isIncremental) return { channel: 1, batchSize: 2048 }
  if (rowCount <= 10_000) return { channel: 1, batchSize: 2048 }
  if (rowCount <= 100_000) return { channel: 2, batchSize: 4096 }
  if (rowCount <= 500_000) return { channel: 4, batchSize: 4096 }
  if (rowCount <= 2_000_000) return { channel: 6, batchSize: 8192 }
  return { channel: 8, batchSize: 8192 }
}

export function SyncConfigPanel() {
  const { state, dispatch } = useBuilder()
  const { syncConfig, sourceSchema, compareResult } = state
  const [touchedChannel, setTouchedChannel] = useState(false)
  const [touchedBatchSize, setTouchedBatchSize] = useState(false)
  const [channelStr, setChannelStr] = useState(String(syncConfig.channel))
  const [batchSizeStr, setBatchSizeStr] = useState(String(syncConfig.batch_size))
  const [windowDaysStr, setWindowDaysStr] = useState(String(syncConfig.incremental_window_days))

  const allSourceCols = useMemo(
    () => filterNonGenerated(sourceSchema?.columns ?? []),
    [sourceSchema],
  )

  const datetimeColumns = filterColumnsByType(allSourceCols, DATETIME_TYPES)
  const integerColumns = filterColumnsByType(allSourceCols, INTEGER_TYPES)

  const pkAndIntColumns = useMemo(() => {
    return allSourceCols.filter(
      (col) =>
        col.primary_key ||
        INTEGER_TYPES.has(col.data_type.toLowerCase()),
    )
  }, [allSourceCols])

  const recommended = useMemo(
    () => recommendConfig(
      sourceSchema?.row_count ?? 0,
      syncConfig.mode === 'incremental',
    ),
    [sourceSchema, syncConfig.mode],
  )

  useEffect(() => {
    const updates: Partial<typeof syncConfig> = {}
    if (compareResult?.split_pk_suggestion && !syncConfig.split_pk) {
      updates.split_pk = compareResult.split_pk_suggestion
    }
    if (sourceSchema) {
      if (!touchedChannel) {
        updates.channel = recommended.channel
        setChannelStr(String(recommended.channel))
      }
      if (!touchedBatchSize) {
        updates.batch_size = recommended.batchSize
        setBatchSizeStr(String(recommended.batchSize))
      }
    }
    if (Object.keys(updates).length > 0) {
      dispatch({
        type: 'SET_SYNC_CONFIG',
        payload: { ...syncConfig, ...updates },
      })
    }
  }, [compareResult?.split_pk_suggestion, sourceSchema?.row_count, recommended.channel, recommended.batchSize])

  const updateSyncConfig = (updates: Partial<typeof syncConfig>) => {
    dispatch({
      type: 'SET_SYNC_CONFIG',
      payload: { ...syncConfig, ...updates },
    })
  }

  const updateIncremental = (updates: Partial<IncrementalConfig>) => {
    const current = syncConfig.incremental ?? {
      type: 'time' as const,
      time_field: null,
      id_field: null,
      time_parameter: 'last_time',
      id_parameter: 'last_id',
    }
    updateSyncConfig({
      incremental: { ...current, ...updates },
    })
  }

  const handleModeChange = (mode: 'full' | 'incremental') => {
    if (mode === 'full') {
      updateSyncConfig({ mode, incremental: null })
      return
    }

    updateSyncConfig({
      mode: 'incremental',
      incremental: syncConfig.incremental ?? {
        type: 'time',
        time_field: null,
        id_field: null,
        time_parameter: 'last_time',
        id_parameter: 'last_id',
      },
    })
  }

  const incrementalType = syncConfig.incremental?.type ?? 'time'
  const showTimeField = incrementalType === 'time' || incrementalType === 'time_id'
  const showIdField = incrementalType === 'id' || incrementalType === 'time_id'

  const timeFieldWarnings = useMemo(() => {
    const fieldName = syncConfig.incremental?.time_field
    if (!fieldName) return []
    const col = allSourceCols.find((c) => c.name === fieldName)
    if (!col) return []
    const msgs: string[] = []
    const w1 = checkIncrementalFieldIndex(col)
    if (w1) msgs.push(w1)
    const w2 = checkIncrementalFieldType(col)
    if (w2) msgs.push(w2)
    const w3 = checkCreateTimeField(col, true)
    if (w3) msgs.push(w3)
    if (col.nullable) msgs.push(`'${col.name}' 允许 NULL，NULL 行将被增量条件永远跳过`)
    return msgs
  }, [syncConfig.incremental?.time_field, allSourceCols])

  const idFieldWarnings = useMemo(() => {
    const fieldName = syncConfig.incremental?.id_field
    if (!fieldName) return []
    const col = allSourceCols.find((c) => c.name === fieldName)
    if (!col) return []
    const msgs: string[] = []
    const w1 = checkIncrementalFieldIndex(col)
    if (w1) msgs.push(w1)
    if (col.nullable) msgs.push(`'${col.name}' 允许 NULL，NULL 行将被增量条件永远跳过`)
    return msgs
  }, [syncConfig.incremental?.id_field, allSourceCols])

  return (
    <div className="flex flex-col gap-2">
      {/* Sync mode - horizontal */}
      <div className="flex items-center gap-4">
        <Label className="shrink-0 text-sm">同步模式</Label>
        <RadioGroup
          value={syncConfig.mode}
          onValueChange={(value) => handleModeChange(value as 'full' | 'incremental')}
          className="flex gap-4"
        >
          <label className="flex cursor-pointer items-center gap-1.5">
            <RadioGroupItem value="full" />
            <span className="text-sm">全量</span>
          </label>
          <label className="flex cursor-pointer items-center gap-1.5">
            <RadioGroupItem value="incremental" />
            <span className="text-sm">增量</span>
          </label>
        </RadioGroup>
      </div>

      {/* Performance settings - compact grid */}
      <div className="grid grid-cols-3 gap-3">
        <div className="flex flex-col gap-1">
          <Label className="text-xs text-muted-foreground">
            切分键{compareResult?.split_pk_suggestion ? '（推荐）' : ''}
          </Label>
          <Select
            value={syncConfig.split_pk ?? '__none__'}
            onValueChange={(value) =>
              updateSyncConfig({ split_pk: value === '__none__' ? null : value })
            }
          >
            <SelectTrigger className="w-full" title="建议使用主键">
              <SelectValue placeholder="不使用">
                {(syncConfig.split_pk ?? '__none__') === '__none__' ? '不使用' : syncConfig.split_pk}
              </SelectValue>
            </SelectTrigger>
            <SelectContent>
              <SelectGroup>
                <SelectItem value="__none__">不使用</SelectItem>
                {pkAndIntColumns.map((col) => (
                  <SelectItem key={col.name} value={col.name}>
                    {col.name}{col.primary_key ? ' (主键)' : ''}{col.auto_increment ? ' (自增)' : ''}
                  </SelectItem>
                ))}
              </SelectGroup>
            </SelectContent>
          </Select>
        </div>

        <div className="flex flex-col gap-1">
          <Label className="text-xs text-muted-foreground">通道数（推荐）</Label>
          <Input
            type="number"
            min={1}
            max={32}
            value={channelStr}
            onChange={(e) => {
              setTouchedChannel(true)
              setChannelStr(e.target.value)
              const val = parseInt(e.target.value, 10)
              if (!isNaN(val) && val > 0) updateSyncConfig({ channel: val })
            }}
            onBlur={() => {
              const val = parseInt(channelStr, 10)
              if (isNaN(val) || val < 1) {
                setChannelStr(String(recommended.channel))
                updateSyncConfig({ channel: recommended.channel })
              } else if (val > 32) {
                setChannelStr('32')
                updateSyncConfig({ channel: 32 })
              }
            }}
            title="建议 1-32"
          />
        </div>

        <div className="flex flex-col gap-1">
          <Label className="text-xs text-muted-foreground">批量大小（推荐）</Label>
          <Input
            type="number"
            min={256}
            max={65536}
            step={256}
            value={batchSizeStr}
            onChange={(e) => {
              setTouchedBatchSize(true)
              setBatchSizeStr(e.target.value)
              const val = parseInt(e.target.value, 10)
              if (!isNaN(val) && val > 0) updateSyncConfig({ batch_size: val })
            }}
            onBlur={() => {
              const val = parseInt(batchSizeStr, 10)
              if (isNaN(val) || val < 256) {
                setBatchSizeStr(String(recommended.batchSize))
                updateSyncConfig({ batch_size: recommended.batchSize })
              }
            }}
            title="建议 1024-8192"
          />
        </div>
      </div>

      {/* Incremental config - compact */}
      {syncConfig.mode === 'incremental' && (
        <div className="flex flex-col gap-2 rounded-lg border p-2">
          <div className="flex items-center gap-4">
            <Label className="shrink-0 text-xs text-muted-foreground">增量类型</Label>
            <RadioGroup
              value={incrementalType}
              onValueChange={(value) =>
                updateIncremental({ type: value as IncrementalConfig['type'] })
              }
              className="flex gap-3"
            >
              <label className="flex cursor-pointer items-center gap-1.5">
                <RadioGroupItem value="time" />
                <span className="text-sm">时间</span>
              </label>
              <label className="flex cursor-pointer items-center gap-1.5">
                <RadioGroupItem value="id" />
                <span className="text-sm">ID</span>
              </label>
              <label className="flex cursor-pointer items-center gap-1.5">
                <RadioGroupItem value="time_id" />
                <span className="text-sm">时间+ID</span>
              </label>
            </RadioGroup>
          </div>

          {showTimeField && (
            <>
              <div className="grid grid-cols-3 gap-3">
                <div className="flex flex-col gap-1">
                  <Label className="text-xs text-muted-foreground">时间字段</Label>
                  <Select
                    value={syncConfig.incremental?.time_field ?? undefined}
                    onValueChange={(value) => updateIncremental({ time_field: value ?? null })}
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="选择字段" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectGroup>
                        {datetimeColumns.length === 0 ? (
                          <SelectItem value="__none__" disabled>
                            无可用字段
                          </SelectItem>
                        ) : (
                          datetimeColumns.map((col) => (
                            <SelectItem key={col.name} value={col.name}>
                              {col.name} ({col.data_type})
                            </SelectItem>
                          ))
                        )}
                      </SelectGroup>
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex flex-col gap-1">
                  <Label className="text-xs text-muted-foreground">时间变量名</Label>
                  <Input
                    value={syncConfig.incremental?.time_parameter ?? 'last_time'}
                    onChange={(e) => updateIncremental({ time_parameter: e.target.value || 'last_time' })}
                    placeholder="last_time"
                  />
                </div>
                <div className="flex flex-col gap-1">
                  <Label className="text-xs text-muted-foreground">滑窗天数</Label>
                  <Input
                    type="number"
                    min={1}
                    max={365}
                    value={windowDaysStr}
                    onChange={(e) => {
                      setWindowDaysStr(e.target.value)
                      const val = parseInt(e.target.value, 10)
                      if (!isNaN(val) && val > 0) updateSyncConfig({ incremental_window_days: val })
                    }}
                    onBlur={() => {
                      const val = parseInt(windowDaysStr, 10)
                      if (isNaN(val) || val < 1) {
                        setWindowDaysStr('3')
                        updateSyncConfig({ incremental_window_days: 3 })
                      }
                    }}
                    title="增量 DELETE 滑窗天数（默认 3）"
                  />
                </div>
              </div>
              {timeFieldWarnings.length > 0 && (
                <div className="flex flex-col gap-0.5">
                  {timeFieldWarnings.map((w, i) => (
                    <p key={i} className="text-xs text-orange-600 dark:text-orange-400">⚠ {w}</p>
                  ))}
                </div>
              )}
            </>
          )}

          {showIdField && (
            <>
              <div className="grid grid-cols-2 gap-3">
                <div className="flex flex-col gap-1">
                  <Label className="text-xs text-muted-foreground">ID 字段</Label>
                  <Select
                    value={syncConfig.incremental?.id_field ?? undefined}
                    onValueChange={(value) => updateIncremental({ id_field: value ?? null })}
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="选择字段" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectGroup>
                        {integerColumns.length === 0 ? (
                          <SelectItem value="__none__" disabled>
                            无可用字段
                          </SelectItem>
                        ) : (
                          integerColumns.map((col) => (
                            <SelectItem key={col.name} value={col.name}>
                              {col.name} ({col.data_type})
                            </SelectItem>
                          ))
                        )}
                      </SelectGroup>
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex flex-col gap-1">
                  <Label className="text-xs text-muted-foreground">ID 变量名</Label>
                  <Input
                    value={syncConfig.incremental?.id_parameter ?? 'last_id'}
                    onChange={(e) => updateIncremental({ id_parameter: e.target.value || 'last_id' })}
                    placeholder="last_id"
                  />
                </div>
              </div>
              {idFieldWarnings.length > 0 && (
                <div className="flex flex-col gap-0.5">
                  {idFieldWarnings.map((w, i) => (
                    <p key={i} className="text-xs text-orange-600 dark:text-orange-400">⚠ {w}</p>
                  ))}
                </div>
              )}
            </>
          )}

          {/* WHERE condition preview */}
          {(syncConfig.incremental?.time_field || syncConfig.incremental?.id_field) && (
            <div className="rounded bg-muted/60 px-3 py-2 text-xs font-mono text-muted-foreground">
              <span className="text-foreground/70">WHERE </span>
              {incrementalType === 'time' && syncConfig.incremental?.time_field && (
                <>{syncConfig.incremental.time_field} &gt; ${'{' + (syncConfig.incremental.time_parameter || 'last_time') + '}'}</>
              )}
              {incrementalType === 'id' && syncConfig.incremental?.id_field && (
                <>{syncConfig.incremental.id_field} &gt; ${'{' + (syncConfig.incremental.id_parameter || 'last_id') + '}'}</>
              )}
              {incrementalType === 'time_id' && (
                <>
                  {syncConfig.incremental?.time_field && (
                    <>{syncConfig.incremental.time_field} &gt; ${'{' + (syncConfig.incremental.time_parameter || 'last_time') + '}'}</>
                  )}
                  {syncConfig.incremental?.time_field && syncConfig.incremental?.id_field && (
                    <span className="text-foreground/70"> AND </span>
                  )}
                  {syncConfig.incremental?.id_field && (
                    <>{syncConfig.incremental.id_field} &gt; ${'{' + (syncConfig.incremental.id_parameter || 'last_id') + '}'}</>
                  )}
                </>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
