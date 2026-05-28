import { useState } from 'react'

interface KillSwitchProps {
  disabled?: boolean
}

export function KillSwitch({ disabled }: KillSwitchProps) {
  const [armed, setArmed] = useState(false)

  return (
    <section className="rounded-lg border border-rose-900/50 bg-gradient-to-b from-rose-950/30 to-black p-2.5 flex flex-col items-center justify-center gap-1.5 shrink-0 h-full">
      <h2 className="text-rose-500 text-[10px] font-bold uppercase tracking-[0.2em]">
        Kill Switch
      </h2>
      <label className="flex items-center gap-2 text-[10px] text-zinc-500 font-mono cursor-pointer">
        <input
          type="checkbox"
          checked={armed}
          onChange={(e) => setArmed(e.target.checked)}
          className="accent-rose-600"
        />
        ARM
      </label>
      <button
        type="button"
        disabled={disabled || !armed}
        className="w-full max-w-[220px] h-8 rounded-md border-2 border-rose-700 bg-gradient-to-b from-rose-600 to-rose-900 text-white font-bold text-[11px] uppercase tracking-widest shadow-[0_0_18px_rgba(244,63,94,0.35)] disabled:opacity-40 disabled:grayscale disabled:shadow-none hover:enabled:brightness-110 active:enabled:scale-[0.98] transition-transform"
        onClick={async () => {
          setArmed(false)
          try {
            const apiUrl = import.meta.env.VITE_API_URL || ''
            await fetch(`${apiUrl}/api/halt`, { method: 'POST' })
          } catch (e) {
            console.error('Kill switch API call failed', e)
          }
        }}
      >
        Kill
      </button>
      <p className="text-[8px] text-zinc-600 text-center font-mono px-2 leading-tight">
        Stops local UI actions; extend with POST /halt on API.
      </p>
    </section>
  )
}
