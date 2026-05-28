import { useEffect, useState } from 'react'
import { apiBase } from '../lib/api'
import { useIntelContext } from '../hooks/useIntelContext'
import { AdvancedArgsBuilder } from './AdvancedArgsBuilder'
import { NMAP_FIELDS } from '../types/toolSchemas'

interface NmapPanelProps {
  prefillTarget?: string
}

export function NmapPanel({ prefillTarget }: NmapPanelProps) {
  const [target, setTarget] = useState('127.0.0.1')
  const [profile, setProfile] = useState('quick')
  const [extraArgs, setExtraArgs] = useState('')
  const [lines, setLines] = useState<string[]>([])
  const [log, setLog] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [available, setAvailable] = useState<boolean | null>(null)
  const { context, push } = useIntelContext()

  useEffect(() => {
    if (prefillTarget && prefillTarget !== target) setTarget(prefillTarget)
  }, [prefillTarget, target])

  const run = async () => {
    setBusy(true)
    setLog(null)
    try {
      const res = await fetch(`${apiBase()}/api/nmap/scan`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          target,
          profile,
          extra_args: extraArgs.trim() ? extraArgs.trim().split(/\s+/) : [],
        }),
      })
      const j = await res.json()
      if (!res.ok) throw new Error(typeof j?.detail === 'string' ? j.detail : JSON.stringify(j))
      setLines((j.open_ports as string[] | undefined) ?? [])
      setLog(`nmap ${profile} finished (${j.returncode})`)
      await push('target', target, 'nmap-ui')
    } catch (e) {
      setLog(e instanceof Error ? e.message : 'nmap failed')
    } finally {
      setBusy(false)
    }
  }

  const checkStatus = async () => {
    try {
      const res = await fetch(`${apiBase()}/api/nmap/status`)
      const j = await res.json()
      setAvailable(Boolean(j?.available))
    } catch {
      setAvailable(false)
    }
  }

  return (
    <section className="rounded-lg border border-cyan-500/20 bg-[#0f0f0f] p-2 h-full min-h-0 flex flex-col gap-1.5">
      <h3 className="text-cyan-300 text-[10px] font-bold uppercase tracking-widest">Nmap</h3>
      <div className="flex items-center gap-2 text-[9px]">
        <button type="button" onClick={() => void checkStatus()} className="px-2 py-0.5 rounded border border-zinc-700 text-zinc-300">Status</button>
        <span className={available === null ? 'text-zinc-600' : available ? 'text-emerald-400' : 'text-rose-400'}>
          {available === null ? 'unknown' : available ? 'available' : 'missing'}
        </span>
      </div>
      <div className="grid grid-cols-[1fr_auto_auto] gap-1.5">
        <input value={target} onChange={(e) => setTarget(e.target.value)} className="bg-black/50 border border-zinc-800 rounded px-2 py-1 text-[10px]" />
        <select value={profile} onChange={(e) => setProfile(e.target.value)} className="bg-black/50 border border-zinc-800 rounded px-2 py-1 text-[10px]">
          <option value="quick">quick</option>
          <option value="full_tcp">full_tcp</option>
          <option value="service">service</option>
        </select>
        <button onClick={() => void run()} disabled={busy} className="px-2 py-1 rounded border border-cyan-700/60 text-cyan-200 text-[9px] uppercase">{busy ? '…' : 'Run'}</button>
      </div>
      <div className="flex items-center gap-2 text-[9px]">
        <button
          type="button"
          onClick={() => context.targets[0] && setTarget(context.targets[0])}
          disabled={!context.targets.length}
          className="px-2 py-0.5 rounded border border-zinc-700 text-zinc-300 disabled:opacity-40"
        >
          Use last target
        </button>
        {context.targets[0] ? <span className="text-zinc-600 truncate">{context.targets[0]}</span> : null}
      </div>
      <input
        value={extraArgs}
        onChange={(e) => setExtraArgs(e.target.value)}
        placeholder="advanced args, e.g. -Pn --open"
        className="bg-black/50 border border-zinc-800 rounded px-2 py-1 text-[9px]"
      />
      <AdvancedArgsBuilder fields={NMAP_FIELDS} onApply={setExtraArgs} />
      <div className="terminal-scroll flex-1 min-h-0 overflow-y-auto rounded border border-zinc-800 bg-black/40 p-1 text-[9px] text-zinc-400">
        {lines.length ? lines.map((l, i) => <div key={i}>{l}</div>) : <span className="text-zinc-600">Open ports will appear here.</span>}
      </div>
      {log ? <p className="text-[9px] text-zinc-500">{log}</p> : null}
    </section>
  )
}
