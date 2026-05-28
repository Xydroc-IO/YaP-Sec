import { useCallback, useEffect, useState } from 'react'
import { apiBase } from '../lib/api'
import type { ToolsStatusResponse } from '../types/tools'

export function useToolsStatus(pollMs = 2500) {
  const [data, setData] = useState<ToolsStatusResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchStatus = useCallback(async () => {
    try {
      const res = await fetch(`${apiBase()}/api/tools/status`)
      if (!res.ok) throw new Error(await res.text())
      const j = (await res.json()) as ToolsStatusResponse
      setData(j)
      setError(null)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'tools status failed')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void fetchStatus()
    const id = setInterval(() => {
      void fetchStatus()
    }, pollMs)
    return () => clearInterval(id)
  }, [fetchStatus, pollMs])

  const installTool = useCallback(
    async (tool_id: string) => {
      const res = await fetch(`${apiBase()}/api/tools/install`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tool_id }),
      })
      const j = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(typeof j?.detail === 'string' ? j.detail : JSON.stringify(j))
      await fetchStatus()
      return j
    },
    [fetchStatus],
  )

  const installStack = useCallback(async () => {
    const res = await fetch(`${apiBase()}/api/tools/install-stack`, {
      method: 'POST',
    })
    const j = await res.json().catch(() => ({}))
    if (!res.ok) throw new Error(typeof j?.detail === 'string' ? j.detail : JSON.stringify(j))
    await fetchStatus()
    return j
  }, [fetchStatus])

  return { data, loading, error, refetch: fetchStatus, installTool, installStack }
}
