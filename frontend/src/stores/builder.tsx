import {
  createContext,
  useContext,
  useReducer,
  type Dispatch,
  type ReactNode,
} from 'react'
import type { SchemaCheckState } from '@/types/compare'
import type { DatasourceInfo } from '@/types/datasource'
import type { FieldMapping, SyncConfig } from '@/types/job'
import type { TableSchema } from '@/types/schema'

export interface DataSourceRef {
  datasource: string | null
  database: string | null
  table: string | null
}

export interface BuilderState {
  datasources: DatasourceInfo[]
  source: DataSourceRef
  target: DataSourceRef
  sourceSchema: TableSchema | null
  targetSchema: TableSchema | null
  compareResult: SchemaCheckState | null
  mappings: FieldMapping[]
  syncConfig: SyncConfig
  taskName: string
  generatedJson: Record<string, unknown> | null
  isComparing: boolean
  isGenerating: boolean
  exactCount: boolean
}

const emptyDataSourceRef: DataSourceRef = {
  datasource: null,
  database: null,
  table: null,
}

export const initialBuilderState: BuilderState = {
  datasources: [],
  source: { ...emptyDataSourceRef },
  target: { ...emptyDataSourceRef },
  sourceSchema: null,
  targetSchema: null,
  compareResult: null,
  mappings: [],
  syncConfig: { mode: 'full', incremental: null, split_pk: null, channel: 1, batch_size: 2048, incremental_window_days: 3 },
  taskName: '',
  generatedJson: null,
  isComparing: false,
  isGenerating: false,
  exactCount: false,
}

export type BuilderAction =
  | { type: 'SET_DATASOURCES'; payload: DatasourceInfo[] }
  | { type: 'SET_SOURCE_DATASOURCE'; payload: string | null }
  | { type: 'SET_SOURCE_DATABASE'; payload: string | null }
  | { type: 'SET_SOURCE_TABLE'; payload: string | null }
  | { type: 'SET_TARGET_DATASOURCE'; payload: string | null }
  | { type: 'SET_TARGET_DATABASE'; payload: string | null }
  | { type: 'SET_TARGET_TABLE'; payload: string | null }
  | { type: 'SET_SOURCE_SCHEMA'; payload: TableSchema | null }
  | { type: 'SET_TARGET_SCHEMA'; payload: TableSchema | null }
  | { type: 'SET_COMPARE_RESULT'; payload: SchemaCheckState | null }
  | { type: 'SET_MAPPINGS'; payload: FieldMapping[] }
  | { type: 'SET_SYNC_CONFIG'; payload: SyncConfig }
  | { type: 'SET_TASK_NAME'; payload: string }
  | { type: 'SET_GENERATED_JSON'; payload: Record<string, unknown> | null }
  | { type: 'SET_IS_COMPARING'; payload: boolean }
  | { type: 'SET_IS_GENERATING'; payload: boolean }
  | { type: 'SET_EXACT_COUNT'; payload: boolean }
  | { type: 'RESET' }

function clearCompareState(): Partial<BuilderState> {
  return {
    compareResult: null,
    mappings: [],
    generatedJson: null,
    syncConfig: { ...initialBuilderState.syncConfig },
    taskName: '',
  }
}

function builderReducer(state: BuilderState, action: BuilderAction): BuilderState {
  switch (action.type) {
    case 'SET_DATASOURCES':
      return { ...state, datasources: action.payload }
    case 'SET_SOURCE_DATASOURCE':
      return {
        ...state,
        source: {
          datasource: action.payload,
          database: null,
          table: null,
        },
        sourceSchema: null,
        ...clearCompareState(),
      }
    case 'SET_SOURCE_DATABASE':
      return {
        ...state,
        source: {
          ...state.source,
          database: action.payload,
          table: null,
        },
        sourceSchema: null,
        ...clearCompareState(),
      }
    case 'SET_SOURCE_TABLE':
      return {
        ...state,
        source: {
          ...state.source,
          table: action.payload,
        },
        sourceSchema: null,
        ...clearCompareState(),
      }
    case 'SET_TARGET_DATASOURCE':
      return {
        ...state,
        target: {
          datasource: action.payload,
          database: null,
          table: null,
        },
        targetSchema: null,
        ...clearCompareState(),
      }
    case 'SET_TARGET_DATABASE':
      return {
        ...state,
        target: {
          ...state.target,
          database: action.payload,
          table: null,
        },
        targetSchema: null,
        ...clearCompareState(),
      }
    case 'SET_TARGET_TABLE':
      return {
        ...state,
        target: {
          ...state.target,
          table: action.payload,
        },
        targetSchema: null,
        ...clearCompareState(),
      }
    case 'SET_SOURCE_SCHEMA':
      return { ...state, sourceSchema: action.payload }
    case 'SET_TARGET_SCHEMA':
      return { ...state, targetSchema: action.payload }
    case 'SET_COMPARE_RESULT':
      return { ...state, compareResult: action.payload }
    case 'SET_MAPPINGS':
      return { ...state, mappings: action.payload }
    case 'SET_SYNC_CONFIG':
      return { ...state, syncConfig: action.payload }
    case 'SET_TASK_NAME':
      return { ...state, taskName: action.payload }
    case 'SET_GENERATED_JSON':
      return { ...state, generatedJson: action.payload }
    case 'SET_IS_COMPARING':
      return { ...state, isComparing: action.payload }
    case 'SET_IS_GENERATING':
      return { ...state, isGenerating: action.payload }
    case 'SET_EXACT_COUNT':
      return { ...state, exactCount: action.payload }
    case 'RESET':
      return initialBuilderState
    default:
      return state
  }
}

interface BuilderContextValue {
  state: BuilderState
  dispatch: Dispatch<BuilderAction>
}

const BuilderContext = createContext<BuilderContextValue | null>(null)

export function BuilderProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(builderReducer, initialBuilderState)

  return (
    <BuilderContext.Provider value={{ state, dispatch }}>
      {children}
    </BuilderContext.Provider>
  )
}

export function useBuilder(): BuilderContextValue {
  const context = useContext(BuilderContext)

  if (!context) {
    throw new Error('useBuilder must be used within a BuilderProvider')
  }

  return context
}
