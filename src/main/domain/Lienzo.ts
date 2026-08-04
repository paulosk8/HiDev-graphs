import { exigir } from './errores'

/**
 * Lienzo: un mapa conceptual libre donde el docente coloca tarjetas y las
 * conecta a mano. A diferencia del Mapa de conceptos —que CALCULA la
 * disposición— aquí la disposición la decide él y se guarda.
 *
 * Se persiste en el formato **.canvas de Obsidian** (JSON), para que si algún
 * día abre su carpeta con Obsidian los lienzos se vean y editen allí también.
 * De ahí las claves en inglés (`nodes`, `edges`, `fromSide`…): son las suyas,
 * no una elección nuestra.
 *
 * Las tarjetas que apuntan a algo del vault guardan SOLO la referencia. Editar
 * la nota desde el lienzo edita la nota de verdad; no hay copia que se
 * desincronice.
 */

/** Lado de la tarjeta del que sale o al que entra una conexión. */
export type LadoNodo = 'top' | 'right' | 'bottom' | 'left'

export const LADOS: readonly LadoNodo[] = ['top', 'right', 'bottom', 'left']

/**
 * Tipos de nodo. `file` y `text` son de Obsidian; los reconocemos por la ruta
 * del archivo para saber si la tarjeta es un concepto o una nota concreta.
 */
export type TipoNodo = 'file' | 'text' | 'group'

export interface NodoLienzo {
  readonly id: string
  readonly type: TipoNodo
  readonly x: number
  readonly y: number
  readonly width: number
  readonly height: number
  /** Solo en `file`: ruta relativa al vault ("conceptos/interfaz/concepto.yaml"). */
  readonly file?: string
  /**
   * Solo en `file` de tipo nota: id de la nota dentro de ese concepto. Es una
   * extensión nuestra; Obsidian ignora las claves que no conoce.
   */
  readonly notaId?: string
  /** Solo en `text`: el texto libre de la tarjeta. */
  readonly text?: string
  /** Solo en `group`: su título. */
  readonly label?: string
  /** Color de Obsidian: "1".."6" o un hexadecimal. */
  readonly color?: string
}

export interface AristaLienzo {
  readonly id: string
  readonly fromNode: string
  readonly fromSide: LadoNodo
  readonly toNode: string
  readonly toSide: LadoNodo
  readonly label?: string
  readonly color?: string
}

export interface Lienzo {
  /** Id interno (slug del nombre del archivo). No se muestra. */
  readonly id: string
  readonly nombre: string
  readonly nodes: readonly NodoLienzo[]
  readonly edges: readonly AristaLienzo[]
}

const TAM_MINIMO = 60

function esLado(v: unknown): v is LadoNodo {
  return typeof v === 'string' && (LADOS as readonly string[]).includes(v)
}

function numero(v: unknown, porDefecto = 0): number {
  return typeof v === 'number' && Number.isFinite(v) ? v : porDefecto
}

function texto(v: unknown): string {
  return typeof v === 'string' ? v : ''
}

/**
 * Interpreta un `.canvas` (JSON) que puede venir de Obsidian o de otra versión
 * de la app. Es TOLERANTE a propósito: un lienzo con una tarjeta rara debe
 * abrirse igual, sin lo que no se entienda, en vez de no abrirse.
 */
export function lienzoDesdePlano(id: string, nombre: string, datos: unknown): Lienzo {
  const raiz = (datos ?? {}) as Record<string, unknown>
  const nodosBrutos = Array.isArray(raiz.nodes) ? raiz.nodes : []
  const aristasBrutas = Array.isArray(raiz.edges) ? raiz.edges : []

  const nodes: NodoLienzo[] = []
  for (const bruto of nodosBrutos) {
    const n = (bruto ?? {}) as Record<string, unknown>
    const nid = texto(n.id)
    if (!nid) continue
    const tipo = n.type === 'group' ? 'group' : n.type === 'text' ? 'text' : 'file'
    nodes.push({
      id: nid,
      type: tipo,
      x: numero(n.x),
      y: numero(n.y),
      width: Math.max(TAM_MINIMO, numero(n.width, 260)),
      height: Math.max(TAM_MINIMO, numero(n.height, 160)),
      ...(tipo === 'file' && texto(n.file) ? { file: texto(n.file) } : {}),
      ...(texto(n.notaId) ? { notaId: texto(n.notaId) } : {}),
      ...(tipo === 'text' ? { text: texto(n.text) } : {}),
      ...(tipo === 'group' ? { label: texto(n.label) } : {}),
      ...(texto(n.color) ? { color: texto(n.color) } : {})
    })
  }

  const existentes = new Set(nodes.map((n) => n.id))
  const edges: AristaLienzo[] = []
  for (const bruto of aristasBrutas) {
    const e = (bruto ?? {}) as Record<string, unknown>
    const eid = texto(e.id)
    const desde = texto(e.fromNode)
    const hasta = texto(e.toNode)
    // Una conexión a una tarjeta que ya no está dejaría una línea al vacío.
    if (!eid || !existentes.has(desde) || !existentes.has(hasta)) continue
    edges.push({
      id: eid,
      fromNode: desde,
      toNode: hasta,
      fromSide: esLado(e.fromSide) ? e.fromSide : 'right',
      toSide: esLado(e.toSide) ? e.toSide : 'left',
      ...(texto(e.label) ? { label: texto(e.label) } : {}),
      ...(texto(e.color) ? { color: texto(e.color) } : {})
    })
  }

  return { id, nombre, nodes, edges }
}

/** Serializa al formato .canvas. `id` y `nombre` NO se escriben: son el archivo. */
export function lienzoAPlano(lienzo: Lienzo): { nodes: unknown[]; edges: unknown[] } {
  return {
    nodes: lienzo.nodes.map((n) => ({
      id: n.id,
      type: n.type,
      x: Math.round(n.x),
      y: Math.round(n.y),
      width: Math.round(n.width),
      height: Math.round(n.height),
      ...(n.file ? { file: n.file } : {}),
      ...(n.notaId ? { notaId: n.notaId } : {}),
      ...(n.text !== undefined ? { text: n.text } : {}),
      ...(n.label !== undefined ? { label: n.label } : {}),
      ...(n.color ? { color: n.color } : {})
    })),
    edges: lienzo.edges.map((e) => ({
      id: e.id,
      fromNode: e.fromNode,
      fromSide: e.fromSide,
      toNode: e.toNode,
      toSide: e.toSide,
      ...(e.label ? { label: e.label } : {}),
      ...(e.color ? { color: e.color } : {})
    }))
  }
}

export function crearLienzo(datos: { id: string; nombre: string }): Lienzo {
  const nombre = datos.nombre.trim()
  exigir(datos.id.trim().length > 0, 'El lienzo no tiene identificador.')
  exigir(
    nombre.length > 0,
    'El lienzo necesita un nombre.',
    "Escribe un nombre, por ejemplo 'Repaso del primer parcial'."
  )
  return { id: datos.id.trim(), nombre, nodes: [], edges: [] }
}

/** Ruta que guarda una tarjeta de concepto, en el formato de archivo de Obsidian. */
export function rutaDeConcepto(conceptoId: string): string {
  return `conceptos/${conceptoId}/concepto.yaml`
}

/** Id del concepto al que apunta una tarjeta, o null si no apunta a uno. */
export function conceptoDeRuta(file: string | undefined): string | null {
  if (!file) return null
  const m = /^conceptos\/([^/]+)\/concepto\.yaml$/.exec(file)
  return m ? m[1] : null
}
