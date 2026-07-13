import { randomUUID } from 'node:crypto'

import type { DatosAsignaturaDTO, ResumenAsignaturaDTO } from '../../shared/dtos'
import {
  crearAsignatura as nuevaAsignatura,
  crearComponente,
  type ComponenteAprendizaje
} from '../domain/Asignatura'
import { crearSubtema } from '../domain/Subtema'
import { crearTema, type Tema } from '../domain/Tema'
import { crearUnidad, type Unidad } from '../domain/Unidad'
import { slugUnico } from '../domain/slug'
import type { Servicios } from '../servicios'
import { aResumenAsignaturaDTO } from './mapeadores'

/**
 * Crea una asignatura completa a partir del payload del asistente: genera el id
 * de la asignatura (slug único a partir de nombre + período) y los ids internos
 * de unidades, temas y subtemas. Escribe su pea.yaml y la indexa.
 */
export function crearAsignatura(
  servicios: Servicios,
  datos: DatosAsignaturaDTO
): ResumenAsignaturaDTO {
  const { vault, repositorio } = servicios

  const existentes = new Set(vault.listarIdsAsignaturas())
  const id = slugUnico(datos.nombre, existentes, 'asignatura')

  const componentes: ComponenteAprendizaje[] = datos.componentes.map((c) => crearComponente(c))

  const unidades: Unidad[] = datos.unidades.map((u, i) => {
    const temas: Tema[] = u.temas.map((t, j) => {
      const subtemas = (t.subtemas ?? [])
        .map((titulo) => titulo.trim())
        .filter((titulo) => titulo.length > 0)
        .map((titulo, k) => crearSubtema({ id: randomUUID(), titulo, orden: k + 1 }))
      return crearTema({
        id: randomUUID(),
        titulo: t.titulo,
        orden: j + 1,
        semana: t.semana ?? null,
        subtemas
      })
    })
    return crearUnidad({ id: randomUUID(), titulo: u.titulo, orden: i + 1, temas })
  })

  const asignatura = nuevaAsignatura({
    id,
    nombre: datos.nombre,
    tipo: datos.tipo ?? 'docencia',
    periodos: datos.periodos,
    componentes,
    unidades
  })

  vault.guardarAsignatura(asignatura)
  repositorio.indexarAsignatura(asignatura)

  return aResumenAsignaturaDTO(asignatura)
}
