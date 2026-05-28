import { useMemo } from 'react'

/** Simple sparkline-style bars — no chart lib, keeps bundle lean */
export function NetworkPulse() {
  const bars = useMemo(() => {
    return Array.from({ length: 48 }, (_, i) => {
      const h = 20 + ((Math.sin(i * 0.35) + 1) / 2) * 55 + (Math.random() * 12)
      return Math.min(100, h)
    })
  }, [])

  return (
    <section className="rounded-lg border border-cyan-500/20 bg-[#0f0f0f] p-3 flex flex-col min-h-0">
      <h2 className="text-cyan-400/90 text-xs font-bold uppercase tracking-widest mb-2 shrink-0">
        Live Network Traffic
      </h2>
      <div className="h-32 flex items-end gap-0.5">
        {bars.map((h, i) => (
          <div
            key={i}
            className="flex-1 min-w-0 rounded-t bg-gradient-to-t from-cyan-900/40 to-cyan-400/70"
            style={{ height: `${h}%` }}
            title={`slot ${i + 1}`}
          />
        ))}
      </div>
      <p className="text-[10px] text-zinc-600 mt-2 font-mono">SYN / TLS — synthetic pulse</p>
    </section>
  )
}
