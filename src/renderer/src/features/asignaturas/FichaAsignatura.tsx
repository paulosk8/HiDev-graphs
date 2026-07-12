import { useCallback, useEffect, useMemo, useState } from 'react'
import type { AsignaturaDTO } from '@shared/dtos'
import { Boton } from '../../components/Boton'
import { DialogoConfirmacion } from '../../components/DialogoConfirmacion'
import { api } from '../../lib/api'
import { useAsignaturasStore } from '../../stores/asignaturasStore'
import { useConceptosStore } from '../../stores/conceptosStore'
import { useUiStore } from '../../stores/uiStore'
import { BuscadorConceptos } from '../vinculos/BuscadorConceptos'

interface Props {
  asignaturaId: string
}

export function FichaAsignatura({ asignaturaId }: Props): JSX.Element {
  const [asignatura, setAsignatura] = useState<AsignaturaDTO | null>(null)
  const [cargando, setCargando] = useState(true)
  const [confirmando, setConfirmando] = useState(false)
  const [temaBuscador, setTemaBuscador] = useState<string | null>(null)

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

  return (
    <div className="mx-auto max-w-3xl px-8 py-8">
      <button
        onClick={() => volver(null)}
        className="mb-5 text-sm text-slate-500 transition hover:text-slate-800"
      >
        ← Mis asignaturas
      </button>

      <header className="mb-6 flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">
            {asignatura.nombre}{' '}
            <span className="text-lg font-medium text-marca-600">{asignatura.periodo}</span>
          </h1>
        </div>
        <Boton variante="fantasma" onClick={() => setConfirmando(true)}>
          Eliminar
        </Boton>
      </header>

      {/* Componentes */}
      {asignatura.componentes.length > 0 && (
        <section className="mb-8">
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-400">
            Componentes de aprendizaje
          </h2>
          <ul className="flex flex-wrap gap-2">
            {asignatura.componentes.map((c) => (
              <li
                key={c.clave}
                className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-sm"
                title={c.nombre}
              >
                <span className="font-semibold text-slate-700">{c.clave}</span>
                <span className="text-slate-500"> · {c.nombre}</span>
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* Contenido */}
      <section>
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-400">
          Contenido
        </h2>
        <div className="space-y-4">
          {asignatura.unidades.map((unidad) => (
            <div key={unidad.id} className="rounded-xl border border-slate-200 p-4">
              <h3 className="mb-2 font-medium text-slate-800">
                <span className="text-slate-400">Unidad {unidad.orden}. </span>
                {unidad.titulo}
              </h3>
              {unidad.temas.length === 0 ? (
                <p className="text-sm text-slate-400">Sin temas.</p>
              ) : (
                <ul className="space-y-3">
                  {unidad.temas.map((tema) => (
                    <li key={tema.id} className="text-sm">
                      <div className="flex items-center gap-2 text-slate-700">
                        <span className="text-slate-400">{tema.orden}.</span>
                        <span className="font-medium">{tema.titulo}</span>
                        {tema.semana !== null && (
                          <span className="rounded bg-slate-100 px-1.5 py-0.5 text-xs text-slate-500">
                            Semana {tema.semana}
                          </span>
                        )}
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
                    </li>
                  ))}
                </ul>
              )}
            </div>
          ))}
        </div>
      </section>

      {confirmando && (
        <DialogoConfirmacion
          titulo={`¿Eliminar «${asignatura.nombre} ${asignatura.periodo}»?`}
          mensaje="Se eliminará la asignatura y su planificación. Tus conceptos y su material NO se borran."
          onConfirmar={confirmarEliminar}
          onCancelar={() => setConfirmando(false)}
        />
      )}
    </div>
  )
}
