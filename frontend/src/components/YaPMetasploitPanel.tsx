import { useEffect, useMemo, useState } from 'react'
import { apiBase } from '../lib/api'
import { useIntelContext } from '../hooks/useIntelContext'

interface Props {
  prefillTarget?: string
}

const PRESETS: Array<{ label: string; args: string }> = [
  { label: 'Version', args: '--version' },
  { label: 'Quick Check', args: 'status --quick' },
  { label: 'Scan Target', args: 'scan --target 127.0.0.1' },
  { label: 'List Modules', args: 'modules list --limit 30' },
]

export function YaPMetasploitPanel({ prefillTarget }: Props) {
  const [enabled, setEnabled] = useState<boolean | null>(null)
  const [available, setAvailable] = useState<boolean | null>(null)
  const [cmd, setCmd] = useState('yapmetasploit')
  const [argsText, setArgsText] = useState('status --quick')
  const [timeoutSec, setTimeoutSec] = useState(45)
  const [busy, setBusy] = useState(false)
  const [stdout, setStdout] = useState('')
  const [stderr, setStderr] = useState('')
  const [log, setLog] = useState<string | null>(null)
  const [candidates, setCandidates] = useState<string[]>([])
  const [guiRunning, setGuiRunning] = useState<boolean | null>(null)
  const [guiEntry, setGuiEntry] = useState('')
  const [guiLogPath, setGuiLogPath] = useState('')
  const { push } = useIntelContext()

  const args = useMemo(() => argsText.trim().split(/\s+/).filter(Boolean), [argsText])

  const checkStatus = async () => {
    try {
      const res = await fetch(`${apiBase()}/api/yapmetasploit/status`)
      const j = await res.json()
      setEnabled(Boolean(j?.enabled))
      setAvailable(Boolean(j?.available))
      if (j?.command) setCmd(String(j.command))
      setCandidates(Array.isArray(j?.candidates) ? (j.candidates as string[]) : [])
      setLog('Module status refreshed.')
    } catch (e) {
      setLog(e instanceof Error ? e.message : 'status check failed')
    }
  }

  const run = async () => {
    setBusy(true)
    setLog(null)
    setStdout('')
    setStderr('')
    try {
      const res = await fetch(`${apiBase()}/api/yapmetasploit/run`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ args, timeout_sec: timeoutSec }),
      })
      const j = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(typeof j?.detail === 'string' ? j.detail : JSON.stringify(j))
      setStdout(String(j?.stdout_tail || ''))
      setStderr(String(j?.stderr_tail || ''))
      setLog(`Run complete (${j?.returncode ?? 'n/a'}).`)
      const ti = args.findIndex((a) => a === '--target' || a === '-t')
      if (ti >= 0 && args[ti + 1]) await push('target', args[ti + 1], 'yapmetasploit-ui')
    } catch (e) {
      setLog(e instanceof Error ? e.message : 'run failed')
    } finally {
      setBusy(false)
    }
  }

  const refreshGuiStatus = async () => {
    try {
      const res = await fetch(`${apiBase()}/api/yapmetasploit/gui/status`)
      const j = await res.json()
      setGuiRunning(Boolean(j?.running))
      setGuiEntry(String(j?.entry || ''))
    } catch {
      setGuiRunning(false)
    }
  }

  const startGui = async () => {
    setLog(null)
    try {
      const res = await fetch(`${apiBase()}/api/yapmetasploit/gui/start`, { method: 'POST' })
      const j = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(typeof j?.detail === 'string' ? j.detail : JSON.stringify(j))
      setGuiRunning(true)
      setGuiEntry(String(j?.entry || guiEntry))
      setGuiLogPath(String(j?.log_path || ''))
      setLog('YaP-Metasploit-GUI started.')
    } catch (e) {
      setLog(e instanceof Error ? e.message : 'start gui failed')
    }
  }

  const stopGui = async () => {
    setLog(null)
    try {
      const res = await fetch(`${apiBase()}/api/yapmetasploit/gui/stop`, { method: 'POST' })
      const j = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(typeof j?.detail === 'string' ? j.detail : JSON.stringify(j))
      setGuiRunning(false)
      setLog('YaP-Metasploit-GUI stop requested.')
    } catch (e) {
      setLog(e instanceof Error ? e.message : 'stop gui failed')
    }
  }

  useEffect(() => {
    void checkStatus()
    void refreshGuiStatus()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return (
    <section className="rounded-lg border border-fuchsia-500/20 bg-[#0f0f0f] p-2 h-full min-h-0 flex flex-col gap-1.5 overflow-hidden">
      <h3 className="text-fuchsia-300 text-[10px] font-bold uppercase tracking-widest">YaPMetasploit Module</h3>
      <div className="flex items-center gap-2 text-[9px]">
        <button type="button" onClick={() => void checkStatus()} className="px-2 py-0.5 rounded border border-zinc-700 text-zinc-300">
          Status
        </button>
        <span className={enabled === null ? 'text-zinc-600' : enabled ? 'text-emerald-400' : 'text-amber-300'}>
          {enabled === null ? 'unknown' : enabled ? 'enabled' : 'disabled'}
        </span>
        <span className={available === null ? 'text-zinc-600' : available ? 'text-emerald-400' : 'text-rose-400'}>
          {available === null ? 'unknown' : available ? 'available' : 'missing'}
        </span>
        <span className="text-zinc-600 truncate">cmd: {cmd}</span>
      </div>
      <div className="flex items-center gap-2 text-[9px]">
        <button type="button" onClick={() => void startGui()} className="px-2 py-0.5 rounded border border-fuchsia-700/60 text-fuchsia-200">
          Start Desktop GUI
        </button>
        <button type="button" onClick={() => void stopGui()} className="px-2 py-0.5 rounded border border-zinc-700 text-zinc-300">
          Stop GUI
        </button>
        <button type="button" onClick={() => void refreshGuiStatus()} className="px-2 py-0.5 rounded border border-zinc-700 text-zinc-300">
          GUI Status
        </button>
        <span className={guiRunning === null ? 'text-zinc-600' : guiRunning ? 'text-emerald-400' : 'text-zinc-500'}>
          {guiRunning === null ? 'gui ?' : guiRunning ? 'gui running' : 'gui stopped'}
        </span>
      </div>
      {guiEntry ? <p className="text-[9px] text-zinc-600 truncate">entry: {guiEntry}</p> : null}
      {guiLogPath ? <p className="text-[9px] text-zinc-600 truncate">log: {guiLogPath}</p> : null}
      {candidates.length > 0 ? (
        <p className="text-[9px] text-zinc-600 truncate">search: {candidates.join(' | ')}</p>
      ) : null}
      <div className="flex flex-wrap gap-1 text-[9px]">
        {PRESETS.map((p) => (
          <button
            key={p.label}
            type="button"
            onClick={() => setArgsText(p.args)}
            className="px-2 py-0.5 rounded border border-zinc-700 text-zinc-300"
          >
            {p.label}
          </button>
        ))}
        {prefillTarget ? (
          <button
            type="button"
            onClick={() => setArgsText(`scan --target ${prefillTarget}`)}
            className="px-2 py-0.5 rounded border border-cyan-700/60 text-cyan-200"
          >
            Use Target {prefillTarget}
          </button>
        ) : null}
      </div>
      <input
        value={argsText}
        onChange={(e) => setArgsText(e.target.value)}
        placeholder="args, e.g. scan --target 10.0.0.5 --quick"
        className="bg-black/50 border border-zinc-800 rounded px-2 py-1 text-[9px]"
      />
      <div className="flex items-center gap-2 text-[9px]">
        <label className="text-zinc-500">
          timeout
          <input
            type="number"
            min={5}
            max={300}
            value={timeoutSec}
            onChange={(e) => setTimeoutSec(Number(e.target.value))}
            className="ml-1 w-16 bg-black/50 border border-zinc-800 rounded px-1 py-0.5 text-[9px]"
          />
          s
        </label>
        <button
          type="button"
          disabled={busy}
          onClick={() => void run()}
          className="px-2 py-1 rounded border border-fuchsia-700/60 text-fuchsia-200 text-[9px] uppercase disabled:opacity-40"
        >
          {busy ? '…' : 'Run'}
        </button>
      </div>
      <div className="grid grid-cols-2 gap-1.5 min-h-0 flex-1 overflow-hidden">
        <div className="rounded border border-zinc-800 bg-black/40 p-1 min-h-0 overflow-y-auto">
          <p className="text-[9px] text-zinc-600 mb-1">stdout</p>
          <pre className="text-[9px] text-zinc-400 whitespace-pre-wrap break-all">{stdout || 'No output yet.'}</pre>
        </div>
        <div className="rounded border border-zinc-800 bg-black/40 p-1 min-h-0 overflow-y-auto">
          <p className="text-[9px] text-zinc-600 mb-1">stderr</p>
          <pre className="text-[9px] text-rose-300/80 whitespace-pre-wrap break-all">{stderr || 'No errors.'}</pre>
        </div>
      </div>
      {log ? <p className="text-[9px] text-zinc-500">{log}</p> : null}
    </section>
  )
}
