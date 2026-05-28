import { useEffect, useRef, useState } from 'react'
import { apiBase } from '../lib/api'
import { useIntelContext } from '../hooks/useIntelContext'
import { AdvancedArgsBuilder } from './AdvancedArgsBuilder'
import { NUCLEI_FIELDS } from '../types/toolSchemas'

interface NucleiRunnerProps {
  prefillTarget?: string
}

export function NucleiRunner({ prefillTarget }: NucleiRunnerProps) {
  const [target, setTarget] = useState('https://example.com')
  const [severities, setSeverities] = useState('critical,high')
  const [extraArgs, setExtraArgs] = useState('')
  const [running, setRunning] = useState(false)
  const [lines, setLines] = useState<string[]>([])
  const abortRef = useRef<AbortController | null>(null)
  const { push } = useIntelContext()

  useEffect(() => {
    if (prefillTarget && prefillTarget !== target) setTarget(prefillTarget)
  }, [prefillTarget, target])

  const stop = () => {
    abortRef.current?.abort()
    abortRef.current = null
    setRunning(false)
  }

  const run = async () => {
    stop()
    const ac = new AbortController()
    abortRef.current = ac
    setRunning(true)
    setLines([])
    await push('url', target, 'nuclei-ui')
    const url = `${apiBase()}/api/nuclei/stream?target=${encodeURIComponent(target.trim())}&severities=${encodeURIComponent(
      severities.trim() || 'critical,high',
    )}&extra_args=${encodeURIComponent(extraArgs.trim())}`
    try {
      const res = await fetch(url, { signal: ac.signal })
      if (!res.ok || !res.body) {
        setLines([`HTTP ${res.status}`])
        return
      }
      const reader = res.body.getReader()
      const dec = new TextDecoder()
      let buf = ''
      for (;;) {
        const { value, done } = await reader.read()
        if (done) break
        buf += dec.decode(value, { stream: true })
        const parts = buf.split('\n')
        buf = parts.pop() ?? ''
        for (const line of parts) {
          if (!line.trim()) continue
          setLines((prev) => [...prev.slice(-120), line])
        }
      }
      if (buf.trim()) setLines((prev) => [...prev.slice(-120), buf.trim()])
    } catch (e) {
      if ((e as Error).name !== 'AbortError') {
        setLines((p) => [...p, e instanceof Error ? e.message : 'stream error'])
      }
    } finally {
      setRunning(false)
      abortRef.current = null
    }
  }

  return (
    <section className="rounded-lg border border-cyan-500/20 bg-[#0f0f0f] p-2 flex flex-col gap-1.5 min-h-0 h-full overflow-hidden">
      <h2 className="text-cyan-400 text-[10px] font-bold uppercase tracking-widest shrink-0">
        Nuclei (Critical / High)
      </h2>
      <input
        value={severities}
        onChange={(e) => setSeverities(e.target.value)}
        placeholder="severities (comma), e.g. critical,high,medium"
        className="bg-black/50 border border-zinc-800 rounded px-2 py-1 text-[9px]"
      />
      <input
        value={extraArgs}
        onChange={(e) => setExtraArgs(e.target.value)}
        placeholder="advanced args, e.g. -rate-limit 100 -c 20"
        className="bg-black/50 border border-zinc-800 rounded px-2 py-1 text-[9px]"
      />
      <AdvancedArgsBuilder fields={NUCLEI_FIELDS} onApply={setExtraArgs} />
      <div className="flex flex-wrap gap-2 shrink-0">
        <input
          value={target}
          onChange={(e) => setTarget(e.target.value)}
          placeholder="https://target"
          className="flex-1 min-w-[140px] bg-black/50 border border-zinc-800 rounded px-2 py-1 text-[10px] text-cyan-100/90 font-mono"
        />
        <button
          type="button"
          disabled={running}
          onClick={() => void run()}
          className="px-3 py-1 rounded bg-cyan-500/15 text-cyan-200 border border-cyan-500/35 text-[9px] font-bold uppercase disabled:opacity-50"
        >
          Run
        </button>
        <button
          type="button"
          disabled={!running}
          onClick={stop}
          className="px-2 py-1 rounded border border-zinc-700 text-zinc-400 text-[9px] uppercase disabled:opacity-40"
        >
          Stop
        </button>
      </div>
      <div className="terminal-scroll flex-1 min-h-0 overflow-y-auto rounded border border-zinc-800 bg-black/50 p-1.5 text-[9px] font-mono text-zinc-400 leading-relaxed">
        {lines.length === 0 ? (
          <span className="text-zinc-600">NDJSON stream…</span>
        ) : (
          lines.map((l, i) => <div key={i} className="break-all mb-1 border-b border-zinc-900/80 pb-1">{l}</div>)
        )}
      </div>
    </section>
  )
}
