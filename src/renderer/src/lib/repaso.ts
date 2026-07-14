import type { ResumenConceptoDTO } from '@shared/dtos'

/** Estado mínimo de repaso que necesitan los cálculos de esta utilidad. */
interface ConDominio {
  dominio: number
  proximaRevision: string | null
}

/** Fecha de hoy en ISO de día (YYYY-MM-DD), comparable como texto. */
export function hoyISO(): string {
  return new Date().toISOString().slice(0, 10)
}

/** ¿Toca repasar hoy? Nunca repasado o con la fecha ya vencida. */
export function tocaHoy(c: ConDominio, hoy: string = hoyISO()): boolean {
  return c.proximaRevision === null || c.proximaRevision <= hoy
}

/**
 * Conceptos que toca repasar hoy, ordenados para estudiar: primero los nunca
 * repasados, luego por menor dominio (lo más flojo primero).
 */
export function pendientesHoy(
  lista: ResumenConceptoDTO[],
  hoy: string = hoyISO()
): ResumenConceptoDTO[] {
  return lista
    .filter((c) => tocaHoy(c, hoy))
    .sort((a, b) => {
      const nuevoA = a.proximaRevision === null ? 0 : 1
      const nuevoB = b.proximaRevision === null ? 0 : 1
      if (nuevoA !== nuevoB) return nuevoA - nuevoB
      return a.dominio - b.dominio
    })
}

// Escala de color por dominio 0..5 (rojo → verde). El gris es "sin repasar".
const ESCALA_DOMINIO = ['#ef4444', '#f97316', '#f59e0b', '#eab308', '#84cc16', '#22c55e']
const GRIS_SIN_REPASAR = '#cbd5e1'

/** Color de un concepto según su dominio (gris si nunca se ha repasado). */
export function colorDominio(c: ConDominio): string {
  if (c.proximaRevision === null) return GRIS_SIN_REPASAR
  return ESCALA_DOMINIO[Math.min(Math.max(c.dominio, 0), 5)]
}

const ETIQUETAS = ['Muy flojo', 'Flojo', 'Regular', 'Bien', 'Muy bien', 'Dominado']

/** Etiqueta legible del nivel de dominio (o "Sin repasar"). */
export function etiquetaDominio(c: ConDominio): string {
  if (c.proximaRevision === null) return 'Sin repasar'
  return ETIQUETAS[Math.min(Math.max(c.dominio, 0), 5)]
}
