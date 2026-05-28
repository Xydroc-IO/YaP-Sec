import { ModeNav } from './components/ModeNav'
import { ToolsManagement } from './components/ToolsManagement'
import { NetworkPulse } from './components/NetworkPulse'
import { ProcessMonitor } from './components/ProcessMonitor'
import { WarRoomTerminal } from './components/WarRoomTerminal'
import { KillSwitch } from './components/KillSwitch'
import { ScanBar } from './components/ScanBar'
import { OffensiveWorkspace } from './components/OffensiveWorkspace'
import { IntelligencePanel } from './components/IntelligencePanel'
import { SocialSynth } from './components/SocialSynth'
import { WebPenInspector } from './components/WebPenInspector'
import { ComplianceDashboard } from './components/ComplianceDashboard'
import { useOperationMode } from './hooks/useOperationMode'
import { usePentestWebSocket } from './hooks/usePentestWebSocket'
import { useThreatFeed } from './hooks/useThreatFeed'
import { useScanTrigger } from './hooks/useScanTrigger'

export default function App() {
  const { mode, setMode } = useOperationMode()
  const { messages, connected, error: wsError } = usePentestWebSocket()
  const { threats, criticalCount } = useThreatFeed(messages)
  const { loading, error: scanErr, triggerScan } = useScanTrigger()

  const offensive = mode === 'offensive'
  const auditMode = mode === 'audit'

  return (
    <div className="h-dvh w-full bg-[#0a0a0a] text-zinc-300 p-1 sm:p-2 box-border overflow-hidden">
      {/* Fill viewport by default; keep triptych proportions without hard letterboxing */}
      <div className="flex flex-col w-full h-full border border-zinc-800/60 rounded-lg overflow-hidden shadow-[0_0_60px_rgba(34,211,238,0.06)] box-border bg-[#0a0a0a]">
        <ModeNav mode={mode} onSetMode={setMode} />

        <main className="flex-1 min-h-0 grid grid-cols-1 lg:grid-cols-[1fr_1.15fr_1fr] gap-1.5 p-1.5 box-border">
          {/* Left — Pulse */}
          <aside className="flex flex-col gap-2 min-h-0 min-w-0 overflow-hidden">
            <div className="shrink-0 rounded-lg border border-cyan-500/30 bg-gradient-to-r from-cyan-950/20 to-transparent px-3 py-2">
              <p className="text-cyan-400 text-[10px] font-bold uppercase tracking-[0.25em]">
                Pulse
              </p>
              <p className="text-zinc-600 text-[10px] font-mono mt-0.5">Network · Processes</p>
            </div>
            <ToolsManagement />
            <NetworkPulse />
            <ProcessMonitor />
          </aside>

          {/* Center — War Room */}
          <section className="flex flex-col gap-1.5 min-h-0 min-w-0 overflow-hidden">
            <div className="shrink-0 rounded-lg border border-amber-500/30 bg-gradient-to-r from-amber-950/15 to-transparent px-3 py-2">
              <p className="text-amber-400 text-[10px] font-bold uppercase tracking-[0.25em]">
                War Room
              </p>
              <p className="text-zinc-600 text-[10px] font-mono mt-0.5">
                {offensive ? 'Pentest orchestration' : auditMode ? 'Audit execution controls' : 'Monitoring console'}
              </p>
            </div>
            {offensive ? (
              <ScanBar onScan={(ip, t) => void triggerScan({ target_ip: ip, scan_type: t })} loading={loading} lastError={scanErr} />
            ) : (
              <p className="text-zinc-600 text-[10px] font-mono shrink-0 px-1">
                {auditMode
                  ? 'Audit mode active — use compliance controls on the right.'
                  : 'Offensive controls hidden — toggle to Offensive to trigger scans.'}
              </p>
            )}
            {offensive ? <OffensiveWorkspace onScan={(ip, t) => triggerScan({ target_ip: ip, scan_type: t })} /> : null}
            <div className="min-h-0 flex-1">
              <WarRoomTerminal lines={messages} connected={connected} wsError={wsError} />
            </div>
            <div className="shrink-0 max-h-24 overflow-hidden">
              <KillSwitch />
            </div>
          </section>

          {/* Right — Intelligence / Compliance */}
          <aside className="grid grid-rows-[auto_minmax(0,1fr)_minmax(0,1fr)_minmax(0,1.1fr)] gap-2 min-h-0 min-w-0 overflow-hidden">
            <div className="shrink-0 rounded-lg border border-fuchsia-500/25 bg-gradient-to-r from-fuchsia-950/10 to-transparent px-3 py-2">
              <p className="text-fuchsia-300 text-[10px] font-bold uppercase tracking-[0.25em]">
                {auditMode ? 'Compliance' : 'Intelligence'}
              </p>
              <p className="text-zinc-600 text-[10px] font-mono mt-0.5">
                {auditMode ? 'Hardening · Policy · Summary' : 'Logs · Web · Social'}
              </p>
            </div>
            {auditMode ? (
              <div className="row-span-3 min-h-0">
                <ComplianceDashboard />
              </div>
            ) : (
              <>
                <IntelligencePanel threats={threats} criticalCount={criticalCount} />
                <WebPenInspector />
                <SocialSynth />
              </>
            )}
          </aside>
        </main>
      </div>
    </div>
  )
}
