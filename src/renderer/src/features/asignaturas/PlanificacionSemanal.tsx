import { useCallback, useEffect, useMemo, useState } from 'react'
import type { AsignaturaDTO, ResumenTareaDTO, SemanaPlanDTO } from '@shared/dtos'
import { api } from '../../lib/api'
import { useConceptosStore } from '../../stores/conceptosStore'
import { useUiStore } from '../../stores/uiStore'
import { FormularioTarea } from '../tareas/FormularioTarea'

interface Props {
  asignatura: AsignaturaDTO
  onAbrirTarea?: (id: string) => void
}

/**
 * Planificación semanal POR PERÍODO: arrastra los temas a la semana en que se
 * tratan. Por cada semana ves el material (cobertura de sus conceptos) y las
 * tareas que puedes reutilizar o crear.
 */
export function PlanificacionSemanal({ asignatura, onAbrirTarea }: Props): JSX.Element {
  const conceptos = useConceptosStore((s) => s.lista)
  const materialPorId = useMemo(() => new Map(conceptos.map((c) => [c.id, c.totalRecursos])), [conceptos])
  const notificarError = useUiStore((s) => s.notificarError)

  const [periodo, setPeriodo] = useState(asignatura.periodos[0] ?? '')
  const planDe = useCallback(
    (p: string): SemanaPlanDTO[] =>
      (asignatura.planificaciones.find((x) => x.periodo === p)?.semanas ?? []).map((s) => ({
        numero: s.numero,
        temas: [...s.temas]
      })),
    [asignatura.planificaciones]
  )
  const [semanas, setSemanas] = useState<SemanaPlanDTO[]>(() => planDe(periodo))
  const [tareas, setTareas] = useState<ResumenTareaDTO[]>([])
  const [creandoEn, setCreandoEn] = useState<string[] | null>(null)
  const [sobre, setSobre] = useState<number | null>(null)

  const temas = useMemo(
    () =>
      asignatura.unidades.flatMap((u) =>
        u.temas.map((t) => ({ id: t.id, titulo: t.titulo, unidad: u.titulo, conceptos: t.conceptos }))
      ),
    [asignatura.unidades]
  )
  const temaPorId = useMemo(() => new Map(temas.map((t) => [t.id, t])), [temas])

  const cargarTareas = useCallback(async () => {
    try {
      setTareas(await api.listarTareasDeAsignatura(asignatura.id))
    } catch (e) {
      notificarError(e)
    }
  }, [asignatura.id, notificarError])
  useEffect(() => {
    void cargarTareas()
  }, [cargarTareas])

  useEffect(() => {
    setSemanas(planDe(periodo))
  }, [periodo, planDe])

  const persistir = (nuevas: SemanaPlanDTO[]): void => {
    setSemanas(nuevas)
    void api.guardarPlanificacion(asignatura.id, periodo, nuevas).catch((e) => notificarError(e))
  }
  const anadirSemana = (): void => {
    const max = semanas.reduce((m, s) => Math.max(m, s.numero), 0)
    persistir([...semanas, { numero: max + 1, temas: [] }])
  }
  const quitarSemana = (numero: number): void => persistir(semanas.filter((s) => s.numero !== numero))
  const anadirTema = (numero: number, temaId: string): void =>
    persistir(
      semanas.map((s) =>
        s.numero === numero && !s.temas.includes(temaId) ? { ...s, temas: [...s.temas, temaId] } : s
      )
    )
  const quitarTema = (numero: number, temaId: string): void =>
    persistir(semanas.map((s) => (s.numero === numero ? { ...s, temas: s.temas.filter((t) => t !== temaId) } : s)))

  const tareasDeSemana = (temaIds: string[]): ResumenTareaDTO[] =>
    tareas.filter((t) => t.temas.some((id) => temaIds.includes(id)))

  if (temas.length === 0) {
    return (
      <p className="rounded-xl border border-dashed border-slate-200 px-4 py-6 text-center text-sm text-slate-400">
        Esta asignatura aún no tiene temas para planificar.
      </p>
    )
  }

  return (
    <div>
      {/* Selector de período */}
      {asignatura.periodos.length > 1 && (
        <div className="mb-4 flex items-center gap-2">
          <span className="text-sm text-slate-500">Período:</span>
          {asignatura.periodos.map((p) => (
            <button
              key={p}
              onClick={() => setPeriodo(p)}
              className={`rounded-full border px-3 py-1 text-xs transition ${
                periodo === p
                  ? 'border-marca-300 bg-marca-50 text-marca-700'
                  : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
              }`}
            >
              {p}
            </button>
          ))}
        </div>
      )}

      {/* Temas disponibles (arrástralos a una semana) */}
      <div className="mb-5">
        <p className="mb-1.5 text-xs font-medium text-slate-500">
          Temas de la asignatura — arrástralos a la semana en que se tratan:
        </p>
        <div className="flex flex-wrap gap-1.5">
          {temas.map((t) => (
            <span
              key={t.id}
              draggable
              onDragStart={(e) => e.dataTransfer.setData('text/plain', t.id)}
              title={`${t.unidad} › ${t.titulo}`}
              className="cursor-grab rounded-full border border-slate-200 bg-white px-2.5 py-1 text-xs text-slate-700 active:cursor-grabbing"
            >
              ⠿ {t.titulo}
            </span>
          ))}
        </div>
      </div>

      {/* Semanas */}
      <div className="space-y-3">
        {semanas.map((s) => {
          const tareasSem = tareasDeSemana(s.temas)
          return (
            <div
              key={s.numero}
              onDragOver={(e) => {
                e.preventDefault()
                setSobre(s.numero)
              }}
              onDragLeave={() => setSobre((n) => (n === s.numero ? null : n))}
              onDrop={(e) => {
                e.preventDefault()
                setSobre(null)
                const id = e.dataTransfer.getData('text/plain')
                if (id) anadirTema(s.numero, id)
              }}
              className={`rounded-xl border p-3 transition ${
                sobre === s.numero ? 'border-marca-400 bg-marca-50/40' : 'border-slate-200 bg-white'
              }`}
            >
              <div className="mb-2 flex items-center justify-between">
                <h3 className="text-sm font-semibold text-slate-700">Semana {s.numero}</h3>
                <button
                  onClick={() => quitarSemana(s.numero)}
                  className="text-xs text-slate-400 hover:text-red-600"
                >
                  Quitar semana
                </button>
              </div>

              {s.temas.length === 0 ? (
                <p className="rounded-lg border border-dashed border-slate-200 px-3 py-4 text-center text-xs text-slate-400">
                  Arrastra aquí los temas de esta semana.
                </p>
              ) : (
                <ul className="space-y-2">
                  {s.temas.map((temaId) => {
                    const tema = temaPorId.get(temaId)
                    if (!tema) return null
                    return (
                      <li key={temaId} className="rounded-lg bg-slate-50 px-3 py-2">
                        <div className="flex items-center gap-2">
                          <span className="flex-1 truncate text-sm font-medium text-slate-800">
                            {tema.titulo}
                          </span>
                          <button
                            onClick={() => quitarTema(s.numero, temaId)}
                            className="text-slate-400 hover:text-red-600"
                            aria-label="Quitar tema de la semana"
                          >
                            ✕
                          </button>
                        </div>
                        {tema.conceptos.length > 0 && (
                          <div className="mt-1.5 flex flex-wrap gap-1.5">
                            {tema.conceptos.map((cid) => {
                              const tiene = (materialPorId.get(cid) ?? 0) > 0
                              return (
                                <span
                                  key={cid}
                                  title={tiene ? 'Con material' : 'Sin material'}
                                  className="flex items-center gap-1 rounded-full bg-white px-2 py-0.5 text-[11px] text-slate-600"
                                >
                                  <span
                                    className="h-1.5 w-1.5 rounded-full"
                                    style={{ backgroundColor: tiene ? '#10b981' : '#ef4444' }}
                                  />
                                  {conceptos.find((c) => c.id === cid)?.nombre ?? cid}
                                </span>
                              )
                            })}
                          </div>
                        )}
                      </li>
                    )
                  })}
                </ul>
              )}

              {/* Tareas de la semana (reutilizar) + crear */}
              <div className="mt-2 flex flex-wrap items-center gap-1.5 border-t border-slate-100 pt-2">
                <span className="text-[11px] font-medium uppercase tracking-wide text-slate-400">Tareas:</span>
                {tareasSem.length === 0 ? (
                  <span className="text-xs text-slate-400">Ninguna todavía.</span>
                ) : (
                  tareasSem.map((t) => (
                    <button
                      key={t.id}
                      onClick={() => onAbrirTarea?.(t.id)}
                      className="rounded-full bg-marca-50 px-2.5 py-0.5 text-xs text-marca-700 hover:bg-marca-100"
                    >
                      {t.titulo}
                    </button>
                  ))
                )}
                {s.temas.length > 0 && (
                  <button
                    onClick={() => setCreandoEn(s.temas)}
                    className="rounded-full border border-slate-200 px-2.5 py-0.5 text-xs text-slate-600 hover:bg-slate-50"
                  >
                    + Crear tarea
                  </button>
                )}
              </div>
            </div>
          )
        })}

        <button
          onClick={anadirSemana}
          className="w-full rounded-xl border border-dashed border-slate-300 py-2.5 text-sm text-slate-500 transition hover:border-marca-300 hover:text-marca-600"
        >
          + Añadir semana
        </button>
      </div>

      {creandoEn && (
        <FormularioTarea
          asignatura={asignatura}
          temasPreseleccionados={creandoEn}
          onCerrar={() => setCreandoEn(null)}
          onGuardada={() => {
            setCreandoEn(null)
            void cargarTareas()
          }}
        />
      )}
    </div>
  )
}
