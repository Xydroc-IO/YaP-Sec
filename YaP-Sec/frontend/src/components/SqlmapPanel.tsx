import { useEffect, useState } from 'react'
import { apiBase } from '../lib/api'
import { useIntelContext } from '../hooks/useIntelContext'
import { AdvancedArgsBuilder } from './AdvancedArgsBuilder'
import { SQLMAP_FIELDS } from '../types/toolSchemas'

interface SqlmapPanelProps {
  prefillUrl?: string
}

export function SqlmapPanel({ prefillUrl }: SqlmapPanelProps) {
  const [url, setUrl] = useState('https://example.com/item.php?id=1')
  const [risk, setRisk] = useState(1)
  const [level, setLevel] = useState(1)
  const [extraArgs, setExtraArgs] = useState('')
  const [findings, setFindings] = useState<string[]>([])
  const [log, setLog] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [available, setAvailable] = useState<boolean | null>(null)
  const { context, push } = useIntelContext()

  useEffect(() => {
    if (prefillUrl && prefillUrl !== url) setUrl(prefillUrl)
  }, [prefillUrl, url])

  const run = async () => {
    setBusy(true)
    setLog(null)
    try {
      const res = await fetch(`${apiBase()}/api/sqlmap/scan`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          url,
          risk,
          level,
          extra_args: extraArgs.trim() ? extraArgs.trim().split(/\s+/) : [],
        }),
      })
      const j = await res.json()
      if (!res.ok) throw new Error(typeof j?.detail === 'string' ? j.detail : JSON.stringify(j))
      setFindings((j.findings as string[] | undefined) ?? [])
      setLog(`sqlmap finished (${j.returncode})`)
      await push('url', url, 'sqlmap-ui')
    } catch (e) {
      setLog(e instanceof Error ? e.message : 'sqlmap failed')
    } finally {
      setBusy(false)
    }
  }

  const checkStatus = async () => {
    try {
      const res = await fetch(`${apiBase()}/api/sqlmap/status`)
      const j = await res.json()
      setAvailable(Boolean(j?.available))
    } catch {
      setAvailable(false)
    }
  }

  return (
    <section className="rounded-lg border border-amber-500/20 bg-[#0f0f0f] p-2 h-full min-h-0 flex flex-col gap-1.5">
      <h3 className="text-amber-300 text-[10px] font-bold uppercase tracking-widest">SQLMap</h3>
      <div className="flex items-center gap-2 text-[9px]">
        <button type="button" onClick={() => void checkStatus()} className="px-2 py-0.5 rounded border border-zinc-700 text-zinc-300">Status</button>
        <span className={available === null ? 'text-zinc-600' : available ? 'text-emerald-400' : 'text-rose-400'}>
          {available === null ? 'unknown' : available ? 'available' : 'missing'}
        </span>
      </div>
      <input value={url} onChange={(e) => setUrl(e.target.value)} className="bg-black/50 border border-zinc-800 rounded px-2 py-1 text-[10px]" />
      <div className="flex items-center gap-2 text-[9px]">
        <button
          type="button"
          onClick={() => context.urls[0] && setUrl(context.urls[0])}
          disabled={!context.urls.length}
          className="px-2 py-0.5 rounded border border-zinc-700 text-zinc-300 disabled:opacity-40"
        >
          Use last URL
        </button>
        <button
          type="button"
          onClick={() => context.suggested_urls?.[0] && setUrl(context.suggested_urls[0])}
          disabled={!context.suggested_urls?.length}
          className="px-2 py-0.5 rounded border border-amber-700/60 text-amber-300 disabled:opacity-40"
        >
          Use suggested
        </button>
        {context.urls[0] ? <span className="text-zinc-600 truncate">{context.urls[0]}</span> : null}
      </div>
      <div className="grid grid-cols-[auto_auto_auto] gap-1.5 items-center">
        <label className="text-[9px] text-zinc-500">risk
          <input type="number" min={1} max={3} value={risk} onChange={(e) => setRisk(Number(e.target.value))} className="ml-1 w-12 bg-black/50 border border-zinc-800 rounded px-1 py-0.5 text-[10px]" />
        </label>
        <label className="text-[9px] text-zinc-500">level
          <input type="number" min={1} max={5} value={level} onChange={(e) => setLevel(Number(e.target.value))} className="ml-1 w-12 bg-black/50 border border-zinc-800 rounded px-1 py-0.5 text-[10px]" />
        </label>
        <button onClick={() => void run()} disabled={busy} className="px-2 py-1 rounded border border-amber-700/60 text-amber-200 text-[9px] uppercase">{busy ? '…' : 'Run'}</button>
      </div>
      <input
        value={extraArgs}
        onChange={(e) => setExtraArgs(e.target.value)}
        placeholder="advanced args, e.g. --dbs --threads 5"
        className="bg-black/50 border border-zinc-800 rounded px-2 py-1 text-[9px]"
      />
      <AdvancedArgsBuilder fields={SQLMAP_FIELDS} onApply={setExtraArgs} />
      <div className="terminal-scroll flex-1 min-h-0 overflow-y-auto rounded border border-zinc-800 bg-black/40 p-1 text-[9px] text-zinc-400">
        {findings.length ? findings.map((f, i) => <div key={i}>{f}</div>) : <span className="text-zinc-600">Detected findings will appear here.</span>}
      </div>
      {log ? <p className="text-[9px] text-zinc-500">{log}</p> : null}
    </section>
  )
}
