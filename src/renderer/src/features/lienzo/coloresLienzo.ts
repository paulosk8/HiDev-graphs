/**
 * Colores de los grupos del lienzo.
 *
 * Obsidian numera sus colores del "1" al "6" y los guardamos igual, para que
 * un lienzo abierto allí conserve el color. Lo que NO copiamos son sus tonos:
 * se han elegido para que el título del grupo se lea sobre su fondo con al
 * menos 4,5:1 (el mínimo recomendado para texto pequeño), que es el mismo
 * criterio de los temas de accesibilidad de la app.
 *
 * `fondo` va muy tenue a propósito: el grupo se pinta DEBAJO de las tarjetas y
 * un fondo saturado dejaría ilegible lo que contiene. El color fuerte se
 * reserva para el borde y el título, que es donde se distingue el grupo.
 */
export interface ColorGrupo {
  /** Clave de Obsidian ("1".."6"). */
  clave: string
  nombre: string
  /** Relleno del grupo, muy tenue para no tapar las tarjetas. */
  fondo: string
  borde: string
  /** Texto del título: mide >= 4,5:1 sobre `fondo`. */
  texto: string
}

export const COLORES_GRUPO: readonly ColorGrupo[] = [
  { clave: '1', nombre: 'Rojo', fondo: '#fdeaea', borde: '#c0392b', texto: '#8c1f14' },
  { clave: '2', nombre: 'Naranja', fondo: '#fdf0e3', borde: '#b35309', texto: '#7c3a06' },
  { clave: '3', nombre: 'Amarillo', fondo: '#fbf4d9', borde: '#8a6d1a', texto: '#5c4810' },
  { clave: '4', nombre: 'Verde', fondo: '#e7f5ec', borde: '#1e7a45', texto: '#14562f' },
  { clave: '5', nombre: 'Azul', fondo: '#e8effb', borde: '#1d4ed8', texto: '#15379b' },
  { clave: '6', nombre: 'Morado', fondo: '#f0eafb', borde: '#6d28d9', texto: '#4c1d95' }
]

/** Color por defecto de un grupo nuevo: neutro, no compite con nada. */
export const COLOR_GRUPO_NEUTRO: ColorGrupo = {
  clave: '',
  nombre: 'Sin color',
  fondo: '#f1f5f9',
  borde: '#64748b',
  texto: '#334155'
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
