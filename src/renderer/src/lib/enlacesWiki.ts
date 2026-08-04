/**
 * Enlaces entre notas al estilo de Obsidian: `[[Nombre del concepto]]`.
 *
 * Decisión de modelado: un enlace apunta a un **concepto**, no a una "nota
 * suelta". En PedagoGraph las notas ya cuelgan de un concepto y los conceptos
 * ya son el grafo, así que enlazar a conceptos reutiliza el mapa, el material,
 * "Se usa en" y el repaso, en vez de crear un segundo sistema en paralelo.
 *
 * El enlace se guarda como texto plano dentro de la nota (`[[Interfaz]]`), no
 * como un id: así el YAML del vault se sigue leyendo a simple vista, sobrevive
 * a un respaldo/restauración y es lo mismo que escribiría Obsidian.
 */

/** Resuelve un nombre escrito por el docente al id del concepto, si existe. */
export type ResolverConcepto = (nombre: string) => { id: string; nombre: string } | null

/**
 * Normaliza para comparar: sin mayúsculas, sin tildes y sin espacios de más.
 * Así `[[interfaz]]`, `[[Interfaz]]` y `[[  Interfáz ]]` encuentran lo mismo —
 * el docente no debería tener que acordarse de cómo lo escribió.
 */
export function normalizarNombre(texto: string): string {
  return texto
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, ' ')
}

/** Patrón de un enlace. Se excluye `]` dentro para no tragarse texto de más. */
const PATRON_ENLACE = /\[\[([^\]\n]+)\]\]/g

/** Nombres enlazados en un texto, en orden y sin repetir. */
export function extraerEnlaces(texto: string): string[] {
  const vistos = new Set<string>()
  const nombres: string[] = []
  for (const coincidencia of texto.matchAll(PATRON_ENLACE)) {
    const nombre = coincidencia[1].trim()
    const clave = normalizarNombre(nombre)
    if (nombre && !vistos.has(clave)) {
      vistos.add(clave)
      nombres.push(nombre)
    }
  }
  return nombres
}

/** ¿El texto menciona a este concepto? (para los "Se menciona en"). */
export function mencionaA(texto: string, nombreConcepto: string): boolean {
  const buscado = normalizarNombre(nombreConcepto)
  return extraerEnlaces(texto).some((n) => normalizarNombre(n) === buscado)
}

function escaparHtml(texto: string): string {
  return texto
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

/**
 * Sustituye los `[[...]]` por un enlace pulsable. Los que no corresponden a
 * ningún concepto se marcan aparte (en vez de desaparecer): un enlace roto
 * debe verse, o el docente no se entera de que se equivocó al escribirlo.
 *
 * Se deja como `<a>` con datos en atributos y sin `href`, para que quien lo
 * pinta decida qué hacer al pulsar (aquí: abrir el panel de vistazo).
 */
export function sustituirEnlaces(texto: string, resolver: ResolverConcepto): string {
  return texto.replace(PATRON_ENLACE, (_todo, interior: string) => {
    const nombre = interior.trim()
    const concepto = resolver(nombre)
    const etiqueta = escaparHtml(nombre)
    if (!concepto) {
      return `<span class="enlace-concepto enlace-roto" title="No existe ningún concepto con este nombre">${etiqueta}</span>`
    }
    return `<a class="enlace-concepto" data-concepto-id="${escaparHtml(concepto.id)}" title="Ver «${escaparHtml(concepto.nombre)}»">${etiqueta}</a>`
  })
}

/**
 * ¿Está el cursor escribiendo un enlace sin cerrar? Devuelve lo tecleado tras
 * el `[[` para poder autocompletar mientras se escribe.
 */
export function enlaceEnCurso(texto: string, posicionCursor: number): { desde: number; consulta: string } | null {
  const antes = texto.slice(0, posicionCursor)
  const apertura = antes.lastIndexOf('[[')
  if (apertura === -1) return null

  const consulta = antes.slice(apertura + 2)
  // Si ya se cerró, o hay un salto de línea, no es un enlace en curso.
  if (consulta.includes(']]') || consulta.includes('\n')) return null
  return { desde: apertura, consulta }
}
