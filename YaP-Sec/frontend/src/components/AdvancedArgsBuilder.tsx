import { useMemo, useState } from 'react'
import type { AdvancedField } from '../types/toolSchemas'

interface Props {
  fields: AdvancedField[]
  onApply: (args: string) => void
}

export function AdvancedArgsBuilder({ fields, onApply }: Props) {
  const [values, setValues] = useState<Record<string, string | number | boolean>>({})

  const args = useMemo(() => {
    const out: string[] = []
    for (const f of fields) {
      const val = values[f.key] ?? f.defaultValue
      if (f.type === 'boolean') {
        if (val) out.push(f.flag)
        continue
      }
      if (val === undefined || val === null || String(val).trim() === '') continue
      if (f.joinWithEquals) out.push(`${f.flag}=${String(val).trim()}`)
      else out.push(f.flag, String(val).trim())
    }
    return out.join(' ')
  }, [fields, values])

  return (
    <div className="rounded border border-zinc-800 bg-black/30 p-1.5 space-y-1">
      <p className="text-[9px] text-zinc-500 uppercase tracking-wider">Advanced Builder</p>
      <div className="grid grid-cols-2 gap-1">
        {fields.map((f) => (
          <label key={f.key} className="text-[9px] text-zinc-500">
            {f.label}
            {f.type === 'boolean' ? (
              <input
                type="checkbox"
                className="ml-1 align-middle accent-cyan-500"
                checked={Boolean(values[f.key] ?? f.defaultValue ?? false)}
                onChange={(e) => setValues((p) => ({ ...p, [f.key]: e.target.checked }))}
              />
            ) : f.type === 'select' ? (
              <select
                className="mt-0.5 w-full bg-black/50 border border-zinc-800 rounded px-1 py-0.5 text-[9px]"
                value={String(values[f.key] ?? f.defaultValue ?? '')}
                onChange={(e) => setValues((p) => ({ ...p, [f.key]: e.target.value }))}
              >
                <option value="">--</option>
                {(f.options ?? []).map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
            ) : (
              <input
                type={f.type === 'number' ? 'number' : 'text'}
                className="mt-0.5 w-full bg-black/50 border border-zinc-800 rounded px-1 py-0.5 text-[9px]"
                placeholder={f.placeholder}
                value={String(values[f.key] ?? f.defaultValue ?? '')}
                onChange={(e) => setValues((p) => ({ ...p, [f.key]: e.target.value }))}
              />
            )}
          </label>
        ))}
      </div>
      <div className="flex items-center gap-2">
        <button type="button" onClick={() => onApply(args)} className="px-2 py-0.5 rounded border border-cyan-700/60 text-cyan-200 text-[9px] uppercase">
          Apply
        </button>
        <span className="text-[9px] text-zinc-600 truncate">{args || 'no args selected'}</span>
      </div>
    </div>
  )
}
