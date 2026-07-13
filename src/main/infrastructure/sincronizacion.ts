/**
 * Lógica PURA de sincronización local ↔ nube (sin red ni disco).
 *
 * Merge de tres vías: compara el estado LOCAL, el REMOTO y la BASE (los ids que
 * existían en la última sincronización) para decidir qué subir, bajar o borrar.
 * Reglas:
 *  - En ambos: idéntico → nada (evita rebotes por reloj); si difiere, gana el más
 *    reciente (mtime local vs actualizado_en remoto).
 *  - Solo local → subir (nuevo, o re-subida segura). NUNCA se borra en local.
 *  - Solo remoto y estaba en la base → se borró aquí → BORRAR de la nube.
 *  - Solo remoto y no estaba en la base → es nuevo de otro equipo → bajar.
 *
 * Asimetría deliberada: el borrado local se propaga a la nube, pero la sync NUNCA
 * elimina datos locales (seguridad ante una nube vaciada o cuenta equivocada).
 * Limitación conocida: un ítem borrado en otro equipo puede reaparecer desde este.
 * Los conflictos de edición se resuelven por "última escritura gana".
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
  /** Ids a borrar en la nube (se borraron localmente). */
  borrarRemoto: string[]
  /** Ids que quedan sincronizados tras aplicar el plan (la nueva base). */
  baseFinal: string[]
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
  remotos: readonly ItemRemoto[],
  base: readonly string[] = []
): PlanSincronizacion {
  const mapaLocal = new Map(locales.map((l) => [l.id, l]))
  const mapaRemoto = new Map(remotos.map((r) => [r.id, r]))
  const enBase = new Set(base)
  const todos = new Set<string>([...mapaLocal.keys(), ...mapaRemoto.keys(), ...enBase])

  const subir: ItemLocal[] = []
  const bajar: ItemRemoto[] = []
  const borrarRemoto: string[] = []
  const baseFinal: string[] = []

  for (const id of todos) {
    const local = mapaLocal.get(id)
    const remoto = mapaRemoto.get(id)

    if (local && remoto) {
      if (!igualesJson(local.datos, remoto.datos)) {
        if (local.mtimeMs >= remoto.actualizadoEnMs) subir.push(local)
        else bajar.push(remoto)
      }
      baseFinal.push(id)
    } else if (local && !remoto) {
      // Solo local: nuevo, o re-subida segura. Nunca se borra en local.
      subir.push(local)
      baseFinal.push(id)
    } else if (!local && remoto) {
      if (enBase.has(id)) {
        // Existía en la última sync y ya no está local → se borró aquí.
        borrarRemoto.push(id)
      } else {
        // Nuevo de otro equipo.
        bajar.push(remoto)
        baseFinal.push(id)
      }
    }
    // !local && !remoto (estaba en base) → desapareció de ambos → fuera de la base.
  }

  return { subir, bajar, borrarRemoto, baseFinal }
}
