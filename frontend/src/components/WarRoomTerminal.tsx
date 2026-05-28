import { useEffect, useMemo, useRef, useState } from 'react'
import type { FeedMessage } from '../types/feed'

function lineClass(m: FeedMessage): string {
  if (m.severity === 'critical') return 'text-rose-400'
  if (m.severity === 'warn') return 'text-amber-300/90'
  if (m.module === 'network') return 'text-cyan-300/90'
  if (m.module === 'web') return 'text-amber-200/80'
  return 'text-fuchsia-300/85'
}

function prefix(m: FeedMessage): string {
  const mod = m.module.toUpperCase().slice(0, 3)
  const ts = m.timestamp ? new Date(m.timestamp).toLocaleTimeString() : '--:--:--'
  return `[${ts}] ${mod}`
}

interface WarRoomTerminalProps {
  lines: FeedMessage[]
  connected: boolean
  wsError: string | null
}

export function WarRoomTerminal({ lines, connected, wsError }: WarRoomTerminalProps) {
  const bottom = useRef<HTMLDivElement>(null)
  const [filter, setFilter] = useState<'all' | 'healer' | 'critical'>('all')
  const shown = useMemo(() => {
    const base =
      filter === 'healer'
        ? lines.filter((m) => m.type === 'healer')
        : filter === 'critical'
          ? lines.filter((m) => m.severity === 'critical')
          : lines
    return base.slice(-220)
  }, [filter, lines])
  const healerCount = useMemo(() => lines.filter((m) => m.type === 'healer').length, [lines])
  const criticalCount = useMemo(() => lines.filter((m) => m.severity === 'critical').length, [lines])

  useEffect(() => {
    bottom.current?.scrollIntoView({ behavior: 'smooth' })
  }, [shown.length])

  return (
    <section className="rounded-lg border border-amber-500/25 bg-black flex flex-col min-h-0 flex-1 h-full overflow-hidden">
      <div className="shrink-0 flex items-center justify-between px-3 py-2 border-b border-zinc-800 bg-zinc-950/80 gap-2">
        <h2 className="text-amber-400 text-xs font-bold uppercase tracking-widest">Active Scans &amp; Terminal</h2>
        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={() => setFilter('all')}
            className={`text-[9px] font-mono px-2 py-0.5 rounded border ${
              filter === 'all' ? 'border-cyan-600/80 text-cyan-200' : 'border-zinc-700 text-zinc-400'
            }`}
          >
            All
          </button>
          <button
            type="button"
            onClick={() => setFilter('healer')}
            className={`text-[9px] font-mono px-2 py-0.5 rounded border ${
              filter === 'healer' ? 'border-emerald-600/80 text-emerald-300' : 'border-zinc-700 text-zinc-400'
            }`}
            title="Show remediation and hardening events only"
          >
            Healer ({healerCount})
          </button>
          <button
            type="button"
            onClick={() => setFilter('critical')}
            className={`text-[9px] font-mono px-2 py-0.5 rounded border ${
              filter === 'critical' ? 'border-rose-600/80 text-rose-300' : 'border-zinc-700 text-zinc-400'
            }`}
            title="Show critical severity events only"
          >
            Critical ({criticalCount})
          </button>
          <span
            className={`text-[10px] font-mono px-2 py-0.5 rounded ${
              connected ? 'bg-emerald-950 text-emerald-400' : 'bg-rose-950 text-rose-300'
            }`}
          >
            {connected ? 'WS LIVE' : 'WS DOWN'}
          </span>
        </div>
      </div>
      {wsError ? (
        <p className="text-rose-400 text-xs px-3 py-1 font-mono">{wsError}</p>
      ) : null}
      <div className="terminal-scroll flex-1 min-h-0 overflow-y-auto overflow-x-auto p-2 font-mono text-[10px] leading-relaxed selection:bg-cyan-900/50">
        {shown.length === 0 ? (
          <p className="text-zinc-600">Waiting for stream…</p>
        ) : (
          shown.map((m, i) => (
            <div key={`${m.timestamp}-${i}`} className="whitespace-pre-wrap break-all mb-0.5">
              <span className="text-zinc-600">{prefix(m)}</span>{' '}
              <span className={lineClass(m)}>{m.message}</span>
            </div>
          ))
        )}
        <div ref={bottom} />
      </div>
    </section>
  )
}
