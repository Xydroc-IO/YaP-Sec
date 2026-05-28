import { useEffect, useMemo, useState } from 'react'
import { apiBase } from '../lib/api'

interface Props {
  onScan: (ip: string, scanType: string) => Promise<void> | void
  prefillTarget?: string
}

export function OpsOrchestratorPanel({ onScan, prefillTarget }: Props) {
  const [target, setTarget] = useState('127.0.0.1')
  const [query, setQuery] = useState('smb')
  const [msfPassword, setMsfPassword] = useState('')
  const [results, setResults] = useState<string[]>([])
  const [log, setLog] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    if (prefillTarget && prefillTarget !== target) setTarget(prefillTarget)
  }, [prefillTarget, target])

  const statusColor = useMemo(() => (busy ? 'text-amber-300' : 'text-zinc-500'), [busy])

  const jfetch = async (url: string, init?: RequestInit) => {
    const res = await fetch(`${apiBase()}${url}`, {
      ...init,
      headers: { 'Content-Type': 'application/json', ...(init?.headers ?? {}) },
    })
    const text = await res.text()
    let body: any = {}
    try {
      body = JSON.parse(text)
    } catch {
      body = { raw: text }
    }
    if (!res.ok) throw new Error(typeof body?.detail === 'string' ? body.detail : text)
    return body
  }

  const quickStart = async () => {
    setBusy(true)
    setLog(null)
    try {
      const r = await jfetch('/api/orchestrator/quick-start', {
        method: 'POST',
        body: JSON.stringify({
          mode: 'offensive',
          msf_password: msfPassword || null,
          auto_install: true,
          auto_start_msf: true,
          auto_connect_msf: true,
          run_lynis_quick: false,
        }),
      })
      const summary = r?.automation_summary ?? {}
      const missing = Array.isArray(summary?.missing_tools) ? summary.missing_tools.length : 0
      const msf = summary?.msf_connected ? 'msf connected' : 'msf not connected'
      setLog(`Auto setup complete. Missing tools: ${missing} · ${msf}`)
    } catch (e) {
      setLog(e instanceof Error ? e.message : 'quick-start failed')
    } finally {
      setBusy(false)
    }
  }

  const searchExploits = async () => {
    setBusy(true)
    setLog(null)
    try {
      const r = await jfetch(`/api/msf/exploits?limit=30&q=${encodeURIComponent(query)}`)
      setResults(Array.isArray(r?.exploits) ? r.exploits : [])
      setLog(`Found ${r?.count ?? 0} modules`)
    } catch (e) {
      setLog(e instanceof Error ? e.message : 'search failed')
    } finally {
      setBusy(false)
    }
  }

  const startHandlerPreset = async () => {
    setBusy(true)
    setLog(null)
    try {
      const r = await jfetch('/api/msf/handler', {
        method: 'POST',
        body: JSON.stringify({
          lhost: target,
          lport: 4444,
          payload: 'linux/x64/meterpreter/reverse_tcp',
        }),
      })
      setLog(`Listener started: ${JSON.stringify(r?.result ?? r)}`)
    } catch (e) {
      setLog(e instanceof Error ? e.message : 'handler start failed')
    } finally {
      setBusy(false)
    }
  }

  return (
    <section className="rounded-lg border border-amber-500/20 bg-[#0f0f0f] p-2 flex flex-col gap-1.5 min-h-0 h-full overflow-hidden">
      <h2 className="text-amber-300 text-[10px] font-bold uppercase tracking-[0.2em]">Ops Orchestrator</h2>
      <p className={`text-[9px] font-mono ${statusColor}`}>{busy ? 'running…' : 'ready'}</p>

      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => void quickStart()}
          className="px-2 py-1 rounded border border-cyan-700/50 text-cyan-200 text-[9px] uppercase"
        >
          Auto Setup Everything
        </button>
        <button
          type="button"
          onClick={() => void onScan(target, 'quick')}
          className="px-2 py-1 rounded border border-amber-700/50 text-amber-200 text-[9px] uppercase"
        >
          Quick Network Scan
        </button>
      </div>

      <input
        type="password"
        value={msfPassword}
        onChange={(e) => setMsfPassword(e.target.value)}
        placeholder="msfrpcd password (for full auto setup)"
        className="bg-black/40 border border-zinc-800 rounded px-2 py-1 text-[10px] font-mono"
      />

      <div className="grid grid-cols-[1fr_auto] gap-2">
        <input
          value={target}
          onChange={(e) => setTarget(e.target.value)}
          placeholder="target host"
          className="bg-black/40 border border-zinc-800 rounded px-2 py-1 text-[10px] font-mono"
        />
        <button
          type="button"
          onClick={() => void startHandlerPreset()}
          className="px-2 py-1 rounded border border-rose-700/50 text-rose-200 text-[9px] uppercase"
        >
          Start Listener
        </button>
      </div>

      <div className="grid grid-cols-[1fr_auto] gap-2">
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="search exploit modules"
          className="bg-black/40 border border-zinc-800 rounded px-2 py-1 text-[10px] font-mono"
        />
        <button
          type="button"
          onClick={() => void searchExploits()}
          className="px-2 py-1 rounded border border-zinc-700 text-zinc-300 text-[9px] uppercase"
        >
          Search
        </button>
      </div>

      {results.length > 0 ? (
        <div className="flex-1 min-h-0 overflow-y-auto rounded border border-zinc-800 bg-black/40 p-1 text-[9px] text-zinc-400">
          {results.slice(0, 20).map((r) => (
            <div key={r} className="truncate">
              {r}
            </div>
          ))}
        </div>
      ) : null}
      {log ? <p className="text-[9px] text-zinc-500 break-words">{log}</p> : null}
    </section>
  )
}
