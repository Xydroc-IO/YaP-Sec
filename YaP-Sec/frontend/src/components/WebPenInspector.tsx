import { Fragment, useState } from 'react'

type Risk = 'low' | 'medium' | 'high' | 'critical'

interface Row {
  id: string
  url: string
  risk: Risk
  payload?: string
  vector?: string
}

const MOCK: Row[] = [
  {
    id: '1',
    url: 'https://target.example/login',
    risk: 'critical',
    vector: 'SQLi',
    payload: "admin' OR '1'='1' --",
  },
  {
    id: '2',
    url: 'https://target.example/search?q=',
    risk: 'high',
    vector: 'XSS',
    payload: '<script>alert(document.domain)</script>',
  },
  {
    id: '3',
    url: 'https://target.example/api/users',
    risk: 'low',
  },
]

function riskStyle(r: Risk): string {
  switch (r) {
    case 'critical':
      return 'text-rose-400 bg-rose-950/50 ring-rose-500/30'
    case 'high':
      return 'text-amber-300 bg-amber-950/40 ring-amber-500/25'
    case 'medium':
      return 'text-yellow-200 bg-yellow-950/30 ring-yellow-500/20'
    default:
      return 'text-emerald-400/90 bg-emerald-950/30 ring-emerald-500/20'
  }
}

export function WebPenInspector() {
  const [open, setOpen] = useState<string | null>(null)

  return (
    <section className="rounded-lg border border-amber-500/20 bg-[#0f0f0f] p-3 flex flex-col min-h-0 h-full overflow-hidden">
      <h2 className="text-amber-400/90 text-xs font-bold uppercase tracking-widest mb-2 shrink-0">
        Web-Pen Inspector
      </h2>
      <div className="overflow-auto min-h-0 rounded border border-zinc-800/80">
        <table className="w-full text-left text-[11px] font-mono">
          <thead className="sticky top-0 bg-zinc-900/95 text-zinc-500 uppercase text-[10px] tracking-wider">
            <tr>
              <th className="p-2 font-semibold">URL</th>
              <th className="p-2 font-semibold w-28">Risk</th>
            </tr>
          </thead>
          <tbody>
            {MOCK.map((row) => {
              const isOpen = open === row.id
              return (
                <Fragment key={row.id}>
                  <tr
                    className={`border-t border-zinc-800/80 cursor-pointer hover:bg-zinc-800/40 ${
                      isOpen ? 'bg-zinc-800/30' : ''
                    }`}
                    onClick={() => setOpen(isOpen ? null : row.id)}
                  >
                    <td className="p-2 text-cyan-200/80 break-all">{row.url}</td>
                    <td className="p-2">
                      <span
                        className={`inline-block px-2 py-0.5 rounded text-[10px] font-bold uppercase ring-1 ${riskStyle(row.risk)}`}
                      >
                        {row.risk}
                      </span>
                    </td>
                  </tr>
                  {isOpen && (row.payload || row.vector) ? (
                    <tr key={`${row.id}-detail`} className="bg-black/60 border-t border-zinc-800/60">
                      <td colSpan={2} className="p-3 text-zinc-400">
                        {row.vector ? (
                          <p className="text-amber-200/90 mb-1">
                            <span className="text-zinc-600">Vector:</span> {row.vector}
                          </p>
                        ) : null}
                        {row.payload ? (
                          <pre className="text-rose-300/90 whitespace-pre-wrap break-all text-[10px] leading-relaxed bg-zinc-950 p-2 rounded border border-zinc-800">
                            {row.payload}
                          </pre>
                        ) : (
                          <p className="text-zinc-600">No confirmed payload for this row.</p>
                        )}
                      </td>
                    </tr>
                  ) : null}
                </Fragment>
              )
            })}
          </tbody>
        </table>
      </div>
    </section>
  )
}
