import { useState } from 'react'
import { useAuditDashboard } from '../hooks/useAuditDashboard'

function scoreColor(score: number): string {
  if (score >= 85) return 'text-emerald-400'
  if (score >= 65) return 'text-amber-300'
  return 'text-rose-400'
}

export function ComplianceDashboard() {
  const {
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
    runLynis,
    runOpenScap,
    runCheckov,
    previewFixScript,
    applyHealerFix,
    hardenSystem,
    rollbackSnapshot,
    loadReports,
    regenerateSummary,
  } = useAuditDashboard(6000)

  const [status, setStatus] = useState<string | null>(null)
  const [dryRun, setDryRun] = useState(true)
  const [quickMode, setQuickMode] = useState(true)
  const [hardenProgress, setHardenProgress] = useState(0)
  const [selectedSnapshot, setSelectedSnapshot] = useState('')
  const score = data?.hardening_index ?? 0

  return (
    <section className="rounded-lg border border-rose-500/20 bg-[#0f0f0f] p-3 min-h-0 h-full overflow-hidden flex flex-col gap-2">
      <div className="flex items-start justify-between gap-2">
        <div>
          <h2 className="text-rose-300 text-xs uppercase font-bold tracking-[0.2em]">Compliance Radar</h2>
          <p className="text-zinc-600 text-[10px] font-mono">Lynis · OpenSCAP · Checkov</p>
        </div>
        {loading ? <span className="text-zinc-600 text-[10px] font-mono">loading…</span> : null}
      </div>

      {data?.executive_summary?.length ? (
        <div className="rounded border border-zinc-800 bg-black/35 p-2 text-[10px] font-mono text-zinc-300 space-y-1">
          {data.executive_summary.slice(0, 3).map((b, i) => (
            <p key={i}>
              <span className="text-zinc-600 mr-1">•</span>
              {b}
            </p>
          ))}
        </div>
      ) : null}

      <div className="grid grid-cols-[auto_1fr] gap-3 items-center rounded border border-zinc-800 bg-black/40 px-3 py-2">
        <div className={`text-4xl sm:text-5xl font-bold leading-none ${scoreColor(score)}`}>{score}</div>
        <div>
          <p className="text-zinc-400 text-[10px] uppercase tracking-widest">Hardening Index</p>
          <div className="h-2 mt-1 rounded bg-zinc-900 overflow-hidden">
            <div
              className={`h-full ${score >= 85 ? 'bg-emerald-500' : score >= 65 ? 'bg-amber-500' : 'bg-rose-500'}`}
              style={{ width: `${Math.min(100, Math.max(0, score))}%` }}
            />
          </div>
        </div>
      </div>

      <div className="flex flex-wrap gap-2 text-[9px] font-bold uppercase">
        <button
          type="button"
          onClick={() => {
            setHardenProgress(5)
            void hardenSystem(dryRun, quickMode)
              .then((j) => {
                const applied = Array.isArray(j?.applied) ? j.applied : []
                const pct = applied.length ? Number(applied[applied.length - 1]?.progress_pct ?? 100) : 100
                setHardenProgress(Math.min(100, Math.max(0, pct)))
                setStatus(
                  dryRun
                    ? `Dry-run hardening complete (${j?.candidate_fix_count ?? 0} low-risk fixes previewed).`
                    : `Hardening complete (${j?.candidate_fix_count ?? 0} low-risk fixes processed).`,
                )
              })
              .catch((e) => {
                setHardenProgress(0)
                setStatus(e.message)
              })
          }}
          className="px-2 py-1 rounded border border-emerald-500/35 text-emerald-200 hover:bg-emerald-950/30"
        >
          Harden System
        </button>
        <button
          type="button"
          onClick={() => void runLynis(true).then(() => setStatus('Lynis quick audit done')).catch((e) => setStatus(e.message))}
          className="px-2 py-1 rounded border border-rose-500/35 text-rose-200 hover:bg-rose-950/30"
        >
          Run Lynis
        </button>
        <button
          type="button"
          onClick={() => void runOpenScap().then(() => setStatus('OpenSCAP report generated')).catch((e) => setStatus(e.message))}
          className="px-2 py-1 rounded border border-cyan-500/35 text-cyan-200 hover:bg-cyan-950/30"
        >
          Run OpenSCAP
        </button>
        <button
          type="button"
          onClick={() => void runCheckov('.').then(() => setStatus('Checkov scan complete')).catch((e) => setStatus(e.message))}
          className="px-2 py-1 rounded border border-amber-500/35 text-amber-200 hover:bg-amber-950/30"
        >
          Run Checkov
        </button>
        <button
          type="button"
          onClick={() => void regenerateSummary().then(() => setStatus('Executive summary refreshed')).catch((e) => setStatus(e.message))}
          className="px-2 py-1 rounded border border-zinc-700 text-zinc-300 hover:bg-zinc-900"
        >
          Refresh CEO Summary
        </button>
        <button
          type="button"
          onClick={() => void loadReports().then(() => setStatus('Report status refreshed')).catch((e) => setStatus(e.message))}
          className="px-2 py-1 rounded border border-zinc-700 text-zinc-300 hover:bg-zinc-900"
        >
          Refresh Reports
        </button>
        <label className="flex items-center gap-1 text-zinc-400 normal-case">
          <input type="checkbox" checked={dryRun} onChange={(e) => setDryRun(e.target.checked)} className="accent-emerald-500" />
          Dry Run
        </label>
        <label className="flex items-center gap-1 text-zinc-400 normal-case">
          <input type="checkbox" checked={quickMode} onChange={(e) => setQuickMode(e.target.checked)} className="accent-cyan-500" />
          Quick Audit
        </label>
      </div>
      <div className="h-1.5 rounded bg-zinc-900 overflow-hidden">
        <div className="h-full bg-emerald-500" style={{ width: `${hardenProgress}%` }} />
      </div>
      {status ? <p className="text-[10px] text-zinc-500 font-mono">{status}</p> : null}
      {error ? <p className="text-[10px] text-rose-400 font-mono">{error}</p> : null}

      <div className="grid grid-cols-2 gap-2 min-h-0 flex-1 overflow-hidden">
        <div className="rounded border border-zinc-800 bg-black/35 overflow-y-auto">
          <div className="sticky top-0 bg-zinc-950/95 border-b border-zinc-800 px-2 py-1 text-[10px] text-zinc-500 uppercase tracking-wider">
            Policy Name
          </div>
          <ul className="text-[10px] font-mono divide-y divide-zinc-900/80">
            {(data?.policy_results ?? []).length === 0 ? (
              <li className="px-2 py-2 text-zinc-600">No policy data yet. Run Lynis or baseline checks.</li>
            ) : (
              (data?.policy_results ?? []).map((p) => (
                <li key={p.policy_name} className="px-2 py-1.5 text-zinc-300 truncate" title={p.policy_name}>
                  {p.policy_name}
                </li>
              ))
            )}
          </ul>
        </div>
        <div className="rounded border border-zinc-800 bg-black/35 overflow-y-auto">
          <div className="sticky top-0 bg-zinc-950/95 border-b border-zinc-800 px-2 py-1 text-[10px] text-zinc-500 uppercase tracking-wider">
            Result
          </div>
          <ul className="text-[10px] font-mono divide-y divide-zinc-900/80">
            {(data?.policy_results ?? []).length === 0 ? (
              <li className="px-2 py-2 text-zinc-700">—</li>
            ) : (
              (data?.policy_results ?? []).map((p) => (
                <li key={p.policy_name} className="px-2 py-1.5">
                  {p.status === 'pass' ? (
                    <span className="text-emerald-400">✔ Pass</span>
                  ) : p.status === 'unknown' ? (
                    <span className="text-amber-300">• Unknown</span>
                  ) : (
                    <span className="text-rose-400">✖ Fail</span>
                  )}
                </li>
              ))
            )}
          </ul>
        </div>
      </div>

      <div className="rounded border border-zinc-800 bg-black/35 overflow-y-auto max-h-40">
        <div className="sticky top-0 bg-zinc-950/95 border-b border-zinc-800 px-2 py-1 text-[10px] text-zinc-500 uppercase tracking-wider">
          Hardening Checklist
        </div>
        <ul className="text-[10px] font-mono divide-y divide-zinc-900/80">
          {(data?.findings ?? []).slice(0, 80).map((f) => (
            <li key={f.id} className="px-2 py-1.5 flex items-start gap-2">
              <span className={f.severity === 'warning' ? 'text-rose-400' : 'text-amber-300'}>
                {f.severity === 'warning' ? '!' : 'i'}
              </span>
              <div className="flex-1 min-w-0">
                <p className="text-zinc-200 truncate">{f.description}</p>
                <p className="text-zinc-600 truncate">{f.policy_name}</p>
              </div>
              {f.fix_id ? (
                <div className="shrink-0 flex gap-1">
                  <button
                    type="button"
                    onClick={() =>
                      void previewFixScript(f.fix_id ?? '')
                        .then(() => setStatus(`Loaded script preview: ${f.fix_id}`))
                        .catch((e) => setStatus(e.message))
                    }
                    className="px-2 py-1 rounded border border-cyan-700/60 text-cyan-300 text-[9px] uppercase"
                  >
                    Preview
                  </button>
                  <button
                    type="button"
                    disabled={busyFix === f.fix_id}
                    onClick={() =>
                      void applyHealerFix(f.fix_id ?? '', dryRun)
                        .then(() => setStatus(`${dryRun ? 'Dry-run' : 'Applied'} fix: ${f.fix_id}`))
                        .catch((e) => setStatus(e.message))
                    }
                    className="px-2 py-1 rounded border border-emerald-700/60 text-emerald-300 text-[9px] uppercase disabled:opacity-40"
                  >
                    {busyFix === f.fix_id ? '…' : dryRun ? 'Dry Run' : 'Apply'}
                  </button>
                </div>
              ) : (
                <span className="text-zinc-700 text-[9px] uppercase">n/a</span>
              )}
            </li>
          ))}
        </ul>
      </div>
      {healerPreview ? (
        <div className="rounded border border-zinc-800 bg-black/35 overflow-y-auto max-h-32 p-2">
          <p className="text-[10px] text-zinc-400 mb-1 font-mono">
            Script Preview · {healerPreview.fix_id} · risk: {healerPreview.risk}
          </p>
          <pre className="text-[9px] text-zinc-500 whitespace-pre-wrap break-all font-mono">{healerPreview.script}</pre>
        </div>
      ) : null}
      <div className="rounded border border-zinc-800 bg-black/35 p-2 space-y-1">
        <p className="text-[10px] text-zinc-500 uppercase tracking-wider">Rollback</p>
        <div className="flex items-center gap-2">
          <select
            value={selectedSnapshot}
            onChange={(e) => setSelectedSnapshot(e.target.value)}
            className="flex-1 bg-black/50 border border-zinc-800 rounded px-2 py-1 text-[9px] font-mono"
          >
            <option value="">Select snapshot</option>
            {healerSnapshots.map((s) => (
              <option key={s.snapshot_id} value={s.snapshot_id}>
                {s.snapshot_id} · {s.fix_id}
              </option>
            ))}
          </select>
          <button
            type="button"
            disabled={!selectedSnapshot}
            onClick={() =>
              void rollbackSnapshot(selectedSnapshot)
                .then(() => setStatus(`Rollback complete: ${selectedSnapshot}`))
                .catch((e) => setStatus(e.message))
            }
            className="px-2 py-1 rounded border border-amber-700/60 text-amber-300 text-[9px] uppercase disabled:opacity-40"
          >
            Rollback
          </button>
        </div>
      </div>
      <div className="rounded border border-zinc-800 bg-black/35 p-2 space-y-1">
        <p className="text-[10px] text-zinc-500 uppercase tracking-wider">Reports</p>
        <div className="flex flex-wrap gap-2 text-[9px] uppercase">
          <button
            type="button"
            onClick={() => window.open(openscapHtmlUrl, '_blank', 'noopener,noreferrer')}
            disabled={!reports?.openscap_html.exists}
            className="px-2 py-1 rounded border border-cyan-700/60 text-cyan-300 disabled:opacity-40"
          >
            Open OpenSCAP HTML
          </button>
          <button
            type="button"
            onClick={() => window.open(`${lynisLogUrl}?tail=500`, '_blank', 'noopener,noreferrer')}
            disabled={!reports?.lynis_log.exists}
            className="px-2 py-1 rounded border border-amber-700/60 text-amber-300 disabled:opacity-40"
          >
            Open Lynis Log
          </button>
          <button
            type="button"
            onClick={() => window.open(checkovJsonUrl, '_blank', 'noopener,noreferrer')}
            disabled={!reports?.checkov_json.exists}
            className="px-2 py-1 rounded border border-fuchsia-700/60 text-fuchsia-300 disabled:opacity-40"
          >
            Open Checkov JSON
          </button>
        </div>
        <p className="text-[9px] text-zinc-600 font-mono">
          OpenSCAP: {reports?.openscap_html.exists ? 'ready' : 'missing'} · Checkov:{' '}
          {reports?.checkov_json.exists ? 'ready' : 'missing'} · Lynis: {reports?.lynis_log.exists ? 'ready' : 'missing'}
        </p>
      </div>
    </section>
  )
}
