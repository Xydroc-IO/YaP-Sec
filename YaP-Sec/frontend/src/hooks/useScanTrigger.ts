import { useCallback, useState } from 'react'
import { apiBase } from '../lib/api'

export interface ScanPayload {
  target_ip: string
  scan_type: string
}

export interface UseScanTriggerResult {
  loading: boolean
  lastResponse: string | null
  error: string | null
  triggerScan: (p: ScanPayload) => Promise<void>
}

export function useScanTrigger(): UseScanTriggerResult {
  const [loading, setLoading] = useState(false)
  const [lastResponse, setLastResponse] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const triggerScan = useCallback(async (p: ScanPayload) => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(`${apiBase()}/trigger-scan`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(p),
      })
      const text = await res.text()
      if (!res.ok) throw new Error(text || res.statusText)
      setLastResponse(text)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Request failed')
      setLastResponse(null)
    } finally {
      setLoading(false)
    }
  }, [])

  return { loading, lastResponse, error, triggerScan }
}
