import type { AristaGrafoDTO, GrafoDTO, NodoGrafoDTO, TipoAristaGrafo } from '../../shared/dtos'
import { esTipoRelacion } from '../domain/tipos'
import type { Servicios } from '../servicios'

/**
 * Arma el grafo de conocimiento para visualizarlo:
 *  - Nodos: conceptos y asignaturas.
 *  - Aristas: concepto—asignatura ('usado_en', el puente que revela la
 *    reutilización) y concepto→concepto (relaciones tipadas).
 * El `peso` de un concepto es en cuántas asignaturas se usa (su transversalidad,
 * los "conceptos god"). El filtrado por asignatura/tipo se hace en el renderer.
 */
export function obtenerGrafo(servicios: Servicios): GrafoDTO {
  const { repositorio, vault } = servicios

  const usos = repositorio.usosConceptoAsignatura()
  const conteoPorConcepto = new Map<string, number>()
  for (const u of usos) {
    conteoPorConcepto.set(u.conceptoId, (conteoPorConcepto.get(u.conceptoId) ?? 0) + 1)
  }

  const nodos: NodoGrafoDTO[] = []
  for (const c of repositorio.listarConceptos()) {
    nodos.push({
      id: `c:${c.id}`,
      etiqueta: c.nombre,
      tipo: 'concepto',
      peso: conteoPorConcepto.get(c.id) ?? 0
    })
  }
  for (const a of repositorio.listarAsignaturas()) {
    const periodos = a.periodos.length > 0 ? ` · ${a.periodos.join(', ')}` : ''
    nodos.push({ id: `a:${a.id}`, etiqueta: `${a.nombre}${periodos}`, tipo: 'asignatura', peso: 0 })
  }

  const aristas: AristaGrafoDTO[] = usos.map((u) => ({
    origen: `c:${u.conceptoId}`,
    destino: `a:${u.asignaturaId}`,
    tipo: 'usado_en',
    asignaturaId: u.asignaturaId
  }))

  for (const r of repositorio.relacionesEntreConceptos()) {
    if (esTipoRelacion(r.tipo)) {
      aristas.push({ origen: `c:${r.origen}`, destino: `c:${r.destino}`, tipo: r.tipo as TipoAristaGrafo })
    }
  }

  // Co-ocurrencia: conceptos que se enseñan en un mismo tema quedan conectados.
  for (const { a, b } of repositorio.coocurrenciasDeConceptos()) {
    aristas.push({ origen: `c:${a}`, destino: `c:${b}`, tipo: 'coocurre' })
  }

  // Tareas como nodos: se conectan a los conceptos que cubren (derivados de sus
  // temas). Así dos tareas que tocan el mismo concepto quedan unidas por ese nodo.
  // Las tareas no están en el índice: se leen del vault.
  for (const tarea of vault.leerTodasTareas()) {
    nodos.push({
      id: `t:${tarea.id}`,
      etiqueta: tarea.titulo,
      tipo: 'tarea',
      peso: tarea.conceptos.length,
      asignaturaId: tarea.asignaturaId
    })
    for (const conceptoId of tarea.conceptos) {
      aristas.push({ origen: `t:${tarea.id}`, destino: `c:${conceptoId}`, tipo: 'tarea_concepto' })
    }
  }

  return { nodos, aristas }
}
