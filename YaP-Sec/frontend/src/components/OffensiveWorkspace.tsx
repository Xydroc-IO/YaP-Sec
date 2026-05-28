import { useEffect, useMemo, useState } from 'react'
import { MetasploitPanel } from './MetasploitPanel'
import { AircrackPanel } from './AircrackPanel'
import { NmapPanel } from './NmapPanel'
import { NucleiRunner } from './NucleiRunner'
import { OpsOrchestratorPanel } from './OpsOrchestratorPanel'
import { SqlmapPanel } from './SqlmapPanel'
import { YaPMetasploitPanel } from './YaPMetasploitPanel'
import { useIntelContext } from '../hooks/useIntelContext'

type TabId = 'orchestrator' | 'metasploit' | 'yapmetasploit' | 'nmap' | 'nuclei' | 'sqlmap' | 'aircrack'

interface Props {
  onScan: (ip: string, scanType: string) => Promise<void> | void
}

export function OffensiveWorkspace({ onScan }: Props) {
  const [tab, setTab] = useState<TabId>('orchestrator')
  const { context } = useIntelContext()
  const [targetFill, setTargetFill] = useState('')
  const [urlFill, setUrlFill] = useState('')
  const [ifaceFill, setIfaceFill] = useState('')

  const tabs: { id: TabId; label: string }[] = [
    { id: 'orchestrator', label: 'Ops' },
    { id: 'metasploit', label: 'MSF' },
    { id: 'yapmetasploit', label: 'YaPMSF' },
    { id: 'nmap', label: 'Nmap' },
    { id: 'aircrack', label: 'Aircrack' },
    { id: 'nuclei', label: 'Nuclei' },
    { id: 'sqlmap', label: 'SQLMap' },
  ]

  useEffect(() => {
    if (!targetFill && context.targets[0]) setTargetFill(context.targets[0])
    if (!urlFill && (context.urls[0] || context.suggested_urls?.[0])) {
      setUrlFill(context.urls[0] || context.suggested_urls?.[0] || '')
    }
    if (!ifaceFill && context.ifaces[0]) setIfaceFill(context.ifaces[0])
  }, [context, targetFill, urlFill, ifaceFill])

  const activeHint = useMemo(() => {
    if (tab === 'nmap' || tab === 'metasploit' || tab === 'yapmetasploit' || tab === 'orchestrator') return `target: ${targetFill || '—'}`
    if (tab === 'sqlmap' || tab === 'nuclei') return `url: ${urlFill || '—'}`
    if (tab === 'aircrack') return `iface: ${ifaceFill || '—'}`
    return '—'
  }, [tab, targetFill, urlFill, ifaceFill])

  return (
    <section className="shrink-0 min-h-0 max-h-[36%] rounded-lg border border-zinc-800/80 bg-black/20 overflow-hidden flex flex-col">
      <div className="shrink-0 border-b border-zinc-800/80 px-2 py-1 flex flex-wrap items-center gap-1.5 text-[9px]">
        <span className="text-zinc-500 uppercase tracking-wider">Intel Quick Fill</span>
        <button
          type="button"
          onClick={() => context.targets[0] && setTargetFill(context.targets[0])}
          disabled={!context.targets.length}
          className="px-2 py-0.5 rounded border border-cyan-700/60 text-cyan-200 disabled:opacity-40"
        >
          Target: {context.targets[0] ?? '—'}
        </button>
        <button
          type="button"
          onClick={() => {
            const u = context.urls[0] || context.suggested_urls?.[0]
            if (u) setUrlFill(u)
          }}
          disabled={!context.urls.length && !context.suggested_urls?.length}
          className="px-2 py-0.5 rounded border border-amber-700/60 text-amber-200 disabled:opacity-40"
        >
          URL: {(context.urls[0] || context.suggested_urls?.[0] || '—').slice(0, 32)}
        </button>
        <button
          type="button"
          onClick={() => context.ifaces[0] && setIfaceFill(context.ifaces[0])}
          disabled={!context.ifaces.length}
          className="px-2 py-0.5 rounded border border-fuchsia-700/60 text-fuchsia-200 disabled:opacity-40"
        >
          IFACE: {context.ifaces[0] ?? '—'}
        </button>
        <span className="text-zinc-600 ml-auto truncate">{activeHint}</span>
      </div>
      <div className="shrink-0 flex items-center gap-1 p-1 border-b border-zinc-800/80 overflow-x-auto">
        {tabs.map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`px-2 py-1 text-[9px] uppercase rounded border ${
              tab === t.id
                ? 'border-amber-500/50 text-amber-200 bg-amber-950/30'
                : 'border-zinc-700 text-zinc-400'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>
      <div className="min-h-0 flex-1 p-1.5 overflow-hidden">
        {tab === 'orchestrator' ? <OpsOrchestratorPanel onScan={onScan} prefillTarget={targetFill} /> : null}
        {tab === 'metasploit' ? <MetasploitPanel prefillLhost={targetFill} /> : null}
        {tab === 'yapmetasploit' ? <YaPMetasploitPanel prefillTarget={targetFill} /> : null}
        {tab === 'nmap' ? <NmapPanel prefillTarget={targetFill} /> : null}
        {tab === 'aircrack' ? <AircrackPanel prefillIface={ifaceFill} /> : null}
        {tab === 'nuclei' ? <NucleiRunner prefillTarget={urlFill} /> : null}
        {tab === 'sqlmap' ? <SqlmapPanel prefillUrl={urlFill} /> : null}
      </div>
    </section>
  )
}
