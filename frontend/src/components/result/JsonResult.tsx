import { useEffect, useState } from 'react'
import { AlertTriangle, Copy, Download, Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import { generateDataxJson } from '@/lib/datax-generator'
import { validateGenerateRequest } from '@/lib/validator'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { JsonViewer } from '@/components/result/JsonViewer'
import { copyToClipboard } from '@/lib/clipboard'
import { useBuilder } from '@/stores/builder'

export function JsonResult() {
  const { state, dispatch } = useBuilder()
  const {
    datasources,
    source,
    target,
    sourceSchema,
    mappings,
    syncConfig,
    taskName,
    generatedJson,
    isGenerating,
    compareResult,
  } = state

  const [warnings, setWarnings] = useState<string[]>([])

  useEffect(() => {
    if (generatedJson) {
      dispatch({ type: 'SET_GENERATED_JSON', payload: null })
      setWarnings([])
    }
  }, [mappings, syncConfig])

  const canGenerate =
    source.datasource &&
    source.database &&
    source.table &&
    target.datasource &&
    target.database &&
    target.table &&
    compareResult &&
    mappings.some((m) => m.selected)

  const generatedColumns = compareResult?.generated_columns ?? []
  const fkReferencedBy = compareResult?.fk_referenced_by
  const fkDependsOn = compareResult?.fk_depends_on
  const hasCompareResult = !!compareResult
  const fkReferencedByUnknown = hasCompareResult && (fkReferencedBy === null || fkReferencedBy === undefined)
  const fkDependsOnUnknown = hasCompareResult && (fkDependsOn === null || fkDependsOn === undefined)
  const fkReferenced = hasCompareResult && !fkReferencedByUnknown && Array.isArray(fkReferencedBy) && fkReferencedBy.length > 0
  const fkParentTables = (!hasCompareResult || fkDependsOnUnknown || !Array.isArray(fkDependsOn)) ? [] : fkDependsOn

  const doGenerate = () => {
    dispatch({ type: 'SET_IS_GENERATING', payload: true })
    setWarnings([])

    try {
      const srcDs = datasources.find((d) => d.name === source.datasource)
      const tgtDs = datasources.find((d) => d.name === target.datasource)
      if (!srcDs || !tgtDs) {
        toast.error('数据源配置未找到')
        return
      }

      const result = generateDataxJson({
        source: {
          datasource: source.datasource!,
          database: source.database!,
          table: source.table!,
          host: srcDs.host,
          port: srcDs.port,
        },
        target: {
          datasource: target.datasource!,
          database: target.database!,
          table: target.table!,
          host: tgtDs.host,
          port: tgtDs.port,
        },
        mappings,
        syncConfig,
        fkReferenced,
        fkParentTables,
        generatedColumns,
      })

      const allWarnings = [...result.warnings]

      if (fkReferencedByUnknown) {
        allWarnings.push('外键引用信息获取失败，已按无外键生成，请人工确认目标表是否被外键引用')
      }
      if (fkDependsOnUnknown) {
        allWarnings.push('外键依赖信息获取失败，请人工确认本表是否依赖其他父表')
      }
      dispatch({ type: 'SET_GENERATED_JSON', payload: result.dataxJson })
      setWarnings(allWarnings)

      if (allWarnings.length > 0) {
        toast.warning(`生成完成，有 ${allWarnings.length} 个警告`)
      } else {
        toast.success('DataX JSON 生成成功')
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'JSON 生成失败'
      toast.error(message)
      dispatch({ type: 'SET_GENERATED_JSON', payload: null })
    } finally {
      dispatch({ type: 'SET_IS_GENERATING', payload: false })
    }
  }

  const handleGenerate = () => {
    if (!canGenerate) return

    const errors = validateGenerateRequest({
      source: { datasource: source.datasource!, database: source.database!, table: source.table! },
      target: { datasource: target.datasource!, database: target.database!, table: target.table! },
      mappings,
      syncConfig,
      generatedColumns,
      sourceColumns: sourceSchema?.columns ?? [],
    })
    if (errors.length > 0) {
      errors.forEach((e) => toast.error(e))
      return
    }

    doGenerate()
  }

  const handleCopyTaskName = async () => {
    if (!taskName) return
    try {
      await copyToClipboard(taskName)
      toast.success('任务名称已复制')
    } catch {
      toast.error('复制失败')
    }
  }

  const handleCopy = async () => {
    if (!generatedJson) return
    try {
      await copyToClipboard(JSON.stringify(generatedJson, null, 2))
      toast.success('已复制到剪贴板')
    } catch {
      toast.error('复制失败')
    }
  }

  const handleDownload = () => {
    if (!generatedJson) return

    const filename = taskName.trim()
      ? `${taskName.trim()}.json`
      : 'datax_job.json'

    const blob = new Blob([JSON.stringify(generatedJson, null, 2)], {
      type: 'application/json',
    })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = filename
    link.click()
    URL.revokeObjectURL(url)
    toast.success('下载已开始')
  }

  return (
    <div className="flex flex-col gap-3 h-full min-h-0">
      {/* FK warnings */}
      {(fkReferenced || fkParentTables.length > 0 || fkReferencedByUnknown || fkDependsOnUnknown) && (
        <div className="rounded-lg border border-orange-500/30 bg-orange-500/5 p-3">
          <div className="flex items-center gap-1.5 mb-1">
            <AlertTriangle className="h-4 w-4 text-orange-600 dark:text-orange-400" />
            <span className="text-sm font-medium text-orange-700 dark:text-orange-400">外键提示</span>
          </div>
          <ul className="list-inside list-disc text-xs text-muted-foreground">
            {fkReferencedByUnknown && (
              <li className="text-orange-600 dark:text-orange-400">外键引用信息获取失败，已按无外键生成，请人工确认目标表是否被外键引用</li>
            )}
            {fkDependsOnUnknown && (
              <li className="text-orange-600 dark:text-orange-400">外键依赖信息获取失败，请人工确认本表是否依赖其他父表</li>
            )}
            {fkReferenced && (
              <li>目标表被外键引用（子表：{fkReferencedBy!.join(', ')}），全量同步 preSql 将自动改为「禁用外键检查 → TRUNCATE → 恢复」</li>
            )}
            {fkParentTables.length > 0 && (
              <li>本表外键依赖父表（{fkParentTables.join(', ')}），请确保父表数据先同步完成后再执行本表任务</li>
            )}
          </ul>
        </div>
      )}

      <div className="flex flex-col gap-2">
        <Label htmlFor="task-name">任务名称</Label>
        <div className="flex gap-2">
          <Input
            id="task-name"
            placeholder="输入任务名称…"
            value={taskName}
            onChange={(e) => dispatch({ type: 'SET_TASK_NAME', payload: e.target.value })}
          />
          <Button
            type="button"
            variant="outline"
            size="icon"
            onClick={handleCopyTaskName}
            disabled={!taskName}
            title="复制任务名称"
          >
            <Copy className="h-4 w-4" />
          </Button>
        </div>
      </div>

      <Button
        type="button"
        onClick={handleGenerate}
        disabled={!canGenerate || isGenerating}
        className="w-full sticky bottom-0 z-10"
      >
        {isGenerating ? (
          <>
            <Loader2 className="animate-spin" />
            生成中…
          </>
        ) : (
          '生成 DataX JSON'
        )}
      </Button>

      {!canGenerate && compareResult && (
        <p className="text-xs text-muted-foreground">
          请至少选择一个字段映射以生成 JSON。
        </p>
      )}

      {warnings.length > 0 && (
        <div className="rounded-lg border border-amber-500/30 bg-amber-500/5 p-3">
          <p className="mb-1 text-sm font-medium text-amber-700 dark:text-amber-400">
            警告
          </p>
          <ul className="list-inside list-disc text-xs text-muted-foreground">
            {warnings.map((warning) => (
              <li key={warning}>{warning}</li>
            ))}
          </ul>
        </div>
      )}

      <div className="flex gap-2">
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={handleCopy}
          disabled={!generatedJson}
        >
          <Copy />
          复制 JSON
        </Button>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={handleDownload}
          disabled={!generatedJson}
        >
          <Download />
          下载
        </Button>
      </div>

      <div className="flex-1 min-h-0 overflow-auto">
        <JsonViewer data={generatedJson} />
      </div>
    </div>
  )
}
