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
 * Asignatura: materia con su contenido (unidades -> temas -> subtemas) y sus
 * componentes de aprendizaje. NO se duplica por período: la MISMA asignatura se
 * oferta en uno o varios períodos (`periodos`), como referencia, sin repetir el
 * contenido. Pertenece a la capa curricular.
 */
export interface Asignatura {
  readonly id: string
  readonly nombre: string
  /** Períodos en los que se dicta esta asignatura (ej. ["2026A", "2026B"]). */
  readonly periodos: readonly string[]
  readonly componentes: readonly ComponenteAprendizaje[]
  readonly unidades: readonly Unidad[]
}

export interface DatosAsignatura {
  id: string
  nombre: string
  periodos: readonly string[]
  componentes?: readonly ComponenteAprendizaje[]
  unidades?: readonly Unidad[]
}

/** Normaliza períodos: recorta, descarta vacíos y elimina duplicados. */
export function normalizarPeriodos(periodos: readonly string[]): string[] {
  const vistos = new Set<string>()
  const salida: string[] = []
  for (const p of periodos) {
    const limpio = p.trim()
    if (limpio.length > 0 && !vistos.has(limpio)) {
      vistos.add(limpio)
      salida.push(limpio)
    }
  }
  return salida
}

export function crearAsignatura(datos: DatosAsignatura): Asignatura {
  const nombre = datos.nombre.trim()
  const periodos = normalizarPeriodos(datos.periodos)
  exigir(datos.id.trim().length > 0, 'La asignatura no tiene identificador.')
  exigir(
    nombre.length > 0,
    'La asignatura necesita un nombre.',
    "Escribe un nombre, por ejemplo 'Algoritmos'."
  )
  exigir(
    periodos.length > 0,
    'La asignatura necesita al menos un período.',
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
    periodos,
    componentes,
    unidades: datos.unidades ?? []
  }
}

/** Agrega un período a la asignatura (idempotente). */
export function agregarPeriodo(asignatura: Asignatura, periodo: string): Asignatura {
  return { ...asignatura, periodos: normalizarPeriodos([...asignatura.periodos, periodo]) }
}

/** Quita un período. Exige que quede al menos uno. */
export function quitarPeriodo(asignatura: Asignatura, periodo: string): Asignatura {
  const periodos = asignatura.periodos.filter((p) => p !== periodo.trim())
  exigir(periodos.length > 0, 'La asignatura debe conservar al menos un período.')
  return { ...asignatura, periodos }
}

/** Agrega una unidad al final de la asignatura. */
export function agregarUnidad(asignatura: Asignatura, unidad: Unidad): Asignatura {
  return { ...asignatura, unidades: [...asignatura.unidades, unidad] }
}
