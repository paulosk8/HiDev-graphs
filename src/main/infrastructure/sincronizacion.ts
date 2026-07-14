/**
 * Lógica PURA de sincronización local ↔ nube (sin red ni disco).
 *
 * Merge de tres vías: compara el estado LOCAL, el REMOTO y la BASE (el contenido
 * de cada ítem en la última sincronización, como `{ id, hash }`) para decidir qué
 * subir, bajar o borrar EN AMBOS lados. El `hash` de la base permite distinguir
 * un ítem "sin cambios desde la última sync" de uno "editado después", que es lo
 * que hace **seguro** el borrado simétrico.
 *
 * Reglas:
 *  - En ambos: idéntico → nada (evita rebotes por reloj); si difiere, gana el más
 *    reciente (mtime local vs actualizado_en remoto).
 *  - Solo local:
 *      · no estaba en la base → nuevo → subir.
 *      · estaba y su contenido = el de la base → se borró en la nube → BORRAR local.
 *      · estaba pero fue editado localmente → la edición gana → subir (resucita).
 *  - Solo remoto:
 *      · no estaba en la base → nuevo de otro equipo → bajar.
 *      · estaba y su contenido = el de la base → se borró aquí → BORRAR de la nube.
 *      · estaba pero fue editado en la nube → la edición gana → bajar (resucita).
 *
 * Guardas anti-catástrofe: si un lado vuelve completamente vacío pero la base tenía
 * datos (glitch de red/lectura, cuenta equivocada), NO se propaga el borrado hacia
 * ese lado; se restaura desde el otro. Nunca se pierde una edición: ante borrado-vs-
 * edición, la edición gana. Compat: una base antigua (solo ids, sin hash) preserva
 * el comportamiento previo (propaga borrados locales a la nube, no borra en local)
 * hasta que la siguiente sync la reescribe con hashes.
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

/** Un ítem en la base: su id y el hash de su contenido en la última sync. */
export interface BaseItem {
  id: string
  hash: string
}

export interface PlanSincronizacion {
  subir: ItemLocal[]
  bajar: ItemRemoto[]
  /** Ids a borrar en la nube (se borraron localmente). */
  borrarRemoto: string[]
  /** Ids a borrar en local (se borraron en la nube desde otro equipo). */
  borrarLocal: string[]
  /** Ítems que quedan sincronizados tras aplicar el plan (la nueva base, con hash). */
  baseFinal: BaseItem[]
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
  base: readonly BaseItem[] = []
): PlanSincronizacion {
  const mapaLocal = new Map(locales.map((l) => [l.id, l]))
  const mapaRemoto = new Map(remotos.map((r) => [r.id, r]))
  const hashBase = new Map(base.map((b) => [b.id, b.hash]))
  const todos = new Set<string>([...mapaLocal.keys(), ...mapaRemoto.keys(), ...hashBase.keys()])

  // Un lado que vuelve VACÍO teniendo la base datos es sospechoso (glitch de red o
  // lectura, cuenta equivocada): no se propaga el borrado hacia ese lado.
  const remotoSospechoso = remotos.length === 0 && base.length > 0
  const localSospechoso = locales.length === 0 && base.length > 0

  const subir: ItemLocal[] = []
  const bajar: ItemRemoto[] = []
  const borrarRemoto: string[] = []
  const borrarLocal: string[] = []
  const baseFinal: BaseItem[] = []
  const conserva = (id: string, hash: string): void => void baseFinal.push({ id, hash })

  for (const id of todos) {
    const local = mapaLocal.get(id)
    const remoto = mapaRemoto.get(id)
    const hashPrevio = hashBase.get(id)
    const enBase = hashPrevio !== undefined
    // Base antigua (solo ids): hash desconocido. Sin evidencia de "sin cambios",
    // no se puede borrar en local con seguridad → se preserva lo previo.
    const hashConocido = enBase && hashPrevio !== ''

    if (local && remoto) {
      const hl = canonizar(local.datos)
      const hr = canonizar(remoto.datos)
      if (hl === hr) {
        conserva(id, hl)
      } else if (local.mtimeMs >= remoto.actualizadoEnMs) {
        subir.push(local)
        conserva(id, hl)
      } else {
        bajar.push(remoto)
        conserva(id, hr)
      }
    } else if (local && !remoto) {
      const hl = canonizar(local.datos)
      if (!enBase || remotoSospechoso) {
        // Nuevo local, o nube sospechosamente vacía → subir/restaurar en la nube.
        subir.push(local)
        conserva(id, hl)
      } else if (hashConocido && hl === hashPrevio) {
        // Sincronizado, sin cambios locales, y desapareció de la nube (borrado en
        // otro equipo) → borrado simétrico seguro.
        borrarLocal.push(id)
      } else {
        // Hash desconocido (compat) o editado localmente tras la base: la edición
        // gana → subir (resucita en la nube). Nunca se borra una edición local.
        subir.push(local)
        conserva(id, hl)
      }
    } else if (!local && remoto) {
      const hr = canonizar(remoto.datos)
      if (!enBase || localSospechoso) {
        // Nuevo de otro equipo, o local sospechosamente vacío → bajar/restaurar.
        bajar.push(remoto)
        conserva(id, hr)
      } else if (!hashConocido || hr === hashPrevio) {
        // Base antigua (compat: se borró aquí) o sin cambios remotos → borrar en la nube.
        borrarRemoto.push(id)
      } else {
        // Editado en la nube tras la base: la edición gana → bajar (resucita local).
        bajar.push(remoto)
        conserva(id, hr)
      }
    }
    // !local && !remoto (estaba en base) → desapareció de ambos → fuera de la base.
  }

  return { subir, bajar, borrarRemoto, borrarLocal, baseFinal }
}
