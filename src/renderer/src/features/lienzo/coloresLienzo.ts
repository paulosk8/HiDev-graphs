/**
 * Colores de los grupos del lienzo.
 *
 * Obsidian numera sus colores del "1" al "6" y los guardamos igual, para que
 * un lienzo abierto allí conserve el color.
 *
 * Decisión clave: el relleno es **translúcido**, no un color sólido. Un relleno
 * opaco solo puede estar bien sobre UN fondo — el primer intento se calculó
 * sobre lienzo claro y en modo oscuro aparecía como una mancha casi blanca,
 * más llamativa que las propias tarjetas. Al tintar con alfa bajo, el grupo se
 * mezcla con el lienzo que haya debajo y funciona igual en claro, oscuro,
 * cálido y alto contraste, sin una paleta por tema.
 *
 * El color fuerte se reserva para el borde y el título: es donde se distingue
 * un grupo de otro sin competir con lo que contiene.
 */

export interface ColorGrupo {
  /** Clave de Obsidian ("1".."6"). */
  clave: string
  nombre: string
  /** Tinte translúcido del relleno; se mezcla con el lienzo que haya debajo. */
  fondo: string
  borde: string
  /** Título sobre lienzo claro. */
  texto: string
  /** Título sobre lienzo oscuro: el tono de arriba no se leería. */
  textoOscuro: string
}

/** Alfa del relleno. Suficiente para agrupar de un vistazo, no para gritar. */
const TINTE = '1f' // 12 %

export const COLORES_GRUPO: readonly ColorGrupo[] = [
  { clave: '1', nombre: 'Rojo', fondo: `#c0392b${TINTE}`, borde: '#c0392b', texto: '#8c1f14', textoOscuro: '#f5a99f' },
  { clave: '2', nombre: 'Naranja', fondo: `#b35309${TINTE}`, borde: '#b35309', texto: '#7c3a06', textoOscuro: '#f0b380' },
  { clave: '3', nombre: 'Amarillo', fondo: `#8a6d1a${TINTE}`, borde: '#8a6d1a', texto: '#5c4810', textoOscuro: '#e3cd84' },
  { clave: '4', nombre: 'Verde', fondo: `#1e7a45${TINTE}`, borde: '#1e7a45', texto: '#14562f', textoOscuro: '#8fd9ab' },
  { clave: '5', nombre: 'Azul', fondo: `#1d4ed8${TINTE}`, borde: '#1d4ed8', texto: '#15379b', textoOscuro: '#a8c1f7' },
  { clave: '6', nombre: 'Morado', fondo: `#6d28d9${TINTE}`, borde: '#6d28d9', texto: '#4c1d95', textoOscuro: '#c9b0f5' }
]

/** Color por defecto de un grupo nuevo: neutro, no compite con nada. */
export const COLOR_GRUPO_NEUTRO: ColorGrupo = {
  clave: '',
  nombre: 'Sin color',
  fondo: `#64748b${TINTE}`,
  borde: '#64748b',
  texto: '#334155',
  textoOscuro: '#cbd5e1'
}

export function colorDeGrupo(clave: string | undefined): ColorGrupo {
  return COLORES_GRUPO.find((c) => c.clave === clave) ?? COLOR_GRUPO_NEUTRO
}

/**
 * Colores de las conexiones. Se guardan con las mismas claves "1".."6" que los
 * grupos (es lo que hace Obsidian), pero aquí el tono tiene que verse como
 * LÍNEA fina sobre el fondo del lienzo, no como relleno: se usan los tonos de
 * borde, que ya miden por encima de 3:1 contra ese fondo.
 */
export const COLORES_ARISTA: readonly { clave: string; nombre: string; valor: string }[] = [
  { clave: '', nombre: 'Gris', valor: '#64748b' },
  ...COLORES_GRUPO.map((c) => ({ clave: c.clave, nombre: c.nombre, valor: c.borde }))
]

export function colorDeArista(clave: string | undefined): string {
  return COLORES_ARISTA.find((c) => c.clave === (clave ?? ''))?.valor ?? '#64748b'
}
