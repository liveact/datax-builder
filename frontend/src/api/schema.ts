import { apiFetch } from '@/api/client'
import type { TableSchema } from '@/types/schema'

export async function fetchTableSchema(
  datasource: string,
  database: string,
  table: string,
  exactCount: boolean = false,
): Promise<TableSchema> {
  const params = exactCount ? '?exact_count=true' : ''
  const response = await apiFetch(
    `/api/datasources/${encodeURIComponent(datasource)}/databases/${encodeURIComponent(database)}/tables/${encodeURIComponent(table)}/schema${params}`,
  )
  return response.json() as Promise<TableSchema>
}

export async function fetchStrictMode(
  datasource: string,
  database: string,
): Promise<boolean | null> {
  const response = await apiFetch(
    `/api/datasources/${encodeURIComponent(datasource)}/databases/${encodeURIComponent(database)}/strict`,
  )
  const data = await response.json() as { strict: boolean | null }
  return data.strict
}

export interface FkInfo {
  referenced_by: string[] | null
  depends_on: string[] | null
}

export async function fetchFkInfo(
  datasource: string,
  database: string,
  table: string,
): Promise<FkInfo> {
  const response = await apiFetch(
    `/api/datasources/${encodeURIComponent(datasource)}/databases/${encodeURIComponent(database)}/tables/${encodeURIComponent(table)}/fk`,
  )
  return response.json() as Promise<FkInfo>
}
