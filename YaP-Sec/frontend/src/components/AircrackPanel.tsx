import { useEffect, useState } from 'react'
import { apiBase } from '../lib/api'
import { useIntelContext } from '../hooks/useIntelContext'
import { AdvancedArgsBuilder } from './AdvancedArgsBuilder'
import { AIRCRACK_FIELDS } from '../types/toolSchemas'

interface AircrackPanelProps {
  prefillIface?: string
}

export function AircrackPanel({ prefillIface }: AircrackPanelProps) {
  const [ifaces, setIfaces] = useState<string[]>([])
  const [iface, setIface] = useState('')
  const [seconds, setSeconds] = useState(8)
  const [extraArgs, setExtraArgs] = useState('')
  const [log, setLog] = useState<string | null>(null)
  const [output, setOutput] = useState<string>('')
  const [busy, setBusy] = useState(false)
  const [available, setAvailable] = useState<boolean | null>(null)
  const { context, push } = useIntelContext()

  useEffect(() => {
    if (prefillIface && prefillIface !== iface) setIface(prefillIface)
  }, [prefillIface, iface])

  const loadIfaces = async () => {
    try {
      const res = await fetch(`${apiBase()}/api/aircrack/interfaces`)
      const j = await res.json()
      if (!res.ok) throw new Error(typeof j?.detail === 'string' ? j.detail : JSON.stringify(j))
      const list = (j.interfaces as string[] | undefined) ?? []
      setIfaces(list)
      if (!iface && list.length) setIface(list[0])
    } catch (e) {
      setLog(e instanceof Error ? e.message : 'interface load failed')
    }
  }

  useEffect(() => {
    void loadIfaces()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const run = async () => {
    if (!iface) return
    setBusy(true)
    setLog(null)
    setOutput('')
    try {
      const res = await fetch(`${apiBase()}/api/aircrack/passive-scan`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          iface,
          seconds,
          extra_args: extraArgs.trim() ? extraArgs.trim().split(/\s+/) : [],
        }),
      })
      const j = await res.json()
      if (!res.ok) throw new Error(typeof j?.detail === 'string' ? j.detail : JSON.stringify(j))
      setOutput((j.stdout_tail as string) || (j.stderr_tail as string) || '')
      setLog(`Passive scan finished (${j.returncode})`)
      await push('iface', iface, 'aircrack-ui')
    } catch (e) {
      setLog(e instanceof Error ? e.message : 'aircrack scan failed')
    } finally {
      setBusy(false)
    }
  }

  const checkStatus = async () => {
    try {
      const res = await fetch(`${apiBase()}/api/aircrack/status`)
      const j = await res.json()
      setAvailable(Boolean(j?.available))
    } catch {
      setAvailable(false)
    }
  }

  const monitor = async (action: 'start' | 'stop') => {
    if (!iface) return
    setBusy(true)
    setLog(null)
    try {
      const res = await fetch(`${apiBase()}/api/aircrack/monitor`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ iface, action }),
      })
      const j = await res.json()
      if (!res.ok) throw new Error(typeof j?.detail === 'string' ? j.detail : JSON.stringify(j))
      setOutput((j.stdout_tail as string) || (j.stderr_tail as string) || '')
      setLog(`monitor ${action} finished (${j.returncode})`)
    } catch (e) {
      setLog(e instanceof Error ? e.message : 'monitor action failed')
    } finally {
      setBusy(false)
    }
  }

  return (
    <section className="rounded-lg border border-cyan-500/20 bg-[#0f0f0f] p-2 h-full min-h-0 flex flex-col gap-1.5">
      <h3 className="text-cyan-300 text-[10px] font-bold uppercase tracking-widest">Aircrack Suite</h3>
      <p className="text-[9px] text-zinc-600">Passive Wi-Fi survey for authorized labs only.</p>
      <div className="flex items-center gap-2 text-[9px]">
        <button type="button" onClick={() => void checkStatus()} className="px-2 py-0.5 rounded border border-zinc-700 text-zinc-300">Status</button>
        <span className={available === null ? 'text-zinc-600' : available ? 'text-emerald-400' : 'text-rose-400'}>
          {available === null ? 'unknown' : available ? 'available' : 'missing'}
        </span>
        <button type="button" onClick={() => void monitor('start')} disabled={!iface || busy} className="px-2 py-0.5 rounded border border-fuchsia-700/60 text-fuchsia-200 disabled:opacity-40">mon start</button>
        <button type="button" onClick={() => void monitor('stop')} disabled={!iface || busy} className="px-2 py-0.5 rounded border border-zinc-700 text-zinc-300 disabled:opacity-40">mon stop</button>
      </div>
      <div className="grid grid-cols-[1fr_auto_auto_auto] gap-1.5 items-center">
        <select value={iface} onChange={(e) => setIface(e.target.value)} className="bg-black/50 border border-zinc-800 rounded px-2 py-1 text-[10px]">
          <option value="">select iface</option>
          {ifaces.map((i) => (
            <option key={i} value={i}>
              {i}
            </option>
          ))}
        </select>
        <input type="number" min={3} max={20} value={seconds} onChange={(e) => setSeconds(Number(e.target.value))} className="w-14 bg-black/50 border border-zinc-800 rounded px-1 py-1 text-[10px]" />
        <button onClick={() => void loadIfaces()} className="px-2 py-1 rounded border border-zinc-700 text-zinc-300 text-[9px] uppercase">Refresh</button>
        <button onClick={() => void run()} disabled={busy || !iface} className="px-2 py-1 rounded border border-cyan-700/60 text-cyan-200 text-[9px] uppercase disabled:opacity-40">{busy ? '…' : 'Run'}</button>
      </div>
      <div className="flex items-center gap-2 text-[9px]">
        <button
          type="button"
          onClick={() => context.ifaces[0] && setIface(context.ifaces[0])}
          disabled={!context.ifaces.length}
          className="px-2 py-0.5 rounded border border-zinc-700 text-zinc-300 disabled:opacity-40"
        >
          Use last iface
        </button>
        {context.ifaces[0] ? <span className="text-zinc-600 truncate">{context.ifaces[0]}</span> : null}
      </div>
      <input
        value={extraArgs}
        onChange={(e) => setExtraArgs(e.target.value)}
        placeholder="advanced args, e.g. --band bg --write /tmp/cap"
        className="bg-black/50 border border-zinc-800 rounded px-2 py-1 text-[9px]"
      />
      <AdvancedArgsBuilder fields={AIRCRACK_FIELDS} onApply={setExtraArgs} />
      <div className="terminal-scroll flex-1 min-h-0 overflow-y-auto rounded border border-zinc-800 bg-black/40 p-1 text-[9px] text-zinc-400 whitespace-pre-wrap break-all">
        {output || 'Passive capture output appears here.'}
      </div>
      {log ? <p className="text-[9px] text-zinc-500">{log}</p> : null}
    </section>
  )
}
