import { useCallback, useState } from 'react'

interface Block {
  id: string
  label: string
  content: string
}

const initialBlocks: Block[] = [
  { id: 'b1', label: 'Subject', content: '' },
  { id: 'b2', label: 'Preheader', content: '' },
  { id: 'b3', label: 'Body', content: '' },
]

const PHISH_TEMPLATE = `Subject: Action required — password review (IT)

Preheader: Please confirm within 24 hours.

Body:
Hello,

Our security tools flagged unusual sign-in activity on your account. To keep access uninterrupted, please verify your credentials using the secure link below.

[ Verify account ]  ← (placeholder — use only in authorized simulations)

Regards,
IT Security Operations`

function parseTemplate(t: string): Block[] {
  const lines = t.split('\n')
  let subject = ''
  let preheader = ''
  const bodyLines: string[] = []
  let mode: 'none' | 'sub' | 'pre' | 'body' = 'none'
  for (const line of lines) {
    if (line.startsWith('Subject:')) {
      mode = 'sub'
      subject = line.replace(/^Subject:\s*/, '')
    } else if (line.startsWith('Preheader:')) {
      mode = 'pre'
      preheader = line.replace(/^Preheader:\s*/, '')
    } else if (line.startsWith('Body:')) {
      mode = 'body'
    } else if (mode === 'body') {
      bodyLines.push(line)
    } else if (mode === 'sub') subject += (subject ? '\n' : '') + line
    else if (mode === 'pre') preheader += (preheader ? '\n' : '') + line
  }
  return [
    { id: 'b1', label: 'Subject', content: subject.trim() },
    { id: 'b2', label: 'Preheader', content: preheader.trim() },
    { id: 'b3', label: 'Body', content: bodyLines.join('\n').trim() },
  ]
}

const FAKE_LOGIN_HTML = `<!DOCTYPE html><html><head><meta charset="utf-8"/><style>
body{margin:0;font-family:system-ui;background:#0f172a;color:#e2e8f0;display:flex;min-height:100vh;align-items:center;justify-content:center;}
.card{background:#1e293b;padding:2rem;border-radius:12px;box-shadow:0 0 40px rgba(56,189,248,.15);width:min(360px,90vw);border:1px solid #334155;}
h1{font-size:1.1rem;margin:0 0 1rem;color:#38bdf8;}
input{width:100%;box-sizing:border-box;padding:.6rem;margin:.4rem 0;border-radius:6px;border:1px solid #475569;background:#0f172a;color:#f8fafc;}
button{width:100%;margin-top:1rem;padding:.65rem;border:0;border-radius:6px;background:#38bdf8;color:#0f172a;font-weight:700;cursor:default;}
small{display:block;margin-top:1rem;color:#64748b;font-size:.7rem;}
</style></head><body><div class="card"><h1>Sign in (preview)</h1>
<p style="font-size:.8rem;color:#94a3b8;margin:0 0 1rem">Clone preview — not a real service.</p>
<input type="email" placeholder="email@company" disabled />
<input type="password" placeholder="••••••••" disabled />
<button type="button" disabled>Continue</button>
<small>YaPsec Social-Synth · authorized testing only</small></div></body></html>`

export function SocialSynth() {
  const [blocks, setBlocks] = useState<Block[]>(initialBlocks)
  const [dragId, setDragId] = useState<string | null>(null)
  const [cloneSite, setCloneSite] = useState(false)

  const onDragStart = (id: string) => setDragId(id)
  const onDrop = (overId: string) => {
    if (!dragId || dragId === overId) return
    setBlocks((prev) => {
      const a = prev.findIndex((b) => b.id === dragId)
      const b = prev.findIndex((x) => x.id === overId)
      if (a < 0 || b < 0) return prev
      const next = [...prev]
      const [m] = next.splice(a, 1)
      next.splice(b, 0, m)
      return next
    })
    setDragId(null)
  }

  const updateBlock = useCallback((id: string, content: string) => {
    setBlocks((prev) => prev.map((b) => (b.id === id ? { ...b, content } : b)))
  }, [])

  const generatePhish = () => {
    setBlocks(parseTemplate(PHISH_TEMPLATE))
  }

  return (
    <section className="rounded-lg border border-fuchsia-500/20 bg-[#0f0f0f] p-3 flex flex-col gap-3 min-h-0 h-full overflow-hidden">
      <div className="flex flex-wrap items-center justify-between gap-2 shrink-0">
        <h2 className="text-fuchsia-300/90 text-xs font-bold uppercase tracking-widest">
          Social-Synth
        </h2>
        <button
          type="button"
          onClick={generatePhish}
          className="text-[10px] font-bold uppercase px-2 py-1 rounded bg-fuchsia-500/15 text-fuchsia-200 border border-fuchsia-500/35 hover:bg-fuchsia-500/25"
        >
          Generate Phish
        </button>
      </div>

      <p className="text-[10px] text-zinc-600 shrink-0">
        Drag handles to reorder blocks. Use only where legally authorized.
      </p>

      <div className="flex-1 min-h-0 overflow-y-auto space-y-2 pr-1">
        {blocks.map((b) => (
          <div
            key={b.id}
            onDragOver={(e) => e.preventDefault()}
            onDrop={() => onDrop(b.id)}
            className={`rounded border border-zinc-800 bg-zinc-950/60 p-2 flex gap-2 ${
              dragId === b.id ? 'opacity-60 ring-1 ring-fuchsia-500/40' : ''
            }`}
          >
            <button
              type="button"
              draggable
              onDragStart={() => onDragStart(b.id)}
              onDragEnd={() => setDragId(null)}
              className="cursor-grab active:cursor-grabbing text-zinc-600 hover:text-fuchsia-400 text-xs px-1 font-mono"
              aria-label={`Drag ${b.label}`}
            >
              ::
            </button>
            <div className="flex-1 min-w-0">
              <label className="text-[10px] text-zinc-500 uppercase tracking-wider">{b.label}</label>
              <textarea
                value={b.content}
                onChange={(e) => updateBlock(b.id, e.target.value)}
                rows={b.label === 'Body' ? 6 : 2}
                className="mt-1 w-full resize-y bg-black/50 border border-zinc-800 rounded px-2 py-1.5 text-[11px] text-zinc-200 font-mono focus:outline-none focus:ring-1 focus:ring-fuchsia-500/40"
              />
            </div>
          </div>
        ))}
      </div>

      <div className="shrink-0 border-t border-zinc-800 pt-2 space-y-2">
        <label className="flex items-center gap-2 text-[11px] text-zinc-400 font-mono cursor-pointer">
          <input
            type="checkbox"
            checked={cloneSite}
            onChange={(e) => setCloneSite(e.target.checked)}
            className="accent-cyan-500"
          />
          Clone Website (fake login preview)
        </label>
        {cloneSite ? (
          <div className="h-48 rounded border border-cyan-500/25 overflow-hidden bg-black">
            <iframe title="clone-preview" className="w-full h-full border-0" srcDoc={FAKE_LOGIN_HTML} sandbox="" />
          </div>
        ) : null}
      </div>
    </section>
  )
}
