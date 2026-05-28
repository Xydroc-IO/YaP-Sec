export type ToolUiState = 'grey' | 'blue' | 'green' | 'red'

export interface ToolRow {
  id: string
  label: string
  binary: string
  package: string
  category?: 'pentest' | 'audit' | 'system' | string
  status: string
  ui: ToolUiState
  path: string | null
  note?: string | null
}

export interface ToolsStatusResponse {
  tools: ToolRow[]
  categories?: Record<string, string[]>
  install_enabled: boolean
  message: string
}
