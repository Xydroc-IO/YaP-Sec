import { useMemo } from 'react'
import type { FeedMessage, ThreatFinding } from '../types/feed'

function severityRank(s: string | undefined): number {
  if (s === 'critical') return 3
  if (s === 'warn') return 2
  return 1
}

export interface UseThreatFeedResult {
  threats: ThreatFinding[]
  latestByModule: Record<string, ThreatFinding | undefined>
  criticalCount: number
}

export function useThreatFeed(messages: FeedMessage[]): UseThreatFeedResult {
  return useMemo(() => {
    const threats: ThreatFinding[] = []
    const latestByModule: Record<string, ThreatFinding | undefined> = {}

    for (const m of messages) {
      if (m.type !== 'threat' && m.type !== 'scan') continue
      const id = `${m.timestamp ?? ''}-${m.message}-${threats.length}`
      const t: ThreatFinding = {
        id,
        module: m.module,
        title: m.type === 'scan' ? `Scan: ${String(m.meta?.scan_type ?? 'unknown')}` : 'Threat signal',
        severity: m.severity ?? 'info',
        detail: m.message,
        timestamp: m.timestamp ?? new Date().toISOString(),
      }
      threats.push(t)
      if (!latestByModule[m.module] || severityRank(t.severity) >= severityRank(latestByModule[m.module]?.severity)) {
        latestByModule[m.module] = t
      }
    }

    const criticalCount = threats.filter((t) => t.severity === 'critical').length

    return { threats: threats.slice(-80).reverse(), latestByModule, criticalCount }
  }, [messages])
}
