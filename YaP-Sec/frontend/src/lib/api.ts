/** API origin: empty uses same-origin (Vite dev proxy → FastAPI). */
export function apiBase(): string {
  return (import.meta.env.VITE_API_URL as string | undefined) ?? ''
}
