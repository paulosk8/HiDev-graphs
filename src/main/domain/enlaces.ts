/**
 * Enlaces entre notas al estilo de Obsidian: `[[Nombre del concepto]]`.
 *
 * Lógica PURA y compartida por el proceso principal. El renderer tiene su
 * propia copia para PINTAR los enlaces (no puede importar el dominio); aquí
 * vive la que responde "¿quién menciona a este concepto?".
 *
 * El enlace se guarda como texto dentro de la nota, no como un id: así el YAML
 * del vault se sigue leyendo a simple vista, sobrevive a un respaldo y es lo
 * mismo que escribiría Obsidian.
 */

const PATRON_ENLACE = /\[\[([^\]\n]+)\]\]/g

/** Clave de comparación: sin mayúsculas, sin tildes y con espacios normalizados. */
export function claveEnlace(texto: string): string {
  return texto
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, ' ')
}

/** Nombres enlazados en un texto, sin repetir. */
export function extraerEnlaces(texto: string): string[] {
  const vistos = new Set<string>()
  for (const coincidencia of texto.matchAll(PATRON_ENLACE)) {
    const nombre = coincidencia[1].trim()
    if (nombre) vistos.add(claveEnlace(nombre))
  }
  return [...vistos]
}

/** ¿Este texto enlaza a un concepto con ese nombre? */
export function mencionaA(texto: string, nombreConcepto: string): boolean {
  const buscado = claveEnlace(nombreConcepto)
  return extraerEnlaces(texto).includes(buscado)
}
