import { exigir } from './errores'
import type { FormatoRecurso } from './tipos'

/**
 * Recurso: una pieza de material didáctico (pdf, pptx, ...).
 *
 * Pertenece SIEMPRE a un concepto, nunca a una asignatura. El archivo físico
 * vive dentro de la carpeta del concepto en el vault; aquí solo guardamos su
 * registro. La copia del archivo la realiza la infraestructura, no el dominio.
 */
export interface Recurso {
  /** Identificador estable del recurso. */
  readonly id: string
  /** Nombre visible para el docente (ej. "Presentación tema 1"). */
  readonly nombre: string
  /** Nombre del archivo dentro de la carpeta del concepto (ej. "clase.pdf"). */
  readonly archivo: string
  /** Formato deducido de la extensión. */
  readonly formato: FormatoRecurso
}

export interface DatosRecurso {
  id: string
  nombre: string
  archivo: string
  formato: FormatoRecurso
}

export function crearRecurso(datos: DatosRecurso): Recurso {
  const nombre = datos.nombre.trim()
  const archivo = datos.archivo.trim()
  exigir(datos.id.trim().length > 0, 'El material no tiene identificador.')
  exigir(
    nombre.length > 0,
    'El material necesita un nombre.',
    'Escribe un nombre para reconocerlo fácilmente.'
  )
  exigir(archivo.length > 0, 'El material no tiene archivo asociado.')

  return { id: datos.id.trim(), nombre, archivo, formato: datos.formato }
}

/**
 * Carpetas dentro del material de un concepto.
 *
 * Son carpetas REALES en disco: `conceptos/<slug>/Lecturas/paper.pdf`. Así el
 * docente ve la misma organización desde OneDrive, el Finder o el móvil, y si
 * copia la carpeta a otro sitio la organización viaja con ella. Por eso
 * `Recurso.archivo` puede llevar un prefijo de carpeta ("Lecturas/paper.pdf")
 * y no solo un nombre suelto.
 *
 * Solo se admite UN nivel: el docente organiza, no construye un árbol. Anidar
 * carpetas multiplica los sitios donde perder un archivo sin ganar nada.
 */

/** Caracteres que ningún sistema de archivos acepta en un nombre de carpeta. */
const PROHIBIDOS = /[\\/:*?"<>|]/g

/**
 * Convierte lo que escribe el docente en un nombre de carpeta usable en
 * Windows, macOS y Linux. Devuelve '' si no queda nada aprovechable.
 */
export function nombreCarpetaSeguro(nombre: string): string {
  const limpio = nombre
    .replace(PROHIBIDOS, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    // Quitar las barras deja "../../etc" en ".. .. etc": inofensivo, pero feo.
    // Se recortan los puntos de delante para que quede "etc".
    .replace(/^[.\s]+/, '')
    // Windows no admite un punto final, y "." o ".." serían la carpeta misma.
    .replace(/\.+$/, '')
    .trim()
  return limpio === '.' || limpio === '..' ? '' : limpio.slice(0, 60)
}

/** Carpeta de un archivo, o '' si está suelto en la raíz del concepto. */
export function carpetaDe(archivo: string): string {
  const corte = archivo.lastIndexOf('/')
  return corte === -1 ? '' : archivo.slice(0, corte)
}

/** Nombre del archivo sin su carpeta. */
export function archivoSinCarpeta(archivo: string): string {
  const corte = archivo.lastIndexOf('/')
  return corte === -1 ? archivo : archivo.slice(corte + 1)
}

/** Compone la ruta relativa de un archivo dentro de una carpeta (o la raíz). */
export function rutaEnCarpeta(carpeta: string, archivo: string): string {
  const segura = nombreCarpetaSeguro(carpeta)
  return segura ? `${segura}/${archivoSinCarpeta(archivo)}` : archivoSinCarpeta(archivo)
}
