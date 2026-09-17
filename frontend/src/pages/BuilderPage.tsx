import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { HelpCircle, Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import { logout, getUsername } from '@/api/auth'
import { fetchDatasources } from '@/api/datasource'
import { fetchTableSchema, fetchStrictMode, fetchFkInfo } from '@/api/schema'
import { isGenerated, suggestSplitPk } from '@/lib/type-compare'
import { validateSameTable } from '@/lib/validator'
import { FieldMappingEditor } from '@/components/mapping/FieldMapping'
import { JsonResult } from '@/components/result/JsonResult'
import { SyncConfigPanel } from '@/components/sync/SyncConfig'
import { SourceTargetPanel } from '@/components/datasource/SourceTargetPanel'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Separator } from '@/components/ui/separator'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { useBuilder } from '@/stores/builder'
import type { FieldMapping } from '@/types/job'
import type { TableSchema } from '@/types/schema'

function buildMappingsFromSchemas(
  sourceSchema: TableSchema,
  targetSchema: TableSchema,
): FieldMapping[] {
  const targetNames = new Set(targetSchema.columns.map((c) => c.name))
  return sourceSchema.columns.map((col) => {
    const generated = isGenerated(col)
    const hasTarget = targetNames.has(col.name)
    return {
      source_column: col.name,
      target_column: hasTarget ? col.name : '',
      selected: hasTarget && !generated,
    }
  })
}

export function BuilderPage() {
  const navigate = useNavigate()
  const { state, dispatch } = useBuilder()
  useEffect(() => {
    fetchDatasources()
      .then((ds) => dispatch({ type: 'SET_DATASOURCES', payload: ds }))
      .catch((err) => toast.error(err instanceof Error ? err.message : '加载数据源列表失败'))
  }, [dispatch])

  const canCompare =
    !!state.source.datasource &&
    !!state.source.database &&
    !!state.source.table &&
    !!state.target.datasource &&
    !!state.target.database &&
    !!state.target.table

  const handleCompare = async () => {
    if (!canCompare) return

    const sameTableError = validateSameTable(
      { datasource: state.source.datasource!, database: state.source.database!, table: state.source.table! },
      { datasource: state.target.datasource!, database: state.target.database!, table: state.target.table! },
    )
    if (sameTableError) {
      toast.error(sameTableError)
      return
    }

    dispatch({ type: 'SET_IS_COMPARING', payload: true })
    dispatch({ type: 'SET_COMPARE_RESULT', payload: null })
    dispatch({ type: 'SET_MAPPINGS', payload: [] })
    dispatch({ type: 'SET_GENERATED_JSON', payload: null })
    try {
      const [srcSchema, tgtSchema, targetStrict, fkInfo] = await Promise.all([
        fetchTableSchema(
          state.source.datasource!,
          state.source.database!,
          state.source.table!,
          state.exactCount,
        ),
        fetchTableSchema(
          state.target.datasource!,
          state.target.database!,
          state.target.table!,
          state.exactCount,
        ),
        fetchStrictMode(state.target.datasource!, state.target.database!),
        fetchFkInfo(state.target.datasource!, state.target.database!, state.target.table!),
      ])

      dispatch({ type: 'SET_SOURCE_SCHEMA', payload: srcSchema })
      dispatch({ type: 'SET_TARGET_SCHEMA', payload: tgtSchema })

      const generatedColumns = srcSchema.columns
        .filter((c) => isGenerated(c))
        .map((c) => c.name)

      const splitPkSuggestion = suggestSplitPk(srcSchema.columns)

      const mappingsResult = buildMappingsFromSchemas(srcSchema, tgtSchema)
      dispatch({ type: 'SET_MAPPINGS', payload: mappingsResult })

      dispatch({
        type: 'SET_COMPARE_RESULT',
        payload: {
          source: {
            datasource: state.source.datasource!,
            database: state.source.database!,
            table: state.source.table!,
          },
          target: {
            datasource: state.target.datasource!,
            database: state.target.database!,
            table: state.target.table!,
          },
          target_strict: targetStrict,
          split_pk_suggestion: splitPkSuggestion,
          fk_referenced_by: fkInfo.referenced_by,
          fk_depends_on: fkInfo.depends_on,
          generated_columns: generatedColumns,
        },
      })

      if (!state.taskName) {
        const sourceTable = state.source.table!
        const targetTable = state.target.table!
        let defaultTaskName: string
        if (sourceTable === targetTable) {
          defaultTaskName = `${targetTable} (${state.source.datasource} -> ${state.target.datasource})`
        } else {
          defaultTaskName = `${sourceTable} -> ${targetTable}`
        }
        dispatch({ type: 'SET_TASK_NAME', payload: defaultTaskName })
      }

      toast.success('字段读取完成')
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : '字段读取失败',
      )
    } finally {
      dispatch({ type: 'SET_IS_COMPARING', payload: false })
    }
  }

  const handleLogout = () => {
    logout()
    dispatch({ type: 'RESET' })
    navigate('/login', { replace: true })
  }

  return (
    <div className="min-h-svh bg-background flex flex-col">
      <header className="flex items-center justify-between border-b px-6 py-3 shrink-0">
        <h1 className="text-lg font-semibold">DataX Builder</h1>
        <div className="flex items-center gap-3">
          <span className="text-sm text-muted-foreground">{getUsername()}</span>
          <Button variant="outline" size="sm" onClick={handleLogout}>
            退出
          </Button>
        </div>
      </header>

      <main className="flex-1 grid grid-cols-1 gap-5 p-5 lg:grid-cols-[5fr_2fr] items-start">
        {/* Left panel */}
        <div className="min-w-0 flex flex-col gap-4 p-px">
          <Card className="shrink-0">
            <CardHeader>
              <CardTitle>数据源配置</CardTitle>
            </CardHeader>
            <CardContent className="pt-0">
              <SourceTargetPanel
                sourceDatasource={state.source.datasource}
                sourceDatabase={state.source.database}
                sourceTable={state.source.table}
                targetDatasource={state.target.datasource}
                targetDatabase={state.target.database}
                targetTable={state.target.table}
                onSourceDatasourceChange={(value) =>
                  dispatch({ type: 'SET_SOURCE_DATASOURCE', payload: value })
                }
                onSourceDatabaseChange={(value) =>
                  dispatch({ type: 'SET_SOURCE_DATABASE', payload: value })
                }
                onSourceTableChange={(value) =>
                  dispatch({ type: 'SET_SOURCE_TABLE', payload: value })
                }
                onTargetDatasourceChange={(value) =>
                  dispatch({ type: 'SET_TARGET_DATASOURCE', payload: value })
                }
                onTargetDatabaseChange={(value) =>
                  dispatch({ type: 'SET_TARGET_DATABASE', payload: value })
                }
                onTargetTableChange={(value) =>
                  dispatch({ type: 'SET_TARGET_TABLE', payload: value })
                }
              />
              <div className="flex items-center gap-3 mt-3">
                <label className="flex cursor-pointer items-center gap-1.5 shrink-0">
                  <Checkbox
                    checked={state.exactCount}
                    onCheckedChange={(checked) =>
                      dispatch({ type: 'SET_EXACT_COUNT', payload: checked === true })
                    }
                  />
                  <span className="text-sm text-muted-foreground">精确 Count</span>
                  <Tooltip>
                    <TooltipTrigger render={<HelpCircle className="h-3.5 w-3.5 text-muted-foreground/60 cursor-help" />} />
                    <TooltipContent>大表较慢</TooltipContent>
                  </Tooltip>
                </label>
                <Button
                  type="button"
                  size="sm"
                  onClick={handleCompare}
                  disabled={!canCompare || state.isComparing}
                >
                  {state.isComparing ? (
                    <>
                      <Loader2 className="animate-spin" />
                      读取中…
                    </>
                  ) : (
                    '读取字段'
                  )}
                </Button>
              </div>
            </CardContent>
          </Card>

          {state.compareResult && (
            <Card className="shrink-0">
              <CardHeader>
                <CardTitle>同步配置</CardTitle>
              </CardHeader>
              <CardContent className="pt-0">
                <SyncConfigPanel />
              </CardContent>
            </Card>
          )}

          {state.compareResult && (
            <Card>
              <CardHeader>
                <CardTitle>字段映射</CardTitle>
              </CardHeader>
              <CardContent className="pt-0">
                <FieldMappingEditor />
              </CardContent>
            </Card>
          )}
        </div>

        {/* Right panel */}
        <div className="min-w-0 sticky top-0 max-h-svh">
          <Card className="flex flex-col max-h-svh overflow-hidden">
            <CardHeader className="shrink-0">
              <CardTitle>DataX JSON 输出</CardTitle>
            </CardHeader>
            <CardContent className="flex-1 min-h-0 overflow-auto pt-0">
              <Separator className="mb-4 lg:hidden" />
              <JsonResult />
            </CardContent>
          </Card>
        </div>
      </main>
    </div>
  )
}
