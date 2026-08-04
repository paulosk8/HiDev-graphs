import { exigir, ErrorDeDominio } from './errores'
import type { Recurso } from './Recurso'
import type { Relacion } from './Relacion'
import type { RepasoConcepto } from './Repaso'

/** Formato del contenido de las notas: Markdown, HTML o código (vista editor). */
export type FormatoNota = 'markdown' | 'html' | 'codigo'

/**
 * Normaliza una etiqueta para que "Evaluación", "evaluacion" y " EVALUACIÓN "
 * sean la MISMA etiqueta. Se conserva el texto tal cual lo escribe el docente
 * (con tildes y mayúsculas) y solo se recorta: quien busca no debería tener que
 * acordarse de cómo la escribió la primera vez.
 *
 * Se quitan los `#` iniciales porque el docente puede teclearla con almohadilla
 * (`#parcial1`), como en cualquier red social o en Obsidian.
 */
export function normalizarEtiqueta(texto: string): string {
  // Se recorta ANTES de quitar la almohadilla: " #parcial" también la lleva.
  return texto.trim().replace(/^#+/, '').trim().replace(/\s+/g, ' ')
}

/** Clave de comparación de etiquetas: sin mayúsculas ni tildes. */
export function claveEtiqueta(texto: string): string {
  return normalizarEtiqueta(texto)
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
}

/** Limpia una lista de etiquetas: normaliza, quita vacías y duplicados. */
export function sanearEtiquetas(etiquetas: readonly string[] | undefined): string[] {
  const porClave = new Map<string, string>()
  for (const bruta of etiquetas ?? []) {
    const etiqueta = normalizarEtiqueta(bruta)
    if (!etiqueta) continue
    // Se queda la primera grafía escrita; las repetidas no crean duplicados.
    if (!porClave.has(claveEtiqueta(etiqueta))) porClave.set(claveEtiqueta(etiqueta), etiqueta)
  }
  return [...porClave.values()]
}

/** Una nota u observación sobre un concepto (varias por concepto). */
export interface NotaConcepto {
  readonly id: string
  /** Título opcional de la nota. */
  readonly titulo: string
  readonly contenido: string
  readonly formato: FormatoNota
}

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
  /** Notas u observaciones propias sobre el concepto (varias). */
  readonly notas: readonly NotaConcepto[]
  /**
   * Etiquetas libres del docente ("evaluación", "primer parcial"). Sirven para
   * encontrar material por criterios propios, transversales a las asignaturas.
   */
  readonly etiquetas: readonly string[]
  /** Estado de repaso espaciado (opcional; ausente si nunca se ha repasado). */
  readonly repaso?: RepasoConcepto
}

export interface DatosConcepto {
  id: string
  nombre: string
  descripcion?: string
  relaciones?: readonly Relacion[]
  recursos?: readonly Recurso[]
  notas?: readonly NotaConcepto[]
  etiquetas?: readonly string[]
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
    notas: datos.notas ?? [],
    etiquetas: sanearEtiquetas(datos.etiquetas),
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
