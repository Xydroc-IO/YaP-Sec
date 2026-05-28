export type AuditSeverity = 'warning' | 'suggestion'

export interface AuditFinding {
  id: string
  source: string
  severity: AuditSeverity
  policy_name: string
  description: string
  raw: string
  fix_id?: string | null
  passed: boolean
}

export interface PolicyResult {
  policy_name: string
  status: 'pass' | 'fail' | 'unknown'
  count: number
}

export interface AuditChecklistResponse {
  ok: boolean
  log_path: string
  hardening_index: number
  findings: AuditFinding[]
  policy_results: PolicyResult[]
  executive_summary: string[]
  timestamp: string
}

export interface HealerPreviewResponse {
  ok: boolean
  fix_id: string
  risk: 'low' | 'high'
  target_files: string[]
  script: string
  dry_run: boolean
}

export interface HealerSnapshot {
  snapshot_id: string
  fix_id: string
  created_at: string
  file_count: number
}

export interface AuditReportMeta {
  path: string
  exists: boolean
  size: number
  updated_at: number | null
}

export interface AuditReportsResponse {
  ok: boolean
  reports: {
    openscap_html: AuditReportMeta
    openscap_xml: AuditReportMeta
    checkov_json: AuditReportMeta
    lynis_log: AuditReportMeta
  }
}
