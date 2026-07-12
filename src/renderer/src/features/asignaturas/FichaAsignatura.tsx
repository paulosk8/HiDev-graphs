import { useCallback, useEffect, useState } from 'react'
import type { AsignaturaDTO } from '@shared/dtos'
import { Boton } from '../../components/Boton'
import { DialogoConfirmacion } from '../../components/DialogoConfirmacion'
import { api } from '../../lib/api'
import { useAsignaturasStore } from '../../stores/asignaturasStore'
import { useUiStore } from '../../stores/uiStore'

interface Props {
  asignaturaId: string
}

export function FichaAsignatura({ asignaturaId }: Props): JSX.Element {
  const [asignatura, setAsignatura] = useState<AsignaturaDTO | null>(null)
  const [cargando, setCargando] = useState(true)
  const [confirmando, setConfirmando] = useState(false)

  const volver = useUiStore((s) => s.seleccionarAsignatura)
  const notificarError = useUiStore((s) => s.notificarError)
  const eliminar = useAsignaturasStore((s) => s.eliminar)

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
                <ul className="space-y-1.5">
                  {unidad.temas.map((tema) => (
                    <li
                      key={tema.id}
                      className="flex items-center gap-2 text-sm text-slate-700"
                    >
                      <span className="text-slate-400">{tema.orden}.</span>
                      <span>{tema.titulo}</span>
                      {tema.semana !== null && (
                        <span className="rounded bg-slate-100 px-1.5 py-0.5 text-xs text-slate-500">
                          Semana {tema.semana}
                        </span>
                      )}
                      {tema.conceptos.length > 0 && (
                        <span className="rounded bg-marca-50 px-1.5 py-0.5 text-xs text-marca-700">
                          {tema.conceptos.length}{' '}
                          {tema.conceptos.length === 1 ? 'concepto' : 'conceptos'}
                        </span>
                      )}
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
