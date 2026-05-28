const PROCS = [
  { name: 'nmap-wrapper', cpu: 12, mem: 64 },
  { name: 'zap-headless', cpu: 34, mem: 512 },
  { name: 'gophish', cpu: 4, mem: 128 },
  { name: 'packet-cap', cpu: 8, mem: 256 },
]

export function ProcessMonitor() {
  return (
    <section className="rounded-lg border border-cyan-500/15 bg-[#0f0f0f] p-3 flex flex-col min-h-0">
      <h2 className="text-cyan-400/90 text-xs font-bold uppercase tracking-widest mb-2">
        Process Monitor
      </h2>
      <ul className="space-y-2 text-[11px] font-mono overflow-auto">
        {PROCS.map((p) => (
          <li
            key={p.name}
            className="flex justify-between gap-2 border-b border-zinc-800/80 pb-1.5 last:border-0"
          >
            <span className="text-zinc-300 truncate">{p.name}</span>
            <span className="text-cyan-600/90 shrink-0">
              CPU {p.cpu}% · {p.mem}MB
            </span>
          </li>
        ))}
      </ul>
    </section>
  )
}
