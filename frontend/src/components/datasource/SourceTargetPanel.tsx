import { DatasourceSelector } from '@/components/datasource/DatasourceSelector'

interface SourceTargetPanelProps {
  sourceDatasource: string | null
  sourceDatabase: string | null
  sourceTable: string | null
  targetDatasource: string | null
  targetDatabase: string | null
  targetTable: string | null
  onSourceDatasourceChange: (value: string | null) => void
  onSourceDatabaseChange: (value: string | null) => void
  onSourceTableChange: (value: string | null) => void
  onTargetDatasourceChange: (value: string | null) => void
  onTargetDatabaseChange: (value: string | null) => void
  onTargetTableChange: (value: string | null) => void
}

export function SourceTargetPanel({
  sourceDatasource,
  sourceDatabase,
  sourceTable,
  targetDatasource,
  targetDatabase,
  targetTable,
  onSourceDatasourceChange,
  onSourceDatabaseChange,
  onSourceTableChange,
  onTargetDatasourceChange,
  onTargetDatabaseChange,
  onTargetTableChange,
}: SourceTargetPanelProps) {
  return (
    <div className="flex flex-col gap-4">
      <DatasourceSelector
        label="源"
        datasource={sourceDatasource}
        database={sourceDatabase}
        table={sourceTable}
        onDatasourceChange={onSourceDatasourceChange}
        onDatabaseChange={onSourceDatabaseChange}
        onTableChange={onSourceTableChange}
      />

      <DatasourceSelector
        label="目标"
        datasource={targetDatasource}
        database={targetDatabase}
        table={targetTable}
        onDatasourceChange={onTargetDatasourceChange}
        onDatabaseChange={onTargetDatabaseChange}
        onTableChange={onTargetTableChange}
      />
    </div>
  )
}
