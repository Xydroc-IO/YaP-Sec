import { useCallback, useEffect, useState } from 'react'
import { apiBase } from '../lib/api'

interface MetasploitPanelProps {
  prefillLhost?: string
}

export function MetasploitPanel({ prefillLhost }: MetasploitPanelProps) {
  const [password, setPassword] = useState('')
  const [host, setHost] = useState('127.0.0.1')
  const [port, setPort] = useState('55553')
  const [ssl, setSsl] = useState(false)
  const [connected, setConnected] = useState(false)
  const [exploits, setExploits] = useState<string[]>([])
  const [query, setQuery] = useState('')
  const [lhost, setLhost] = useState('127.0.0.1')
  const [lport, setLport] = useState('4444')
  const [payload, setPayload] = useState('linux/x64/meterpreter/reverse_tcp')
  const [moduleType, setModuleType] = useState<'exploit' | 'auxiliary'>('auxiliary')
  const [moduleName, setModuleName] = useState('scanner/portscan/tcp')
  const [moduleOptions, setModuleOptions] = useState('RHOSTS=127.0.0.1 PORTS=1-1000')
  const [log, setLog] = useState<string | null>(null)

  useEffect(() => {
    if (prefillLhost && prefillLhost !== lhost) setLhost(prefillLhost)
  }, [prefillLhost, lhost])

  useEffect(() => {
    const tick = async () => {
      try {
        const res = await fetch(`${apiBase()}/api/msf/status`)
        if (!res.ok) return
        const j = (await res.json()) as { connected?: boolean }
        setConnected(Boolean(j.connected))
      } catch {
        /* ignore */
      }
    }
    void tick()
    const id = setInterval(tick, 8000)
    return () => clearInterval(id)
  }, [])

  useEffect(() => {
    const preload = async () => {
      try {
        const res = await fetch(`${apiBase()}/api/msf/credentials`)
        if (!res.ok) return
        const j = (await res.json()) as {
          exists?: boolean
          host?: string
          port?: number
          ssl?: boolean
        }
        if (j.host) setHost(j.host)
        if (j.port) setPort(String(j.port))
        if (typeof j.ssl === 'boolean') setSsl(j.ssl)
      } catch {
        /* ignore */
      }
    }
    void preload()
  }, [])

  const api = useCallback(async (path: string, init?: RequestInit) => {
    const res = await fetch(`${apiBase()}${path}`, {
      ...init,
      headers: { 'Content-Type': 'application/json', ...init?.headers },
    })
    const text = await res.text()
    let j: unknown = null
    try {
      j = JSON.parse(text)
    } catch {
      j = { raw: text }
    }
    if (!res.ok) throw new Error(typeof j === 'object' && j && 'detail' in j ? String((j as { detail: unknown }).detail) : text)
    return j
  }, [])

  const connect = async () => {
    setLog(null)
    try {
      await api('/api/msf/connect', {
        method: 'POST',
        body: JSON.stringify({ password, host, port: Number(port), ssl }),
      })
      setConnected(true)
      setLog('RPC session established.')
    } catch (e) {
      setConnected(false)
      setLog(e instanceof Error ? e.message : 'connect failed')
    }
  }

  const startDaemon = async () => {
    setLog(null)
    try {
      const j = (await api('/api/msf/daemon/start', {
        method: 'POST',
        body: JSON.stringify({ password, host, port: Number(port), ssl }),
      })) as { pid?: number; already_running?: boolean }
      setLog(j.already_running ? 'msfrpcd already running.' : `msfrpcd started (pid ${j.pid ?? 'unknown'})`)
    } catch (e) {
      setLog(e instanceof Error ? e.message : 'daemon start failed')
    }
  }

  const generatePassword = async () => {
    setLog(null)
    try {
      const j = (await api('/api/msf/credentials/generate', {
        method: 'POST',
        body: JSON.stringify({ host, port: Number(port), ssl }),
      })) as { password?: string; host?: string; port?: number; ssl?: boolean }
      if (j.password) setPassword(j.password)
      if (j.host) setHost(j.host)
      if (j.port) setPort(String(j.port))
      if (typeof j.ssl === 'boolean') setSsl(j.ssl)
      setLog('Generated and saved Metasploit password.')
    } catch (e) {
      setLog(e instanceof Error ? e.message : 'password generate failed')
    }
  }

  const stopDaemon = async () => {
    setLog(null)
    try {
      await api('/api/msf/daemon/stop', { method: 'POST' })
      setConnected(false)
      setLog('msfrpcd stopped.')
    } catch (e) {
      setLog(e instanceof Error ? e.message : 'daemon stop failed')
    }
  }

  const loadExploits = async (q?: string) => {
    setLog(null)
    try {
      const qs = q?.trim() ? `&q=${encodeURIComponent(q.trim())}` : ''
      const j = (await api(`/api/msf/exploits?limit=50${qs}`)) as { exploits?: string[]; count?: number }
      setExploits(j.exploits ?? [])
      setLog(`Loaded ${j.exploits?.length ?? 0} exploits (matched ${j.count ?? j.exploits?.length ?? 0}).`)
    } catch (e) {
      setLog(e instanceof Error ? e.message : 'list failed')
    }
  }

  const startHandler = async () => {
    setLog(null)
    try {
      const j = (await api('/api/msf/handler', {
        method: 'POST',
        body: JSON.stringify({
          lhost,
          lport: Number(lport),
          payload,
        }),
      })) as { result?: unknown }
      setLog(`Handler job: ${JSON.stringify(j.result ?? j)}`)
    } catch (e) {
      setLog(e instanceof Error ? e.message : 'handler failed')
    }
  }

  const runModule = async () => {
    setLog(null)
    const options: Record<string, string> = {}
    for (const token of moduleOptions.split(' ')) {
      const t = token.trim()
      if (!t || !t.includes('=')) continue
      const [k, ...rest] = t.split('=')
      options[k] = rest.join('=')
    }
    try {
      const j = (await api('/api/msf/module/run', {
        method: 'POST',
        body: JSON.stringify({ modtype: moduleType, module: moduleName, options }),
      })) as { result?: unknown }
      setLog(`Module run: ${JSON.stringify(j.result ?? j)}`)
    } catch (e) {
      setLog(e instanceof Error ? e.message : 'module run failed')
    }
  }

  return (
    <section className="rounded-lg border border-amber-500/25 bg-[#0f0f0f] p-2 flex flex-col gap-1.5 min-h-0 h-full text-[10px] font-mono overflow-y-auto">
      <h2 className="text-amber-400 text-[10px] font-bold uppercase tracking-widest shrink-0">
        Metasploit RPC
      </h2>
      <p className="text-zinc-600 text-[9px] shrink-0">Requires msfrpcd. Lab use only.</p>

      <div className="grid grid-cols-2 gap-2 shrink-0">
        <label className="col-span-2 text-zinc-500 uppercase text-[9px]">
          Password
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="mt-0.5 w-full bg-black/50 border border-zinc-800 rounded px-2 py-1 text-amber-100/90"
          />
        </label>
        <label className="text-zinc-500 uppercase text-[9px]">
          Host
          <input
            value={host}
            onChange={(e) => setHost(e.target.value)}
            className="mt-0.5 w-full bg-black/50 border border-zinc-800 rounded px-2 py-1"
          />
        </label>
        <label className="text-zinc-500 uppercase text-[9px]">
          Port
          <input
            value={port}
            onChange={(e) => setPort(e.target.value)}
            className="mt-0.5 w-full bg-black/50 border border-zinc-800 rounded px-2 py-1"
          />
        </label>
        <label className="col-span-2 flex items-center gap-2 text-zinc-500 text-[9px] cursor-pointer">
          <input type="checkbox" checked={ssl} onChange={(e) => setSsl(e.target.checked)} className="accent-amber-500" />
          SSL
        </label>
      </div>

      <div className="flex flex-wrap gap-2 shrink-0">
        <button
          type="button"
          onClick={() => void connect()}
          className="px-2 py-1 rounded bg-amber-500/15 text-amber-200 border border-amber-500/35 text-[9px] font-bold uppercase"
        >
          Connect
        </button>
        <button
          type="button"
          onClick={() => void startDaemon()}
          className="px-2 py-1 rounded border border-amber-700/60 text-amber-200 text-[9px] font-bold uppercase"
        >
          Start msfrpcd
        </button>
        <button
          type="button"
          onClick={() => void generatePassword()}
          className="px-2 py-1 rounded border border-cyan-700/60 text-cyan-200 text-[9px] font-bold uppercase"
        >
          Generate Pass
        </button>
        <button
          type="button"
          onClick={() => void stopDaemon()}
          className="px-2 py-1 rounded border border-zinc-700 text-zinc-300 text-[9px] font-bold uppercase"
        >
          Stop
        </button>
        <button
          type="button"
          onClick={() => void loadExploits()}
          disabled={!connected}
          className="px-2 py-1 rounded border border-zinc-700 text-zinc-300 text-[9px] font-bold uppercase disabled:opacity-40"
        >
          List exploits
        </button>
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="search"
          className="w-24 bg-black/50 border border-zinc-800 rounded px-1.5 py-1 text-[9px]"
        />
        <button
          type="button"
          onClick={() => void loadExploits(query)}
          disabled={!connected}
          className="px-2 py-1 rounded border border-zinc-700 text-zinc-300 text-[9px] font-bold uppercase disabled:opacity-40"
        >
          Find
        </button>
        <span className="text-[9px] text-zinc-600 self-center">{connected ? 'linked' : 'idle'}</span>
      </div>

      {exploits.length > 0 ? (
        <div className="min-h-0 max-h-16 overflow-y-auto rounded border border-zinc-800 bg-black/40 p-1 text-[9px] text-zinc-500">
          {exploits.slice(0, 40).join(' · ')}
        </div>
      ) : null}

      <div className="border-t border-zinc-800 pt-2 grid grid-cols-2 gap-2 shrink-0">
        <label className="text-zinc-500 uppercase text-[9px]">
          LHOST
          <input
            value={lhost}
            onChange={(e) => setLhost(e.target.value)}
            className="mt-0.5 w-full bg-black/50 border border-zinc-800 rounded px-2 py-1"
          />
        </label>
        <label className="text-zinc-500 uppercase text-[9px]">
          LPORT
          <input
            value={lport}
            onChange={(e) => setLport(e.target.value)}
            className="mt-0.5 w-full bg-black/50 border border-zinc-800 rounded px-2 py-1"
          />
        </label>
        <label className="col-span-2 text-zinc-500 uppercase text-[9px]">
          Payload
          <input
            value={payload}
            onChange={(e) => setPayload(e.target.value)}
            className="mt-0.5 w-full bg-black/50 border border-zinc-800 rounded px-2 py-1"
          />
        </label>
      </div>
      <button
        type="button"
        onClick={() => void startHandler()}
        disabled={!connected}
        className="px-2 py-1.5 rounded bg-rose-950/40 text-rose-200 border border-rose-500/30 text-[9px] font-bold uppercase disabled:opacity-40"
      >
        Launch reverse listener
      </button>
      <div className="border-t border-zinc-800 pt-2 grid grid-cols-[auto_1fr] gap-2 items-center">
        <select
          value={moduleType}
          onChange={(e) => setModuleType((e.target.value as 'exploit' | 'auxiliary') || 'auxiliary')}
          className="bg-black/50 border border-zinc-800 rounded px-1.5 py-1 text-[9px]"
        >
          <option value="auxiliary">auxiliary</option>
          <option value="exploit">exploit</option>
        </select>
        <input
          value={moduleName}
          onChange={(e) => setModuleName(e.target.value)}
          placeholder="module path"
          className="bg-black/50 border border-zinc-800 rounded px-2 py-1 text-[9px]"
        />
        <input
          value={moduleOptions}
          onChange={(e) => setModuleOptions(e.target.value)}
          placeholder="K=V K2=V2"
          className="col-span-2 bg-black/50 border border-zinc-800 rounded px-2 py-1 text-[9px]"
        />
        <button
          type="button"
          onClick={() => void runModule()}
          disabled={!connected}
          className="col-span-2 px-2 py-1 rounded border border-cyan-700/60 text-cyan-200 text-[9px] font-bold uppercase disabled:opacity-40"
        >
          Run Module
        </button>
      </div>

      {log ? <p className="text-zinc-400 text-[9px] break-words shrink-0">{log}</p> : null}
    </section>
  )
}
