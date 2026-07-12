import { randomUUID } from 'node:crypto'
import { basename, extname } from 'node:path'

import type {
  CombinarTareasDTO,
  CruceDTO,
  DatosTareaDTO,
  DuplicarTareaDTO,
  ResultadoAdjuntoDTO,
  ResumenTareaDTO,
  TareaDTO
} from '../../shared/dtos'
import type { Tarea } from '../domain/Tarea'
import type { Asignatura } from '../domain/Asignatura'
import { ErrorDeDominio } from '../domain/errores'
import { crearRecurso } from '../domain/Recurso'
import { agregarAdjunto, crearTarea as nuevaTarea, quitarAdjunto } from '../domain/Tarea'
import { formatoDesdeNombreArchivo } from '../domain/tipos'
import { slugUnico } from '../domain/slug'
import type { Servicios } from '../servicios'
import { aResumenTareaDTO, aTareaDTO } from './mapeadores'

/** Conceptos que instancian los temas indicados (unión, sin duplicados). */
function derivarConceptos(asignatura: Asignatura, temaIds: readonly string[]): string[] {
  const conjunto = new Set<string>()
  for (const unidad of asignatura.unidades) {
    for (const tema of unidad.temas) {
      if (temaIds.includes(tema.id)) {
        for (const conceptoId of tema.conceptos) conjunto.add(conceptoId)
      }
    }
  }
  return [...conjunto]
}

function exigirAsignatura(servicios: Servicios, asignaturaId: string): Asignatura {
  if (!servicios.vault.existeAsignatura(asignaturaId)) {
    throw new ErrorDeDominio('No encontramos esa asignatura.', 'Puede que ya se haya eliminado.')
  }
  return servicios.vault.leerAsignatura(asignaturaId)
}

export function crearTarea(servicios: Servicios, datos: DatosTareaDTO): TareaDTO {
  const { vault } = servicios
  const asignatura = exigirAsignatura(servicios, datos.asignaturaId)

  const id = slugUnico(datos.titulo, new Set(vault.listarIdsTareas()), 'tarea')
  const tarea = nuevaTarea({
    id,
    titulo: datos.titulo,
    instrucciones: datos.instrucciones,
    formato: datos.formato,
    asignaturaId: datos.asignaturaId,
    temas: datos.temas,
    componente: datos.componente,
    conceptos: derivarConceptos(asignatura, datos.temas)
  })

  vault.guardarTarea(tarea)
  return aTareaDTO(tarea)
}

export function editarTarea(servicios: Servicios, id: string, datos: DatosTareaDTO): TareaDTO {
  const { vault } = servicios
  if (!vault.existeTarea(id)) {
    throw new ErrorDeDominio('No encontramos esa tarea.', 'Puede que ya se haya eliminado.')
  }
  const asignatura = exigirAsignatura(servicios, datos.asignaturaId)
  const actual = vault.leerTarea(id)

  const tarea = nuevaTarea({
    id,
    titulo: datos.titulo,
    instrucciones: datos.instrucciones,
    formato: datos.formato,
    asignaturaId: datos.asignaturaId,
    temas: datos.temas,
    componente: datos.componente,
    conceptos: derivarConceptos(asignatura, datos.temas),
    recursos: actual.recursos
  })

  vault.guardarTarea(tarea)
  return aTareaDTO(tarea)
}

export function eliminarTarea(servicios: Servicios, id: string): void {
  const { vault } = servicios
  if (!vault.existeTarea(id)) {
    throw new ErrorDeDominio('No encontramos esa tarea.', 'Puede que ya se haya eliminado.')
  }
  vault.eliminarTarea(id)
}

export function obtenerTarea(servicios: Servicios, id: string): TareaDTO {
  const { vault } = servicios
  if (!vault.existeTarea(id)) {
    throw new ErrorDeDominio('No encontramos esa tarea.', 'Puede que ya se haya eliminado.')
  }
  return aTareaDTO(vault.leerTarea(id))
}

export function listarTareasDeAsignatura(
  servicios: Servicios,
  asignaturaId: string
): ResumenTareaDTO[] {
  return servicios.vault
    .leerTodasTareas()
    .filter((t) => t.asignaturaId === asignaturaId)
    .map(aResumenTareaDTO)
    .sort((a, b) => a.titulo.localeCompare(b.titulo, 'es', { sensitivity: 'base' }))
}

export function listarTareasDeConcepto(
  servicios: Servicios,
  conceptoId: string
): ResumenTareaDTO[] {
  return servicios.vault
    .leerTodasTareas()
    .filter((t) => t.conceptos.includes(conceptoId))
    .map(aResumenTareaDTO)
    .sort((a, b) => a.titulo.localeCompare(b.titulo, 'es', { sensitivity: 'base' }))
}

export function agregarAdjuntoTarea(
  servicios: Servicios,
  tareaId: string,
  rutas: string[]
): ResultadoAdjuntoDTO {
  const { vault } = servicios
  if (!vault.existeTarea(tareaId)) {
    throw new ErrorDeDominio('No encontramos esa tarea.', 'Puede que ya se haya eliminado.')
  }

  let tarea = vault.leerTarea(tareaId)
  const ignorados: string[] = []
  let agregados = 0

  for (const ruta of rutas) {
    if (formatoDesdeNombreArchivo(ruta) === null) {
      ignorados.push(basename(ruta))
      continue
    }
    const { archivo, formato } = vault.copiarAdjuntoTarea(tareaId, ruta)
    const nombre = basename(ruta, extname(ruta)) || archivo
    tarea = agregarAdjunto(tarea, crearRecurso({ id: randomUUID(), nombre, archivo, formato }))
    agregados += 1
  }

  if (agregados > 0) vault.guardarTarea(tarea)
  return { tarea: aTareaDTO(tarea), agregados, ignorados }
}

/**
 * Cruces de una tarea: temas de OTRAS asignaturas que comparten alguno de sus
 * conceptos. Es la conexión por grafo que sugiere dónde reutilizarla.
 */
export function crucesDeTarea(servicios: Servicios, tareaId: string): CruceDTO[] {
  const { vault, repositorio } = servicios
  if (!vault.existeTarea(tareaId)) {
    throw new ErrorDeDominio('No encontramos esa tarea.', 'Puede que ya se haya eliminado.')
  }
  const tarea = vault.leerTarea(tareaId)
  const cruces: CruceDTO[] = []
  const vistos = new Set<string>()

  for (const conceptoId of tarea.conceptos) {
    for (const uso of repositorio.usosDeConcepto(conceptoId)) {
      if (uso.asignaturaId === tarea.asignaturaId) continue // excluye su propia asignatura
      const clave = `${conceptoId}|${uso.temaId}`
      if (vistos.has(clave)) continue
      vistos.add(clave)
      cruces.push({
        conceptoId,
        asignaturaId: uso.asignaturaId,
        asignatura: uso.asignatura,
        periodos: uso.periodos,
        unidad: uso.unidad,
        temaId: uso.temaId,
        tema: uso.tema
      })
    }
  }
  return cruces
}

/**
 * Duplica una tarea en otra asignatura para reutilizarla: copia instrucciones y
 * adjuntos, re-deriva los conceptos según los temas destino y carga el
 * componente original solo si la asignatura destino lo tiene.
 */
export function duplicarTarea(
  servicios: Servicios,
  tareaId: string,
  destino: DuplicarTareaDTO
): TareaDTO {
  const { vault } = servicios
  if (!vault.existeTarea(tareaId)) {
    throw new ErrorDeDominio('No encontramos esa tarea.', 'Puede que ya se haya eliminado.')
  }
  const original = vault.leerTarea(tareaId)
  const asignatura = exigirAsignatura(servicios, destino.asignaturaId)

  const componente =
    original.componente && asignatura.componentes.some((c) => c.clave === original.componente)
      ? original.componente
      : null

  const id = slugUnico(destino.titulo, new Set(vault.listarIdsTareas()), 'tarea')
  let copia = nuevaTarea({
    id,
    titulo: destino.titulo,
    instrucciones: original.instrucciones,
    formato: original.formato,
    asignaturaId: destino.asignaturaId,
    temas: destino.temas,
    componente,
    conceptos: derivarConceptos(asignatura, destino.temas)
  })

  // Copia física de los adjuntos a la nueva tarea.
  for (const recurso of original.recursos) {
    const origen = vault.rutaAdjuntoTarea(original.id, recurso.archivo)
    if (origen === null) continue
    const { archivo, formato } = vault.copiarAdjuntoTarea(id, origen)
    copia = agregarAdjunto(copia, crearRecurso({ id: randomUUID(), nombre: recurso.nombre, archivo, formato }))
  }

  vault.guardarTarea(copia)
  return aTareaDTO(copia)
}

/** Fusiona las instrucciones de varias tareas en un solo Markdown. */
function fusionarInstrucciones(origenes: Tarea[]): string {
  return origenes
    .map((t) => `## De «${t.titulo}»\n\n${t.instrucciones}`.trim())
    .join('\n\n---\n\n')
}

/**
 * Combina varias tareas en una NUEVA reutilizando su material: la nueva tarea
 * hereda la UNIÓN de los adjuntos de las tareas origen (sin duplicar por nombre)
 * y deriva los conceptos de los temas destino. Las instrucciones se pasan o, si
 * no, se fusionan las de las tareas origen. Generaliza `duplicarTarea` a varias
 * fuentes; es la base para que el docente no prepare material desde cero.
 */
export function combinarTareas(servicios: Servicios, datos: CombinarTareasDTO): TareaDTO {
  const { vault } = servicios
  const origenes: Tarea[] = []
  for (const idOrigen of datos.tareasOrigen) {
    if (!vault.existeTarea(idOrigen)) {
      throw new ErrorDeDominio(`No encontramos la tarea "${idOrigen}".`, 'Puede que ya se haya eliminado.')
    }
    origenes.push(vault.leerTarea(idOrigen))
  }
  if (origenes.length < 2) {
    throw new ErrorDeDominio('Se necesitan al menos dos tareas para combinar.')
  }
  const asignatura = exigirAsignatura(servicios, datos.asignaturaId)

  const id = slugUnico(datos.titulo, new Set(vault.listarIdsTareas()), 'tarea')
  let combinada = nuevaTarea({
    id,
    titulo: datos.titulo,
    instrucciones: datos.instrucciones ?? fusionarInstrucciones(origenes),
    asignaturaId: datos.asignaturaId,
    temas: datos.temas,
    componente: datos.componente ?? null,
    conceptos: derivarConceptos(asignatura, datos.temas)
  })

  // Copia física de la UNIÓN de adjuntos (dedup por nombre visible).
  const vistos = new Set<string>()
  for (const origen of origenes) {
    for (const recurso of origen.recursos) {
      const clave = recurso.nombre.toLowerCase()
      if (vistos.has(clave)) continue
      const ruta = vault.rutaAdjuntoTarea(origen.id, recurso.archivo)
      if (ruta === null) continue
      vistos.add(clave)
      const { archivo, formato } = vault.copiarAdjuntoTarea(id, ruta)
      combinada = agregarAdjunto(combinada, crearRecurso({ id: randomUUID(), nombre: recurso.nombre, archivo, formato }))
    }
  }

  vault.guardarTarea(combinada)
  return aTareaDTO(combinada)
}

export function eliminarAdjuntoTarea(
  servicios: Servicios,
  tareaId: string,
  recursoId: string
): TareaDTO {
  const { vault } = servicios
  if (!vault.existeTarea(tareaId)) {
    throw new ErrorDeDominio('No encontramos esa tarea.', 'Puede que ya se haya eliminado.')
  }
  const tarea = vault.leerTarea(tareaId)
  const recurso = tarea.recursos.find((r) => r.id === recursoId)
  if (!recurso) {
    throw new ErrorDeDominio('No encontramos ese adjunto.', 'Puede que ya se haya eliminado.')
  }
  vault.eliminarArchivoAdjuntoTarea(tareaId, recurso.archivo)
  const actualizada = quitarAdjunto(tarea, recursoId)
  vault.guardarTarea(actualizada)
  return aTareaDTO(actualizada)
}
