import type { OperationMode } from '../types/feed'

interface ModeNavProps {
  mode: OperationMode
  onSetMode: (mode: OperationMode) => void
}

export function ModeNav({ mode, onSetMode }: ModeNavProps) {
  const offensive = mode === 'offensive'
  const audit = mode === 'audit'
  const defensive = mode === 'defensive'

  return (
    <header className="shrink-0 flex items-center justify-between gap-4 border-b border-zinc-800/80 bg-[#0a0a0a]/95 px-4 py-2 backdrop-blur-sm">
      <div className="flex items-center gap-3 min-w-0">
        <span className="text-cyan-400 font-bold tracking-tight text-sm sm:text-base truncate">
          YaPsec
        </span>
        <span className="text-zinc-600 hidden sm:inline">|</span>
        <span className="text-zinc-500 text-xs uppercase tracking-widest hidden md:inline truncate">
          Triptych / 32:9
        </span>
      </div>

      <nav
        className="flex items-center rounded-lg border border-zinc-800 p-0.5 bg-zinc-900/50"
        aria-label="Operation mode"
      >
        <button
          type="button"
          onClick={() => onSetMode('defensive')}
          className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-colors ${
            defensive
              ? 'bg-cyan-500/15 text-cyan-300 ring-1 ring-cyan-500/40'
              : 'text-zinc-500 hover:text-zinc-300'
          }`}
        >
          Defensive
        </button>
        <button
          type="button"
          onClick={() => onSetMode('offensive')}
          className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-colors ${
            offensive
              ? 'bg-amber-500/15 text-amber-300 ring-1 ring-amber-500/40'
              : 'text-zinc-500 hover:text-zinc-300'
          }`}
        >
          Offensive
        </button>
        <button
          type="button"
          onClick={() => onSetMode('audit')}
          className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-colors ${
            audit
              ? 'bg-rose-500/15 text-rose-300 ring-1 ring-rose-500/40'
              : 'text-zinc-500 hover:text-zinc-300'
          }`}
        >
          Audit
        </button>
      </nav>
    </header>
  )
}
