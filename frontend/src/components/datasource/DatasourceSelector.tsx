import { useEffect, useState } from 'react'
import { Loader2, Plug } from 'lucide-react'
import { toast } from 'sonner'
import {
  fetchDatabases,
  fetchDatasources,
  fetchTables,
  testConnection,
} from '@/api/datasource'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { SearchableSelect } from '@/components/ui/searchable-select'
import type { DatasourceInfo } from '@/types/datasource'

interface DatasourceSelectorProps {
  label: string
  datasource: string | null
  database: string | null
  table: string | null
  onDatasourceChange: (value: string | null) => void
  onDatabaseChange: (value: string | null) => void
  onTableChange: (value: string | null) => void
}

type FetchState = 'idle' | 'loading' | 'error'

export function DatasourceSelector({
  label,
  datasource,
  database,
  table,
  onDatasourceChange,
  onDatabaseChange,
  onTableChange,
}: DatasourceSelectorProps) {
  const [datasources, setDatasources] = useState<DatasourceInfo[]>([])
  const [databases, setDatabases] = useState<string[]>([])
  const [tables, setTables] = useState<string[]>([])

  const [datasourcesState, setDatasourcesState] = useState<FetchState>('idle')
  const [databasesState, setDatabasesState] = useState<FetchState>('idle')
  const [tablesState, setTablesState] = useState<FetchState>('idle')

  const [datasourcesError, setDatasourcesError] = useState<string | null>(null)
  const [databasesError, setDatabasesError] = useState<string | null>(null)
  const [tablesError, setTablesError] = useState<string | null>(null)
  const [testingConnection, setTestingConnection] = useState(false)
  const [connectionSuccess, setConnectionSuccess] = useState(false)

  useEffect(() => {
    let isCancelled = false

    const loadDatasources = async () => {
      setDatasourcesState('loading')
      setDatasourcesError(null)

      try {
        const result = await fetchDatasources()
        if (isCancelled) return
        setDatasources(result)
        setDatasourcesState('idle')
      } catch (error) {
        if (isCancelled) return
        setDatasources([])
        setDatasourcesState('error')
        setDatasourcesError(
          error instanceof Error ? error.message : '加载数据源失败',
        )
      }
    }

    void loadDatasources()

    return () => {
      isCancelled = true
    }
  }, [])

  useEffect(() => {
    if (!datasource) {
      setDatabases([])
      setDatabasesState('idle')
      setDatabasesError(null)
      return
    }

    let isCancelled = false

    const loadDatabases = async () => {
      setDatabasesState('loading')
      setDatabasesError(null)

      try {
        const result = await fetchDatabases(datasource)
        if (isCancelled) return
        setDatabases(result.databases)
        setDatabasesState('idle')
      } catch (error) {
        if (isCancelled) return
        setDatabases([])
        setDatabasesState('error')
        setDatabasesError(
          error instanceof Error ? error.message : '加载数据库列表失败',
        )
      }
    }

    void loadDatabases()

    return () => {
      isCancelled = true
    }
  }, [datasource])

  useEffect(() => {
    if (!datasource || !database) {
      setTables([])
      setTablesState('idle')
      setTablesError(null)
      return
    }

    let isCancelled = false

    const loadTables = async () => {
      setTablesState('loading')
      setTablesError(null)

      try {
        const result = await fetchTables(datasource, database)
        if (isCancelled) return
        setTables(result.tables)
        setTablesState('idle')
      } catch (error) {
        if (isCancelled) return
        setTables([])
        setTablesState('error')
        setTablesError(
          error instanceof Error ? error.message : '加载表列表失败',
        )
      }
    }

    void loadTables()

    return () => {
      isCancelled = true
    }
  }, [datasource, database])

  const handleDatasourceChange = (value: string | null) => {
    onDatasourceChange(value)
    onDatabaseChange(null)
    onTableChange(null)
    setConnectionSuccess(false)
  }

  const handleDatabaseChange = (value: string | null) => {
    onDatabaseChange(value)
    onTableChange(null)
    setConnectionSuccess(false)
  }

  const handleTestConnection = async () => {
    if (!datasource) return
    setTestingConnection(true)
    try {
      const result = await testConnection(datasource, database ?? undefined)
      if (result.ok) {
        toast.success(result.message)
        setConnectionSuccess(true)
      } else {
        toast.error(result.message)
        setConnectionSuccess(false)
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : '测试连接失败')
    } finally {
      setTestingConnection(false)
    }
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-end gap-3 flex-wrap">
        <div className="flex flex-col gap-1 min-w-[140px] flex-1">
          <Label className="text-xs text-muted-foreground">{label}数据源</Label>
          <Select
            value={datasource}
            onValueChange={handleDatasourceChange}
            disabled={datasourcesState === 'loading'}
          >
            <SelectTrigger className="w-full">
              <SelectValue placeholder="选择数据源" />
            </SelectTrigger>
            <SelectContent>
              <SelectGroup>
                {datasources.map((item) => (
                  <SelectItem key={item.name} value={item.name}>
                    {item.name} ({item.type})
                  </SelectItem>
                ))}
              </SelectGroup>
            </SelectContent>
          </Select>
        </div>

        <div className="flex flex-col gap-1 min-w-[140px] flex-1">
          <Label className="text-xs text-muted-foreground">{label}库</Label>
          <div className="flex gap-1.5">
            <SearchableSelect
              value={database}
              onValueChange={handleDatabaseChange}
              options={databases.map((item) => ({ value: item, label: item }))}
              placeholder={databasesState === 'loading' ? '加载中…' : '选择数据库'}
              disabled={!datasource || databasesState === 'loading'}
            />
            <Button
              type="button"
              variant="outline"
              size="icon"
              onClick={handleTestConnection}
              disabled={!datasource || !database || testingConnection}
              title={!database ? '请先选择数据库' : '测试连接'}
              className={`shrink-0 ${connectionSuccess ? 'border-green-500 text-green-600 bg-green-50 dark:bg-green-950/30 dark:text-green-400 dark:border-green-600' : ''}`}
            >
              {testingConnection ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plug className="h-4 w-4" />}
            </Button>
          </div>
        </div>

        <div className="flex flex-col gap-1 min-w-[140px] flex-1">
          <Label className="text-xs text-muted-foreground">{label}表</Label>
          <SearchableSelect
            value={table}
            onValueChange={onTableChange}
            options={tables.map((item) => ({ value: item, label: item }))}
            placeholder={tablesState === 'loading' ? '加载中…' : '选择表'}
            disabled={!database || tablesState === 'loading'}
          />
        </div>
      </div>
      {datasourcesState === 'error' && datasourcesError && (
        <p className="text-xs text-destructive">{datasourcesError}</p>
      )}
      {databasesState === 'error' && databasesError && (
        <p className="text-xs text-destructive">{databasesError}</p>
      )}
      {tablesState === 'error' && tablesError && (
        <p className="text-xs text-destructive">{tablesError}</p>
      )}
    </div>
  )
}
