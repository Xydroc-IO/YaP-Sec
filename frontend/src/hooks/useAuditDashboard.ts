import { useCallback, useEffect, useState } from 'react'
import { apiBase } from '../lib/api'
import type { AuditChecklistResponse, AuditReportsResponse, HealerPreviewResponse, HealerSnapshot } from '../types/audit'

async function parseJson<T>(res: Response): Promise<T> {
  if (!res.ok) throw new Error(await res.text())
  return (await res.json()) as T
}

export function useAuditDashboard(pollMs = 5000) {
  const [data, setData] = useState<AuditChecklistResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [busyFix, setBusyFix] = useState<string | null>(null)
  const [healerPreview, setHealerPreview] = useState<HealerPreviewResponse | null>(null)
  const [healerSnapshots, setHealerSnapshots] = useState<HealerSnapshot[]>([])
  const [reports, setReports] = useState<AuditReportsResponse['reports'] | null>(null)

  const refresh = useCallback(async () => {
    try {
      const res = await fetch(`${apiBase()}/api/audit/lynis/checklist`)
      const j = await parseJson<AuditChecklistResponse>(res)
      setData(j)
      setError(null)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'audit checklist failed')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void refresh()
    const id = setInterval(() => void refresh(), pollMs)
    return () => clearInterval(id)
  }, [pollMs, refresh])

  const runLynis = useCallback(async (quick = true) => {
    const res = await fetch(`${apiBase()}/api/audit/lynis/run`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ quick }),
    })
    const j = await res.json().catch(() => ({}))
    if (!res.ok) throw new Error(typeof j?.detail === 'string' ? j.detail : JSON.stringify(j))
    await refresh()
    return j
  }, [refresh])

  const runOpenScap = useCallback(async (profile?: string) => {
    const res = await fetch(`${apiBase()}/api/audit/openscap/run`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ profile: profile || null }),
    })
    const j = await res.json().catch(() => ({}))
    if (!res.ok) throw new Error(typeof j?.detail === 'string' ? j.detail : JSON.stringify(j))
    return j
  }, [])

  const runCheckov = useCallback(async (path = '.') => {
    const res = await fetch(`${apiBase()}/api/audit/checkov/run`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ path }),
    })
    const j = await res.json().catch(() => ({}))
    if (!res.ok) throw new Error(typeof j?.detail === 'string' ? j.detail : JSON.stringify(j))
    return j
  }, [])

  const runFix = useCallback(async (fix_id: string) => {
    setBusyFix(fix_id)
    try {
      const res = await fetch(`${apiBase()}/api/audit/fix`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fix_id }),
      })
      const j = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(typeof j?.detail === 'string' ? j.detail : JSON.stringify(j))
      await refresh()
      return j
    } finally {
      setBusyFix(null)
    }
  }, [refresh])

  const previewFixScript = useCallback(async (fix_id: string) => {
    const res = await fetch(`${apiBase()}/api/audit/healer/preview`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ fix_id }),
    })
    const j = await res.json().catch(() => ({}))
    if (!res.ok) throw new Error(typeof j?.detail === 'string' ? j.detail : JSON.stringify(j))
    setHealerPreview(j as HealerPreviewResponse)
    return j as HealerPreviewResponse
  }, [])

  const loadSnapshots = useCallback(async () => {
    const res = await fetch(`${apiBase()}/api/audit/healer/snapshots`)
    const j = await res.json().catch(() => ({}))
    if (!res.ok) throw new Error(typeof j?.detail === 'string' ? j.detail : JSON.stringify(j))
    setHealerSnapshots(Array.isArray(j?.snapshots) ? (j.snapshots as HealerSnapshot[]) : [])
    return j
  }, [])

  const applyHealerFix = useCallback(async (fix_id: string, dry_run = true) => {
    setBusyFix(fix_id)
    try {
      const res = await fetch(`${apiBase()}/api/audit/healer/apply`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fix_id, dry_run }),
      })
      const j = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(typeof j?.detail === 'string' ? j.detail : JSON.stringify(j))
      await Promise.all([refresh(), loadSnapshots()])
      return j
    } finally {
      setBusyFix(null)
    }
  }, [loadSnapshots, refresh])

  const hardenSystem = useCallback(async (dry_run = true, quick = true) => {
    const res = await fetch(`${apiBase()}/api/audit/harden-system`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ dry_run, quick }),
    })
    const j = await res.json().catch(() => ({}))
    if (!res.ok) throw new Error(typeof j?.detail === 'string' ? j.detail : JSON.stringify(j))
    await Promise.all([refresh(), loadSnapshots()])
    return j
  }, [loadSnapshots, refresh])

  const rollbackSnapshot = useCallback(async (snapshot_id: string) => {
    const res = await fetch(`${apiBase()}/api/audit/healer/rollback`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ snapshot_id }),
    })
    const j = await res.json().catch(() => ({}))
    if (!res.ok) throw new Error(typeof j?.detail === 'string' ? j.detail : JSON.stringify(j))
    await Promise.all([refresh(), loadSnapshots()])
    return j
  }, [loadSnapshots, refresh])

  const loadReports = useCallback(async () => {
    const res = await fetch(`${apiBase()}/api/audit/reports`)
    const j = await res.json().catch(() => ({}))
    if (!res.ok) throw new Error(typeof j?.detail === 'string' ? j.detail : JSON.stringify(j))
    const typed = j as AuditReportsResponse
    setReports(typed.reports)
    return typed
  }, [])

  const openscapHtmlUrl = `${apiBase()}/api/audit/reports/openscap/html`
  const lynisLogUrl = `${apiBase()}/api/audit/reports/lynis/log`
  const checkovJsonUrl = `${apiBase()}/api/audit/reports/checkov/json`

  useEffect(() => {
    void loadSnapshots()
  }, [loadSnapshots])

  useEffect(() => {
    void loadReports()
  }, [loadReports])

  const regenerateSummary = useCallback(async () => {
    const findings = data?.findings ?? []
    const res = await fetch(`${apiBase()}/api/audit/executive-summary`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ findings }),
    })
    const j = await res.json().catch(() => ({}))
    if (!res.ok) throw new Error(typeof j?.detail === 'string' ? j.detail : JSON.stringify(j))
    if (Array.isArray(j?.bullets)) {
      setData((prev) => (prev ? { ...prev, executive_summary: j.bullets, hardening_index: j.hardening_index ?? prev.hardening_index } : prev))
    }
    return j
  }, [data?.findings])

  return {
    data,
    loading,
    error,
    busyFix,
    healerPreview,
    healerSnapshots,
    reports,
    openscapHtmlUrl,
    lynisLogUrl,
    checkovJsonUrl,
    refresh,
    runLynis,
    runOpenScap,
    runCheckov,
    runFix,
    previewFixScript,
    applyHealerFix,
    hardenSystem,
    rollbackSnapshot,
    loadSnapshots,
    loadReports,
    regenerateSummary,
  }
}
