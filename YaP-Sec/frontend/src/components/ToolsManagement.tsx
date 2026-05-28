import { useState } from 'react'
import { useToolsStatus } from '../hooks/useToolsStatus'
import type { ToolRow, ToolUiState } from '../types/tools'

function iconRing(ui: ToolUiState): string {
  switch (ui) {
    case 'green':
      return 'text-emerald-400 ring-emerald-500/50 shadow-[0_0_12px_rgba(52,211,153,0.25)]'
    case 'blue':
      return 'text-sky-400 ring-sky-500/50 animate-pulse shadow-[0_0_14px_rgba(56,189,248,0.35)]'
    case 'red':
      return 'text-rose-400 ring-rose-500/45'
    default:
      return 'text-zinc-600 ring-zinc-700'
  }
}

function ToolDot({ ui }: { ui: ToolUiState }) {
  return (
    <span
      className={`inline-flex h-2.5 w-2.5 shrink-0 rounded-full ring-2 ${iconRing(ui)} bg-current opacity-90`}
      title={ui}
    />
  )
}

export function ToolsManagement() {
  const { data, loading, error, installTool, installStack } = useToolsStatus(2000)
  const [busy, setBusy] = useState<string | null>(null)
  const [msg, setMsg] = useState<string | null>(null)

  const onInstall = async (row: ToolRow) => {
    setBusy(row.id)
    setMsg(null)
    try {
      const r = await installTool(row.id)
      setMsg(r?.ok ? `${row.label}: installed` : `${row.label}: ${r?.stderr || r?.error || 'failed'}`)
    } catch (e) {
      setMsg(e instanceof Error ? e.message : 'install failed')
    } finally {
      setBusy(null)
    }
  }

  const onInstallAll = async () => {
    setBusy('__all__')
    setMsg(null)
    try {
      const r = await installStack()
      setMsg(
        `Stack install: ${String(r?.ok_count ?? 0)}/${String(r?.total ?? 0)} success · failed ${String(
          r?.failed_count ?? 0,
        )}`,
      )
    } catch (e) {
      setMsg(e instanceof Error ? e.message : 'stack install failed')
    } finally {
      setBusy(null)
    }
  }

  return (
    <section className="rounded-lg border border-cyan-500/20 bg-[#0f0f0f] flex flex-col min-h-0 max-h-[42%] shrink-0 overflow-hidden">
      <div className="shrink-0 px-3 py-2 border-b border-zinc-800/80 flex items-center justify-between gap-2">
        <div>
          <h2 className="text-cyan-400/95 text-[10px] font-bold uppercase tracking-[0.2em]">
            Tools Management
          </h2>
          <p className="text-zinc-600 text-[9px] font-mono mt-0.5">System health · PATH</p>
        </div>
        <div className="flex items-center gap-2">
          {loading ? <span className="text-[9px] text-zinc-500 font-mono">scan…</span> : null}
          <button
            type="button"
            disabled={Boolean(busy) || !data?.install_enabled}
            onClick={() => void onInstallAll()}
            className="px-2 py-1 rounded border border-cyan-700/60 text-cyan-200 text-[9px] font-bold uppercase disabled:opacity-40"
          >
            {busy === '__all__' ? '…' : 'Install All'}
          </button>
        </div>
      </div>

      {error ? <p className="text-rose-400/90 text-[10px] font-mono px-3 py-1">{error}</p> : null}
      {data && !data.install_enabled ? (
        <p className="text-amber-200/80 text-[9px] font-mono px-3 py-1 border-b border-zinc-800/60">
          {data.message}
        </p>
      ) : null}
      {msg ? <p className="text-zinc-400 text-[9px] font-mono px-3 py-1 truncate">{msg}</p> : null}

      <ul className="overflow-y-auto flex-1 min-h-0 divide-y divide-zinc-800/80 text-[10px] font-mono">
        {(data?.tools ?? []).map((t) => (
          <li key={t.id} className="flex items-center gap-2 px-3 py-2 hover:bg-zinc-900/40">
            <ToolDot ui={t.ui} />
            <div className="flex-1 min-w-0">
              <div className="flex items-baseline justify-between gap-2">
                <span className="text-zinc-200 truncate">{t.label}</span>
                <span className="text-zinc-600 shrink-0">{t.status}</span>
              </div>
              <p className="text-zinc-600 truncate">
                [{t.category ?? 'uncat'}] {t.path ?? t.binary}
              </p>
            </div>
            <button
              type="button"
              disabled={Boolean(busy) || t.ui === 'green' || t.ui === 'blue' || !data?.install_enabled}
              onClick={() => void onInstall(t)}
              className="shrink-0 px-2 py-1 rounded border border-cyan-800/60 text-cyan-300/90 hover:bg-cyan-950/50 disabled:opacity-40 disabled:cursor-not-allowed text-[9px] font-bold uppercase"
            >
              {busy === t.id ? '…' : 'Install'}
            </button>
          </li>
        ))}
      </ul>
    </section>
  )
}
