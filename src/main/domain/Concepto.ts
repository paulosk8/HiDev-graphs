import { exigir, ErrorDeDominio } from './errores'
import type { EnlaceMaterial } from './EnlaceMaterial'
import type { Recurso } from './Recurso'
import { nombreCarpetaSeguro } from './Recurso'
import type { Relacion } from './Relacion'
import type { RepasoConcepto } from './Repaso'
import type { Termino } from './Termino'

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
  /** Material que vive en la web (páginas, vídeos, simuladores). */
  readonly enlaces: readonly EnlaceMaterial[]
  /** Notas u observaciones propias sobre el concepto (varias). */
  readonly notas: readonly NotaConcepto[]
  /**
   * Glosario del concepto: términos con su definición corta. Viaja con el
   * concepto, así que la misma definición vale en todas las asignaturas donde
   * se use, igual que su material.
   */
  readonly terminos: readonly Termino[]
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
  enlaces?: readonly EnlaceMaterial[]
  notas?: readonly NotaConcepto[]
  terminos?: readonly Termino[]
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
    enlaces: datos.enlaces ?? [],
    notas: datos.notas ?? [],
    terminos: datos.terminos ?? [],
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

/** Agrega un enlace web al material del concepto. */
export function agregarEnlace(concepto: Concepto, enlace: EnlaceMaterial): Concepto {
  // La misma dirección dos veces es siempre un despiste (doble clic, pegar de
  // nuevo lo que ya estaba); se avisa en vez de dejar la lista con duplicados.
  if (concepto.enlaces.some((e) => e.url === enlace.url)) {
    throw new ErrorDeDominio(
      'Ese enlace ya está en el material de este concepto.',
      'Búscalo en la lista de material; si quieres cambiarle el nombre, edítalo.'
    )
  }
  return { ...concepto, enlaces: [...concepto.enlaces, enlace] }
}

/** Sustituye un enlace por su versión editada (mismo id). */
export function actualizarEnlace(concepto: Concepto, enlace: EnlaceMaterial): Concepto {
  if (!concepto.enlaces.some((e) => e.id === enlace.id)) {
    throw new ErrorDeDominio('Ese enlace ya no está en el concepto.')
  }
  return {
    ...concepto,
    enlaces: concepto.enlaces.map((e) => (e.id === enlace.id ? enlace : e))
  }
}

/** Quita un enlace web del concepto por su id. */
export function quitarEnlace(concepto: Concepto, enlaceId: string): Concepto {
  return { ...concepto, enlaces: concepto.enlaces.filter((e) => e.id !== enlaceId) }
}

/** Cambia un enlace de carpeta (o lo deja suelto si la carpeta es ''). */
export function moverEnlaceACarpeta(
  concepto: Concepto,
  enlaceId: string,
  carpeta: string
): Concepto {
  const destino = nombreCarpetaSeguro(carpeta)
  return {
    ...concepto,
    enlaces: concepto.enlaces.map((e) => (e.id === enlaceId ? { ...e, carpeta: destino } : e))
  }
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

/**
 * Agrega un término al glosario. NO rechaza un duplicado a propósito: quien
 * está volcando términos no debe encontrarse un muro, y la interfaz ya avisa en
 * ámbar con el que ya existe. Bloquear aquí solo perdería lo escrito.
 */
export function agregarTermino(concepto: Concepto, termino: Termino): Concepto {
  return { ...concepto, terminos: [...concepto.terminos, termino] }
}

/** Sustituye un término por su versión editada (mismo id). */
export function actualizarTermino(concepto: Concepto, termino: Termino): Concepto {
  if (!concepto.terminos.some((t) => t.id === termino.id)) {
    throw new ErrorDeDominio('Ese término ya no está en el concepto.')
  }
  return {
    ...concepto,
    terminos: concepto.terminos.map((t) => (t.id === termino.id ? termino : t))
  }
}

/** Quita un término del glosario por su id. */
export function quitarTermino(concepto: Concepto, terminoId: string): Concepto {
  return { ...concepto, terminos: concepto.terminos.filter((t) => t.id !== terminoId) }
}
