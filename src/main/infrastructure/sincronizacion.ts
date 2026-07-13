/**
 * Lógica PURA de sincronización local ↔ nube (sin red ni disco).
 *
 * Decide, comparando el estado local y el remoto de una tabla, qué agregados hay
 * que SUBIR (local → nube) y cuáles BAJAR (nube → local). Reglas:
 *  - Existe solo local  → subir.
 *  - Existe solo remoto  → bajar.
 *  - Existe en ambos:
 *      · si el contenido es idéntico → no hacer nada (evita rebotes por reloj).
 *      · si difiere → gana el más reciente (mtime local vs actualizado_en remoto).
 *
 * Nota: es "última escritura gana" entre relojes distintos (aceptable para un
 * usuario con varios equipos). No propaga borrados en esta primera versión.
 */

/** Tablas de agregados que se sincronizan (una por tipo de dato). */
export type TablaAgregado = 'conceptos' | 'asignaturas' | 'tareas'

export interface ItemLocal {
  id: string
  datos: Record<string, unknown>
  mtimeMs: number
}

export interface ItemRemoto {
  id: string
  datos: Record<string, unknown>
  actualizadoEnMs: number
}

export interface PlanSincronizacion {
  subir: ItemLocal[]
  bajar: ItemRemoto[]
}

/** Serializa de forma canónica (claves ordenadas) para comparar contenido. */
export function canonizar(valor: unknown): string {
  if (valor === null || typeof valor !== 'object') return JSON.stringify(valor) ?? 'null'
  if (Array.isArray(valor)) return `[${valor.map(canonizar).join(',')}]`
  const obj = valor as Record<string, unknown>
  const claves = Object.keys(obj).sort()
  return `{${claves.map((k) => `${JSON.stringify(k)}:${canonizar(obj[k])}`).join(',')}}`
}

export function igualesJson(a: unknown, b: unknown): boolean {
  return canonizar(a) === canonizar(b)
}

export function planificarSincronizacion(
  locales: readonly ItemLocal[],
  remotos: readonly ItemRemoto[]
): PlanSincronizacion {
  const mapaLocal = new Map(locales.map((l) => [l.id, l]))
  const mapaRemoto = new Map(remotos.map((r) => [r.id, r]))

  const subir: ItemLocal[] = []
  const bajar: ItemRemoto[] = []

  for (const local of locales) {
    const remoto = mapaRemoto.get(local.id)
    if (!remoto) {
      subir.push(local)
    } else if (!igualesJson(local.datos, remoto.datos)) {
      if (local.mtimeMs >= remoto.actualizadoEnMs) subir.push(local)
      else bajar.push(remoto)
    }
  }

  for (const remoto of remotos) {
    if (!mapaLocal.has(remoto.id)) bajar.push(remoto)
  }

  return { subir, bajar }
}
