import { useCallback, useEffect, useState } from 'react'
import { apiBase } from '../lib/api'

export interface IntelContextData {
  targets: string[]
  urls: string[]
  ifaces: string[]
  open_ports: string[]
  suggested_urls?: string[]
  events: Array<{ type: string; value: string; source: string; timestamp: string }>
}

const EMPTY: IntelContextData = { targets: [], urls: [], ifaces: [], open_ports: [], events: [] }

export function useIntelContext() {
  const [context, setContext] = useState<IntelContextData>(EMPTY)

  const refresh = useCallback(async () => {
    try {
      const res = await fetch(`${apiBase()}/api/intel/context`)
      if (!res.ok) return
      const j = (await res.json()) as { context?: IntelContextData }
      if (j.context) setContext(j.context)
    } catch {
      /* ignore */
    }
  }, [])

  const push = useCallback(async (kind: 'target' | 'url' | 'iface', value: string, source: string) => {
    try {
      await fetch(`${apiBase()}/api/intel/push`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ kind, value, source }),
      })
      await refresh()
    } catch {
      /* ignore */
    }
  }, [refresh])

  useEffect(() => {
    void refresh()
  }, [refresh])

  return { context, refresh, push }
}
