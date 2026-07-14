import { useMemo } from 'react'
import type { AsignaturaDTO, ResumenTareaDTO } from '@shared/dtos'
import { useConceptosStore } from '../../stores/conceptosStore'
import { useUiStore } from '../../stores/uiStore'

interface Props {
  asignatura: AsignaturaDTO
  tareas: ResumenTareaDTO[]
}

interface Chequeo {
  clave: string
  etiqueta: string
  /** Texto cuando todo está bien. */
  ok: string
  /** Texto cuando hay pendientes (recibe el total). */
  aviso: (n: number) => string
  /** Elementos pendientes: nombre a mostrar + id opcional de concepto (para navegar). */
  pendientes: { nombre: string; conceptoId?: string }[]
}

export function SaludAsignatura({ asignatura, tareas }: Props): JSX.Element {
  const conceptos = useConceptosStore((s) => s.lista)
  const irASeccion = useUiStore((s) => s.irASeccion)
  const seleccionarConcepto = useUiStore((s) => s.seleccionarConcepto)

  const esAprendizaje = asignatura.tipo === 'aprendizaje'
  const porId = useMemo(() => new Map(conceptos.map((c) => [c.id, c])), [conceptos])

  const datos = useMemo(() => {
    const temas = asignatura.unidades.flatMap((u) =>
      u.temas.map((t) => ({ id: t.id, titulo: t.titulo, unidad: u.titulo, conceptos: t.conceptos }))
    )
    const conceptoIds = [...new Set(temas.flatMap((t) => t.conceptos))]
    const temasConTarea = new Set(tareas.flatMap((t) => t.temas))
    const temasPlanificados = new Set(
      asignatura.planificaciones.flatMap((p) => p.semanas.flatMap((s) => s.temas))
    )

    const nombreTema = (t: { unidad: string; titulo: string }): string => `${t.unidad} › ${t.titulo}`

    const temasSinConcepto = temas.filter((t) => t.conceptos.length === 0)
    const conceptosSinMaterial = conceptoIds
      .map((id) => porId.get(id))
      .filter((c): c is NonNullable<typeof c> => !!c && c.totalRecursos === 0)
    const temasSinTarea = temas.filter((t) => !temasConTarea.has(t.id))
    const temasSinPlanificar = temas.filter((t) => !temasPlanificados.has(t.id))

    const chequeos: Chequeo[] = [
      {
        clave: 'temas-concepto',
        etiqueta: 'Conceptos en los temas',
        ok: `Todos los ${esAprendizaje ? 'temas' : 'temas'} tienen al menos un concepto vinculado.`,
        aviso: (n) => `${n} ${n === 1 ? 'tema' : 'temas'} sin ningún concepto vinculado (sin material asociado).`,
        pendientes: temasSinConcepto.map((t) => ({ nombre: nombreTema(t) }))
      },
      {
        clave: 'concepto-material',
        etiqueta: 'Material en los conceptos',
        ok: 'Todos los conceptos usados aquí tienen material.',
        aviso: (n) => `${n} ${n === 1 ? 'concepto' : 'conceptos'} sin material. Ábrelos para agregarlo.`,
        pendientes: conceptosSinMaterial.map((c) => ({ nombre: c.nombre, conceptoId: c.id }))
      },
      {
        clave: 'tema-tarea',
        etiqueta: esAprendizaje ? 'Prácticas por tema' : 'Tareas por tema',
        ok: `Todos los temas tienen al menos una ${esAprendizaje ? 'práctica' : 'tarea'}.`,
        aviso: (n) =>
          `${n} ${n === 1 ? 'tema' : 'temas'} sin ${esAprendizaje ? 'práctica' : 'tarea'}.`,
        pendientes: temasSinTarea.map((t) => ({ nombre: nombreTema(t) }))
      },
      // La planificación semanal solo aplica a docencia.
      ...(esAprendizaje
        ? []
        : [
            {
              clave: 'tema-plan',
              etiqueta: 'Planificación semanal',
              ok: 'Todos los temas están asignados a alguna semana.',
              aviso: (n: number) =>
                `${n} ${n === 1 ? 'tema' : 'temas'} sin asignar a ninguna semana.`,
              pendientes: temasSinPlanificar.map((t) => ({ nombre: nombreTema(t) }))
            } as Chequeo
          ])
    ]

    const totalTemas = temas.length
    const totalConceptos = conceptoIds.length
    const conMaterial = totalConceptos - conceptosSinMaterial.length
    const avisos = chequeos.filter((c) => c.pendientes.length > 0).length

    return { chequeos, totalTemas, totalConceptos, conMaterial, avisos, totalTareas: tareas.length }
  }, [asignatura, tareas, porId, esAprendizaje])

  const abrirConcepto = (id: string): void => {
    irASeccion('conceptos', esAprendizaje ? 'aprendizaje' : 'docencia')
    seleccionarConcepto(id)
  }

  return (
    <div className="space-y-6">
      {/* Resumen general */}
      <div
        className={`rounded-xl border px-4 py-3 text-sm ${
          datos.avisos === 0
            ? 'border-emerald-200 bg-emerald-50 text-emerald-800'
            : 'border-amber-200 bg-amber-50 text-amber-800'
        }`}
      >
        {datos.avisos === 0
          ? `Todo en orden 🎉 ${esAprendizaje ? 'Tu espacio está' : 'Tu asignatura está'} bien cubierta.`
          : `Hay ${datos.avisos} ${datos.avisos === 1 ? 'punto' : 'puntos'} por revisar antes de ${esAprendizaje ? 'estudiar' : 'dar clase'}.`}
      </div>

      {/* Cifras clave */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Tarjeta valor={datos.totalTemas} etiqueta="Temas" />
        <Tarjeta valor={datos.totalConceptos} etiqueta="Conceptos" />
        <Tarjeta valor={datos.conMaterial} etiqueta="Con material" total={datos.totalConceptos} />
        <Tarjeta valor={datos.totalTareas} etiqueta={esAprendizaje ? 'Prácticas' : 'Tareas'} />
      </div>

      {/* Chequeos */}
      <ul className="space-y-3">
        {datos.chequeos.map((c) => {
          const ok = c.pendientes.length === 0
          return (
            <li key={c.clave} className="rounded-xl border border-slate-200 bg-white p-4">
              <div className="flex items-start gap-3">
                <span
                  aria-hidden
                  className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-xs text-white ${
                    ok ? 'bg-emerald-500' : 'bg-amber-500'
                  }`}
                >
                  {ok ? '✓' : '!'}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-slate-800">{c.etiqueta}</p>
                  <p className="mt-0.5 text-xs text-slate-500">
                    {ok ? c.ok : c.aviso(c.pendientes.length)}
                  </p>
                  {!ok && (
                    <ul className="mt-2 flex flex-wrap gap-1.5">
                      {c.pendientes.map((p, i) =>
                        p.conceptoId ? (
                          <li key={p.conceptoId}>
                            <button
                              onClick={() => abrirConcepto(p.conceptoId!)}
                              title="Abrir el concepto para agregar material"
                              className="rounded-full bg-marca-50 px-2.5 py-0.5 text-xs text-marca-700 transition hover:bg-marca-100"
                            >
                              {p.nombre}
                            </button>
                          </li>
                        ) : (
                          <li
                            key={`${c.clave}-${i}`}
                            className="rounded-full bg-slate-100 px-2.5 py-0.5 text-xs text-slate-600"
                          >
                            {p.nombre}
                          </li>
                        )
                      )}
                    </ul>
                  )}
                </div>
              </div>
            </li>
          )
        })}
      </ul>
    </div>
  )
}

function Tarjeta({
  valor,
  etiqueta,
  total
}: {
  valor: number
  etiqueta: string
  total?: number
}): JSX.Element {
  return (
    <div className="rounded-xl border border-slate-200 bg-white px-4 py-3">
      <p className="text-2xl font-semibold text-slate-900">
        {valor}
        {total !== undefined && <span className="text-base font-normal text-slate-400">/{total}</span>}
      </p>
      <p className="mt-0.5 text-xs text-slate-500">{etiqueta}</p>
    </div>
  )
}
