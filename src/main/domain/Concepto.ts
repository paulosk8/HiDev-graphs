import { exigir, ErrorDeDominio } from './errores'
import type { Recurso } from './Recurso'
import type { Relacion } from './Relacion'
import type { RepasoConcepto } from './Repaso'

/**
 * Concepto: unidad de conocimiento reutilizable entre asignaturas.
 *
 * Es el corazón de la capa de conocimiento. Posee su material (recursos) y
 * sus relaciones con otros conceptos. Es estable y transversal: el mismo
 * concepto puede instanciarse en temas de distintas asignaturas.
 */
export interface Concepto {
  /** Id estable (slug derivado del nombre). */
  readonly id: string
  readonly nombre: string
  readonly descripcion: string
  readonly relaciones: readonly Relacion[]
  readonly recursos: readonly Recurso[]
  /** Estado de repaso espaciado (opcional; ausente si nunca se ha repasado). */
  readonly repaso?: RepasoConcepto
}

export interface DatosConcepto {
  id: string
  nombre: string
  descripcion?: string
  relaciones?: readonly Relacion[]
  recursos?: readonly Recurso[]
  repaso?: RepasoConcepto
}

/** Crea un concepto validando sus datos básicos. */
export function crearConcepto(datos: DatosConcepto): Concepto {
  const nombre = datos.nombre.trim()
  exigir(datos.id.trim().length > 0, 'El concepto no tiene identificador.')
  exigir(
    nombre.length > 0,
    'El concepto necesita un nombre.',
    "Escribe un nombre, por ejemplo 'Divide y vencerás'."
  )

  return {
    id: datos.id.trim(),
    nombre,
    descripcion: (datos.descripcion ?? '').trim(),
    relaciones: datos.relaciones ?? [],
    recursos: datos.recursos ?? [],
    ...(datos.repaso ? { repaso: datos.repaso } : {})
  }
}

/** Agrega material al concepto (operación pura: devuelve un concepto nuevo). */
export function agregarRecurso(concepto: Concepto, recurso: Recurso): Concepto {
  if (concepto.recursos.some((r) => r.id === recurso.id)) {
    throw new ErrorDeDominio('Este material ya está en el concepto.')
  }
  return { ...concepto, recursos: [...concepto.recursos, recurso] }
}

/** Quita material del concepto por su id. */
export function quitarRecurso(concepto: Concepto, recursoId: string): Concepto {
  return { ...concepto, recursos: concepto.recursos.filter((r) => r.id !== recursoId) }
}

/**
 * Relaciona el concepto con otro. Evita la auto-relación y los duplicados
 * (mismo destino y mismo tipo).
 */
export function relacionarCon(concepto: Concepto, relacion: Relacion): Concepto {
  exigir(
    relacion.destino !== concepto.id,
    'Un concepto no puede relacionarse consigo mismo.'
  )
  const yaExiste = concepto.relaciones.some(
    (r) => r.destino === relacion.destino && r.tipo === relacion.tipo
  )
  if (yaExiste) return concepto
  return { ...concepto, relaciones: [...concepto.relaciones, relacion] }
}

/** Elimina una relación del concepto. */
export function quitarRelacion(
  concepto: Concepto,
  destino: string,
  tipo: Relacion['tipo']
): Concepto {
  return {
    ...concepto,
    relaciones: concepto.relaciones.filter(
      (r) => !(r.destino === destino && r.tipo === tipo)
    )
  }
}
