/**
 * Generación de "slug": nombre seguro para carpetas del vault.
 *
 * Es un detalle interno: el docente NUNCA ve un slug. Se deriva del nombre
 * que escribe (ej. "Divide y vencerás" -> "divide-y-venceras").
 */

// Rango unicode de marcas diacríticas (acentos combinables) U+0300–U+036F.
const MARCAS_DIACRITICAS = /[̀-ͯ]/g

/** Convierte un texto en un slug en minúsculas, sin acentos ni símbolos. */
export function slugify(texto: string): string {
  return texto
    .normalize('NFD') // separa cada letra de su acento
    .replace(MARCAS_DIACRITICAS, '') // elimina los acentos
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-') // todo lo no alfanumérico -> guion
    .replace(/^-+|-+$/g, '') // sin guiones al inicio/fin
}

/**
 * Devuelve un slug único frente a un conjunto de slugs ya existentes,
 * añadiendo un sufijo numérico si hace falta ("divide-y-venceras-2").
 *
 * Si el texto queda vacío tras normalizar, se usa `respaldo` como base.
 */
export function slugUnico(
  texto: string,
  existentes: ReadonlySet<string>,
  respaldo = 'elemento'
): string {
  const base = slugify(texto) || respaldo
  if (!existentes.has(base)) return base

  let n = 2
  while (existentes.has(`${base}-${n}`)) {
    n += 1
  }
  return `${base}-${n}`
}
