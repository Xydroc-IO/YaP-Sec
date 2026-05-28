import { useState } from 'react'
import type { ThreatFinding } from '../types/feed'

interface IntelligencePanelProps {
  threats: ThreatFinding[]
  criticalCount: number
}

export function IntelligencePanel({ threats, criticalCount }: IntelligencePanelProps) {
  const [chat, setChat] = useState<{ role: 'you' | 'ai'; text: string }[]>([
    { role: 'ai', text: 'Intelligence channel online. Summarizing feed…' },
  ])
  const [input, setInput] = useState('')

  const send = () => {
    const t = input.trim()
    if (!t) return
    setChat((c) => [...c, { role: 'you', text: t }])
    setInput('')
    setTimeout(() => {
      setChat((c) => [
        ...c,
        {
          role: 'ai',
          text: `Noted: “${t.slice(0, 80)}${t.length > 80 ? '…' : ''}”. Correlating with last ${threats.length} signals.`,
        },
      ])
    }, 400)
  }

  return (
    <div className="flex flex-col gap-3 min-h-0 overflow-hidden h-full">
      <section className="rounded-lg border border-rose-500/20 bg-[#0f0f0f] p-3 flex flex-col min-h-0 flex-1 overflow-hidden">
        <div className="flex items-center justify-between shrink-0 mb-2">
          <h2 className="text-rose-400/90 text-xs font-bold uppercase tracking-widest">
            Vulnerability Logs
          </h2>
          {criticalCount > 0 ? (
            <span className="text-[10px] font-mono text-rose-400 bg-rose-950/50 px-2 py-0.5 rounded">
              CRIT {criticalCount}
            </span>
          ) : null}
        </div>
        <ul className="overflow-y-auto space-y-2 text-[11px] font-mono min-h-0 pr-1">
          {threats.length === 0 ? (
            <li className="text-zinc-600">No threat-classified events yet.</li>
          ) : (
            threats.map((t) => (
              <li
                key={t.id}
                className={`border border-zinc-800/80 rounded p-2 ${
                  t.severity === 'critical' ? 'border-rose-500/40 bg-rose-950/20' : 'bg-black/30'
                }`}
              >
                <div className="flex justify-between gap-2 text-[10px] text-zinc-500">
                  <span className="uppercase text-cyan-600/80">{t.module}</span>
                  <span>{new Date(t.timestamp).toLocaleTimeString()}</span>
                </div>
                <p className="text-zinc-200 mt-1">{t.detail}</p>
              </li>
            ))
          )}
        </ul>
      </section>

      <section className="rounded-lg border border-zinc-700 bg-[#0f0f0f] p-3 flex flex-col min-h-[140px] shrink-0">
        <h2 className="text-zinc-400 text-xs font-bold uppercase tracking-widest mb-2">AI Chat</h2>
        <div className="flex-1 overflow-y-auto space-y-1.5 max-h-28 text-[11px] font-mono mb-2">
          {chat.map((m, i) => (
            <div
              key={i}
              className={m.role === 'you' ? 'text-amber-200/90' : 'text-cyan-200/85'}
            >
              <span className="text-zinc-600">{m.role === 'you' ? '> ' : '§ '}</span>
              {m.text}
            </div>
          ))}
        </div>
        <div className="flex gap-2">
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && send()}
            placeholder="Ask intelligence…"
            className="flex-1 bg-black/50 border border-zinc-800 rounded px-2 py-1.5 text-xs text-zinc-200 font-mono"
          />
          <button
            type="button"
            onClick={send}
            className="px-3 py-1.5 text-xs font-bold uppercase rounded bg-zinc-800 text-zinc-200 hover:bg-zinc-700"
          >
            Send
          </button>
        </div>
      </section>
    </div>
  )
}
