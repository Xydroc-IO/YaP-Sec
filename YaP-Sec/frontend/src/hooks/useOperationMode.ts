import { useCallback, useState } from 'react'
import type { OperationMode } from '../types/feed'

export function useOperationMode(initial: OperationMode = 'defensive') {
  const [mode, setMode] = useState<OperationMode>(initial)
  const cycle = useCallback(() => {
    setMode((m) => (m === 'defensive' ? 'offensive' : m === 'offensive' ? 'audit' : 'defensive'))
  }, [])
  return { mode, setMode, cycle }
}
