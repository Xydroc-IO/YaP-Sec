interface ScanBarProps {
  onScan: (ip: string, type: string) => void
  loading: boolean
  lastError: string | null
}

export function ScanBar({ onScan, loading, lastError }: ScanBarProps) {
  return (
    <form
      className="flex flex-wrap gap-2 items-end shrink-0"
      onSubmit={(e) => {
        e.preventDefault()
        const fd = new FormData(e.currentTarget)
        const ip = String(fd.get('ip') ?? '').trim()
        const st = String(fd.get('scan') ?? 'quick')
        if (ip) onScan(ip, st)
      }}
    >
      <label className="flex flex-col gap-1 text-[10px] text-zinc-500 uppercase tracking-wider">
        Target IP
        <input
          name="ip"
          placeholder="192.168.1.10"
          className="bg-zinc-900 border border-zinc-700 rounded px-2 py-1.5 text-amber-200/90 text-xs font-mono w-40"
        />
      </label>
      <label className="flex flex-col gap-1 text-[10px] text-zinc-500 uppercase tracking-wider">
        Scan type
        <select
          name="scan"
          className="bg-zinc-900 border border-zinc-700 rounded px-2 py-1.5 text-amber-200/90 text-xs font-mono"
        >
          <option value="quick">quick</option>
          <option value="full_tcp">full_tcp</option>
          <option value="web_crawl">web_crawl</option>
          <option value="social_recon">social_recon</option>
        </select>
      </label>
      <button
        type="submit"
        disabled={loading}
        className="px-4 py-2 rounded bg-amber-500/20 text-amber-300 border border-amber-500/40 text-xs font-bold uppercase hover:bg-amber-500/30 disabled:opacity-50"
      >
        {loading ? '…' : 'Trigger'}
      </button>
      {lastError ? <span className="text-rose-400 text-[10px] font-mono self-center">{lastError}</span> : null}
    </form>
  )
}
