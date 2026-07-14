import { randomUUID } from 'node:crypto'

import type { AsignaturaDTO, DatosAsignaturaEdicionDTO } from '../../shared/dtos'
import {
  crearAsignatura as nuevaAsignatura,
  crearComponente,
  normalizarPeriodos,
  type ComponenteAprendizaje,
  type Planificacion
} from '../domain/Asignatura'
import { ErrorDeDominio } from '../domain/errores'
import { crearSubtema, type Subtema } from '../domain/Subtema'
import { crearTema, type Tema } from '../domain/Tema'
import { crearUnidad, type Unidad } from '../domain/Unidad'
import type { Servicios } from '../servicios'
import { aAsignaturaDTO } from './mapeadores'

/**
 * Edita una asignatura existente: nombre, períodos, componentes y estructura
 * (unidades/temas). Conserva la identidad de las unidades y temas que ya
 * existían (los que llegan con `id`), de modo que NO se rompen los vínculos
 * tema↔concepto, las tareas ni la planificación. Los temas eliminados se
 * limpian de la planificación; los períodos eliminados descartan su plan.
 *
 * No cambia el `tipo` de la asignatura (docencia/aprendizaje) ni sus subtemas,
 * que se conservan intactos por tema existente.
 */
export function editarAsignatura(
  servicios: Servicios,
  id: string,
  datos: DatosAsignaturaEdicionDTO
): AsignaturaDTO {
  const { vault, repositorio } = servicios

  if (!vault.existeAsignatura(id)) {
    throw new ErrorDeDominio('No encontramos esa asignatura.', 'Puede que ya se haya eliminado.')
  }

  const actual = vault.leerAsignatura(id)
  const temasPrevios = new Map<string, Tema>()
  for (const u of actual.unidades) {
    for (const t of u.temas) temasPrevios.set(t.id, t)
  }

  // Reconstruye unidades y temas conservando ids (y subtemas/conceptos de los
  // temas existentes). Los que no traen id son nuevos.
  const unidades: Unidad[] = datos.unidades.map((u, i) => {
    const temas: Tema[] = u.temas.map((t, j) => {
      const previo = t.id ? temasPrevios.get(t.id) : undefined
      // Subtemas (3er nivel): si el payload los trae, se reconstruyen conservando
      // los ids existentes; si se omiten, se conservan los del tema previo.
      const subtemas: readonly Subtema[] = t.subtemas
        ? (() => {
            const prevPorId = new Map((previo?.subtemas ?? []).map((s) => [s.id, s]))
            return t.subtemas
              .filter((st) => st.titulo.trim().length > 0)
              .map((st, k) =>
                crearSubtema({
                  id: st.id && prevPorId.has(st.id) ? st.id : randomUUID(),
                  titulo: st.titulo,
                  orden: k + 1
                })
              )
          })()
        : (previo?.subtemas ?? [])
      return crearTema({
        id: previo?.id ?? randomUUID(),
        titulo: t.titulo,
        orden: j + 1,
        semana: previo?.semana ?? null,
        subtemas,
        conceptos: previo?.conceptos ?? []
      })
    })
    const unidadPrevia = u.id ? actual.unidades.find((x) => x.id === u.id) : undefined
    return crearUnidad({ id: unidadPrevia?.id ?? randomUUID(), titulo: u.titulo, orden: i + 1, temas })
  })

  // Temas que sobreviven a la edición: se usan para depurar la planificación.
  const temasVivos = new Set<string>()
  for (const u of unidades) for (const t of u.temas) temasVivos.add(t.id)

  const periodos = normalizarPeriodos(datos.periodos)
  const periodosVivos = new Set(periodos)

  // Depura la planificación: descarta períodos eliminados y temas que ya no
  // existen; elimina semanas y planificaciones que queden vacías.
  const planificaciones: Planificacion[] = actual.planificaciones
    .filter((p) => periodosVivos.has(p.periodo))
    .map((p) => ({
      periodo: p.periodo,
      semanas: p.semanas
        .map((s) => ({ numero: s.numero, temas: s.temas.filter((t) => temasVivos.has(t)) }))
        .filter((s) => s.temas.length > 0)
    }))
    .filter((p) => p.semanas.length > 0)

  const componentes: ComponenteAprendizaje[] = datos.componentes.map((c) => crearComponente(c))

  const editada = nuevaAsignatura({
    id: actual.id,
    nombre: datos.nombre,
    tipo: actual.tipo,
    periodos,
    componentes,
    unidades,
    planificaciones
  })

  vault.guardarAsignatura(editada)
  repositorio.indexarAsignatura(editada)

  return aAsignaturaDTO(editada)
}
