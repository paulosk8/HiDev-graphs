import { exigir, ErrorDeDominio } from './errores'
import type { Unidad } from './Unidad'

/**
 * Componente de aprendizaje configurable por asignatura.
 *
 * Ejemplos institucionales: CD (contacto docente), CP (componente práctico),
 * APE (aprendizaje práctico experimental), AA (aprendizaje autónomo). La lista
 * NO está fija en el código: cada asignatura define los suyos.
 */
export interface ComponenteAprendizaje {
  /** Clave corta en mayúsculas (ej. "CD"). */
  readonly clave: string
  /** Nombre legible (ej. "Contacto docente"). */
  readonly nombre: string
}

export function crearComponente(datos: { clave: string; nombre: string }): ComponenteAprendizaje {
  const clave = datos.clave.trim().toUpperCase()
  const nombre = datos.nombre.trim()
  exigir(clave.length > 0, 'El componente necesita una sigla.', 'Por ejemplo: CD, APE, AA.')
  exigir(nombre.length > 0, 'El componente necesita un nombre.')
  return { clave, nombre }
}

/**
 * Asignatura: instancia curricular de un período académico (ej. "Algoritmos
 * 2026A"). Contiene unidades -> temas -> subtemas y define sus componentes de
 * aprendizaje. Pertenece a la capa curricular, por período.
 */
export interface Asignatura {
  readonly id: string
  readonly nombre: string
  /** Período académico (ej. "2026A"). */
  readonly periodo: string
  readonly componentes: readonly ComponenteAprendizaje[]
  readonly unidades: readonly Unidad[]
}

export interface DatosAsignatura {
  id: string
  nombre: string
  periodo: string
  componentes?: readonly ComponenteAprendizaje[]
  unidades?: readonly Unidad[]
}

export function crearAsignatura(datos: DatosAsignatura): Asignatura {
  const nombre = datos.nombre.trim()
  const periodo = datos.periodo.trim()
  exigir(datos.id.trim().length > 0, 'La asignatura no tiene identificador.')
  exigir(
    nombre.length > 0,
    'La asignatura necesita un nombre.',
    "Escribe un nombre, por ejemplo 'Algoritmos'."
  )
  exigir(
    periodo.length > 0,
    'La asignatura necesita un período.',
    "Indica el período, por ejemplo '2026A'."
  )

  const componentes = datos.componentes ?? []
  const claves = new Set<string>()
  for (const c of componentes) {
    if (claves.has(c.clave)) {
      throw new ErrorDeDominio(`El componente "${c.clave}" está repetido.`)
    }
    claves.add(c.clave)
  }

  return {
    id: datos.id.trim(),
    nombre,
    periodo,
    componentes,
    unidades: datos.unidades ?? []
  }
}

/** Agrega una unidad al final de la asignatura. */
export function agregarUnidad(asignatura: Asignatura, unidad: Unidad): Asignatura {
  return { ...asignatura, unidades: [...asignatura.unidades, unidad] }
}
