import { useCallback, useEffect, useMemo, useState } from 'react'
import type { AsignaturaDTO, ResumenTareaDTO } from '@shared/dtos'
import { Boton } from '../../components/Boton'
import { DialogoConfirmacion } from '../../components/DialogoConfirmacion'
import { api } from '../../lib/api'
import { useAsignaturasStore } from '../../stores/asignaturasStore'
import { useConceptosStore } from '../../stores/conceptosStore'
import { useUiStore } from '../../stores/uiStore'
import { BuscadorConceptos } from '../vinculos/BuscadorConceptos'
import { FormularioTarea } from '../tareas/FormularioTarea'
import { FichaTarea } from '../tareas/FichaTarea'
import { PlanificacionSemanal } from './PlanificacionSemanal'
import { AsistenteAsignatura } from './AsistenteAsignatura'
import { SaludAsignatura } from './SaludAsignatura'

interface Props {
  asignaturaId: string
}

export function FichaAsignatura({ asignaturaId }: Props): JSX.Element {
  const [asignatura, setAsignatura] = useState<AsignaturaDTO | null>(null)
  const [cargando, setCargando] = useState(true)
  const [confirmando, setConfirmando] = useState(false)
  const [editando, setEditando] = useState(false)
  const [temaBuscador, setTemaBuscador] = useState<string | null>(null)
  const [periodoNuevo, setPeriodoNuevo] = useState('')
  const [tareas, setTareas] = useState<ResumenTareaDTO[]>([])
  const [creandoTarea, setCreandoTarea] = useState(false)
  const [tareaAbierta, setTareaAbierta] = useState<string | null>(null)
  const [vista, setVista] = useState<'contenido' | 'plan' | 'salud'>('contenido')

  const cargarTareas = useCallback(async () => {
    try {
      setTareas(await api.listarTareasDeAsignatura(asignaturaId))
    } catch {
      /* los errores de carga de tareas no bloquean la ficha */
    }
  }, [asignaturaId])

  useEffect(() => {
    void cargarTareas()
  }, [cargarTareas])

  const volver = useUiStore((s) => s.seleccionarAsignatura)
  const notificarError = useUiStore((s) => s.notificarError)
  const notificar = useUiStore((s) => s.notificar)
  const eliminar = useAsignaturasStore((s) => s.eliminar)

  const conceptos = useConceptosStore((s) => s.lista)
  const nombrePorId = useMemo(
    () => new Map(conceptos.map((c) => [c.id, c.nombre])),
    [conceptos]
  )

  const vincular = async (temaId: string, conceptoId: string): Promise<void> => {
    try {
      setAsignatura(await api.vincularTemaConcepto(asignaturaId, temaId, conceptoId))
      setTemaBuscador(null)
      notificar({ tipo: 'exito', mensaje: 'Concepto vinculado al tema.' })
    } catch (error) {
      notificarError(error)
    }
  }

  const desvincular = async (temaId: string, conceptoId: string): Promise<void> => {
    try {
      setAsignatura(await api.desvincularTemaConcepto(asignaturaId, temaId, conceptoId))
    } catch (error) {
      notificarError(error)
    }
  }

  const agregarPeriodo = async (): Promise<void> => {
    const p = periodoNuevo.trim()
    if (!p) return
    try {
      setAsignatura(await api.agregarPeriodoAsignatura(asignaturaId, p))
      setPeriodoNuevo('')
    } catch (error) {
      notificarError(error)
    }
  }

  const quitarPeriodo = async (periodo: string): Promise<void> => {
    try {
      setAsignatura(await api.quitarPeriodoAsignatura(asignaturaId, periodo))
    } catch (error) {
      notificarError(error)
    }
  }

  const cargar = useCallback(async () => {
    setCargando(true)
    try {
      setAsignatura(await api.obtenerAsignatura(asignaturaId))
    } catch (error) {
      notificarError(error)
      volver(null)
    } finally {
      setCargando(false)
    }
  }, [asignaturaId, notificarError, volver])

  useEffect(() => {
    void cargar()
  }, [cargar])

  const confirmarEliminar = async (): Promise<void> => {
    if (!asignatura) return
    const ok = await eliminar(asignaturaId, asignatura.nombre)
    if (ok) volver(null)
  }

  if (cargando || !asignatura) {
    return <p className="px-8 py-10 text-sm text-slate-400">Cargando…</p>
  }

  const asig = asignatura
  const esAprendizaje = asig.tipo === 'aprendizaje'
  const gruposTareas = [
    ...asig.componentes.map((c) => ({
      etiqueta: `${c.clave} · ${c.nombre}`,
      items: tareas.filter((t) => t.componente === c.clave)
    })),
    { etiqueta: 'General', items: tareas.filter((t) => !t.componente) }
  ].filter((g) => g.items.length > 0)

  return (
    <div className="mx-auto max-w-3xl px-8 py-8">
      <button
        onClick={() => volver(null)}
        className="mb-5 text-sm text-slate-500 transition hover:text-slate-800"
      >
        ← Volver
      </button>

      <header className="mb-4 flex items-start justify-between gap-4">
        <h1 className="flex items-center gap-2 text-2xl font-semibold text-slate-900">
          {asignatura.nombre}
          {esAprendizaje && (
            <span className="rounded-full bg-sky-100 px-2.5 py-0.5 text-xs font-medium text-sky-700">
              Aprendizaje
            </span>
          )}
        </h1>
        <div className="flex shrink-0 gap-2">
          <Boton variante="secundario" onClick={() => setEditando(true)}>
            Editar
          </Boton>
          <Boton variante="fantasma" onClick={() => setConfirmando(true)}>
            Eliminar
          </Boton>
        </div>
      </header>

      {/* Períodos en que se dicta (solo docencia) */}
      {!esAprendizaje && (
      <section className="mb-8">
        <div className="flex flex-wrap items-center gap-2">
          {asignatura.periodos.map((p) => (
            <span
              key={p}
              className="flex items-center gap-1 rounded-full bg-marca-50 py-1 pl-3 pr-2 text-sm font-medium text-marca-700"
            >
              {p}
              {asignatura.periodos.length > 1 && (
                <button
                  onClick={() => void quitarPeriodo(p)}
                  className="text-marca-400 hover:text-red-600"
                  aria-label={`Quitar período ${p}`}
                >
                  ✕
                </button>
              )}
            </span>
          ))}
          <span className="inline-flex items-center gap-1">
            <input
              value={periodoNuevo}
              onChange={(e) => setPeriodoNuevo(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault()
                  void agregarPeriodo()
                }
              }}
              placeholder="Añadir período"
              className="w-32 rounded-full border border-dashed border-slate-300 px-3 py-1 text-sm outline-none focus:border-marca-400"
            />
          </span>
        </div>
        <p className="mt-1.5 text-xs text-slate-400">
          La misma asignatura se dicta en estos períodos, sin duplicar su contenido.
        </p>
      </section>
      )}


      {/* Contenido / Planificación semanal / Estado */}
      <section>
        <div className="mb-4 flex gap-5 border-b border-slate-100 text-sm">
          {(
            [
              { clave: 'contenido', etiqueta: 'Contenido' },
              ...(!esAprendizaje ? [{ clave: 'plan', etiqueta: 'Planificación semanal' }] : []),
              { clave: 'salud', etiqueta: 'Estado' }
            ] as { clave: 'contenido' | 'plan' | 'salud'; etiqueta: string }[]
          ).map((t) => (
            <button
              key={t.clave}
              onClick={() => setVista(t.clave)}
              className={`-mb-px border-b-2 pb-2 font-medium transition ${
                vista === t.clave
                  ? 'border-marca-600 text-marca-700'
                  : 'border-transparent text-slate-400 hover:text-slate-600'
              }`}
            >
              {t.etiqueta}
            </button>
          ))}
        </div>

        {vista === 'salud' && <SaludAsignatura asignatura={asig} tareas={tareas} />}
        {vista === 'plan' && !esAprendizaje && (
          <PlanificacionSemanal asignatura={asig} onAbrirTarea={setTareaAbierta} />
        )}
        {vista === 'contenido' && (
        <div className="space-y-4">
          {asignatura.unidades.map((unidad) => (
            <div key={unidad.id} className="rounded-xl border border-slate-200 p-4">
              <h3 className="mb-2 font-medium text-slate-800">
                <span className="text-slate-400">
                  {esAprendizaje ? 'Bloque' : 'Tema'} {unidad.orden}.{' '}
                </span>
                {unidad.titulo}
              </h3>
              {unidad.temas.length === 0 ? (
                <p className="text-sm text-slate-400">{esAprendizaje ? 'Sin temas.' : 'Sin subtemas.'}</p>
              ) : (
                <ul className="space-y-3">
                  {unidad.temas.map((tema) => (
                    <li key={tema.id} className="text-sm">
                      <div className="flex items-center gap-2 text-slate-700">
                        <span className="text-slate-400">{tema.orden}.</span>
                        <span className="font-medium">{tema.titulo}</span>
                      </div>

                      {/* Conceptos vinculados (puente) */}
                      <div className="mt-1.5 flex flex-wrap items-center gap-1.5 pl-5">
                        {tema.conceptos.map((conceptoId) => (
                          <span
                            key={conceptoId}
                            className="flex items-center gap-1 rounded-full bg-marca-50 py-0.5 pl-2.5 pr-1 text-xs text-marca-700"
                          >
                            {nombrePorId.get(conceptoId) ?? conceptoId}
                            <button
                              onClick={() => void desvincular(tema.id, conceptoId)}
                              className="text-marca-400 hover:text-red-600"
                              aria-label="Quitar concepto"
                            >
                              ✕
                            </button>
                          </span>
                        ))}

                        <span className="relative">
                          <button
                            onClick={() =>
                              setTemaBuscador((actual) => (actual === tema.id ? null : tema.id))
                            }
                            className="rounded-full border border-dashed border-slate-300 px-2.5 py-0.5 text-xs text-slate-500 hover:border-marca-300 hover:text-marca-700"
                          >
                            + Vincular concepto
                          </button>
                          {temaBuscador === tema.id && (
                            <BuscadorConceptos
                              excluir={tema.conceptos}
                              onSeleccionar={(conceptoId) => vincular(tema.id, conceptoId)}
                              onCerrar={() => setTemaBuscador(null)}
                            />
                          )}
                        </span>
                      </div>

                      {/* Tareas asociadas a este tema */}
                      {tareas.filter((t) => t.temas.includes(tema.id)).length > 0 && (
                        <div className="mt-1.5 flex flex-wrap items-center gap-1.5 pl-5">
                          <span className="text-[11px] font-medium uppercase tracking-wide text-slate-400">
                            {esAprendizaje ? 'Prácticas:' : 'Tareas:'}
                          </span>
                          {tareas
                            .filter((t) => t.temas.includes(tema.id))
                            .map((t) => (
                              <button
                                key={t.id}
                                onClick={() => setTareaAbierta(t.id)}
                                title="Abrir la tarea"
                                className="rounded-full bg-amber-50 px-2.5 py-0.5 text-xs text-amber-800 hover:bg-amber-100"
                              >
                                {t.titulo}
                              </button>
                            ))}
                        </div>
                      )}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          ))}
        </div>
        )}
      </section>

      {/* Tareas */}
      <section className="mt-8">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-400">
            {esAprendizaje ? 'Prácticas' : 'Tareas'}
          </h2>
          <Boton variante="secundario" onClick={() => setCreandoTarea(true)}>
            {esAprendizaje ? '+ Nueva práctica' : '+ Nueva tarea'}
          </Boton>
        </div>

        {/* Componentes de aprendizaje: aquí, junto a las tareas que clasifican. */}
        {asignatura.componentes.length > 0 && (
          <div className="mb-4 rounded-xl border border-slate-100 bg-slate-50 px-3 py-2.5">
            <p className="mb-1.5 text-[11px] font-medium uppercase tracking-wide text-slate-400">
              Componentes de aprendizaje
            </p>
            <ul className="flex flex-wrap gap-1.5">
              {asignatura.componentes.map((c) => (
                <li
                  key={c.clave}
                  className="rounded-full border border-slate-200 bg-white px-2.5 py-0.5 text-xs"
                  title={c.nombre}
                >
                  <span className="font-semibold text-slate-700">{c.clave}</span>
                  <span className="text-slate-500"> · {c.nombre}</span>
                </li>
              ))}
            </ul>
            <p className="mt-1.5 text-[11px] text-slate-400">
              Las tareas de abajo se agrupan por estos componentes.
            </p>
          </div>
        )}

        {tareas.length === 0 ? (
          <p className="rounded-xl border border-dashed border-slate-200 px-4 py-6 text-center text-sm text-slate-400">
            {esAprendizaje
              ? 'Aún no hay prácticas. Crea una para poner en práctica lo que aprendes.'
              : 'Aún no hay tareas. Crea una para un tema y, opcionalmente, un componente.'}
          </p>
        ) : (
          <div className="space-y-4">
            {gruposTareas.map((grupo) => (
              <div key={grupo.etiqueta}>
                <p className="mb-1.5 text-xs font-semibold text-slate-400">{grupo.etiqueta}</p>
                <ul className="space-y-1.5">
                  {grupo.items.map((t) => (
                    <li key={t.id}>
                      <button
                        onClick={() => setTareaAbierta(t.id)}
                        className="flex w-full items-center gap-2 rounded-lg border border-slate-200 px-3 py-2 text-left text-sm transition hover:border-marca-300 hover:shadow-sm"
                      >
                        <span className="flex-1 truncate font-medium text-slate-700">{t.titulo}</span>
                        <span className="text-xs text-slate-400">
                          {t.temas.length} {t.temas.length === 1 ? 'tema' : 'temas'}
                          {t.totalAdjuntos > 0 ? ` · ${t.totalAdjuntos} adj.` : ''}
                        </span>
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        )}
      </section>

      {creandoTarea && (
        <FormularioTarea
          asignatura={asig}
          onCerrar={() => setCreandoTarea(false)}
          onGuardada={(t) => {
            void cargarTareas()
            setTareaAbierta(t.id)
          }}
        />
      )}

      {tareaAbierta && (
        <FichaTarea
          tareaId={tareaAbierta}
          onCerrar={() => setTareaAbierta(null)}
          onCambiada={() => void cargarTareas()}
        />
      )}

      {editando && (
        <AsistenteAsignatura
          asignaturaExistente={asig}
          onCerrar={() => setEditando(false)}
          onCreada={() => {
            void cargar()
            void cargarTareas()
          }}
        />
      )}

      {confirmando && (
        <DialogoConfirmacion
          titulo={`¿Eliminar «${asignatura.nombre}»?`}
          mensaje="Se eliminará la asignatura y su planificación. Tus conceptos y su material NO se borran."
          onConfirmar={confirmarEliminar}
          onCancelar={() => setConfirmando(false)}
        />
      )}
    </div>
  )
}
