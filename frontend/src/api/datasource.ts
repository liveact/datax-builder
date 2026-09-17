import { apiFetch } from '@/api/client'
import type {
  DatabaseListResponse,
  DatasourceInfo,
  TableListResponse,
} from '@/types/datasource'

export async function fetchDatasources(): Promise<DatasourceInfo[]> {
  const response = await apiFetch('/api/datasources')
  return response.json() as Promise<DatasourceInfo[]>
}

export async function fetchDatabases(
  datasource: string,
): Promise<DatabaseListResponse> {
  const response = await apiFetch(
    `/api/datasources/${encodeURIComponent(datasource)}/databases`,
  )
  return response.json() as Promise<DatabaseListResponse>
}

export async function fetchTables(
  datasource: string,
  database: string,
): Promise<TableListResponse> {
  const response = await apiFetch(
    `/api/datasources/${encodeURIComponent(datasource)}/databases/${encodeURIComponent(database)}/tables`,
  )
  return response.json() as Promise<TableListResponse>
}

export async function testConnection(
  datasource: string,
  database?: string,
): Promise<{ ok: boolean; message: string }> {
  const params = database ? `?database=${encodeURIComponent(database)}` : ''
  const response = await apiFetch(
    `/api/datasources/${encodeURIComponent(datasource)}/test${params}`,
  )
  return response.json()
}
