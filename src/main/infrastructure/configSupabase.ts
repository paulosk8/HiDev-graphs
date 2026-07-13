/**
 * Lee la configuración de Supabase (URL del proyecto + clave anónima pública).
 *
 * Los valores se toman de variables de entorno cargadas por electron-vite desde
 * el archivo `.env` de la raíz (prefijo `MAIN_VITE_`). La clave anónima es
 * pública por diseño (la seguridad real la impone Row-Level Security en Supabase).
 */
export interface ConfigSupabase {
  url: string
  anonKey: string
}

function leerEnv(clave: string): string | undefined {
  // electron-vite reemplaza import.meta.env.*; process.env cubre otros arranques.
  const meta = (import.meta as unknown as { env?: Record<string, string | undefined> }).env
  return meta?.[clave] ?? process.env[clave]
}

/** Devuelve la config si está completa; `null` si aún no se ha configurado. */
export function obtenerConfigSupabase(): ConfigSupabase | null {
  const url = leerEnv('MAIN_VITE_SUPABASE_URL')?.trim()
  const anonKey = leerEnv('MAIN_VITE_SUPABASE_ANON_KEY')?.trim()
  if (!url || !anonKey) return null
  return { url, anonKey }
}
