export type PentestModule = 'network' | 'web' | 'social'

export type FeedSeverity = 'info' | 'warn' | 'critical'

export interface FeedMessage {
  module: PentestModule
  type: 'log' | 'status' | 'threat' | 'scan' | 'healer'
  message: string
  severity?: FeedSeverity
  timestamp?: string
  meta?: Record<string, unknown>
}

export interface ThreatFinding {
  id: string
  module: PentestModule
  title: string
  severity: FeedSeverity
  detail: string
  timestamp: string
}

export type OperationMode = 'defensive' | 'offensive' | 'audit'
