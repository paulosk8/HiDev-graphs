import { useCallback, useEffect, useState } from 'react'
import type { FichaConceptoDTO, ResumenMencionDTO, ResumenTareaDTO } from '@shared/dtos'
import { Boton } from '../../components/Boton'
import { DialogoConfirmacion } from '../../components/DialogoConfirmacion'
import { api } from '../../lib/api'
import { useAsignaturasStore } from '../../stores/asignaturasStore'
import { useConceptosStore } from '../../stores/conceptosStore'
import { useVistazoStore } from '../../stores/vistazoStore'
import { useUiStore } from '../../stores/uiStore'
import {
  avisoDeEliminacion,
  useEliminacionStore
} from '../../stores/eliminacionStore'
import { FormularioConcepto } from './FormularioConcepto'
import { NotasConcepto } from './NotasConcepto'
import { ZonaMaterial } from './ZonaMaterial'
import { FichaTarea } from '../tareas/FichaTarea'

interface Props {
  conceptoId: string
}

export function FichaConcepto({ conceptoId }: Props): JSX.Element {
  const modoEliminacion = useEliminacionStore((s) => s.modo)
  const [ficha, setFicha] = useState<FichaConceptoDTO | null>(null)
  const [cargando, setCargando] = useState(true)
  const [editando, setEditando] = useState(false)
  const [confirmando, setConfirmando] = useState(false)
  const [tareas, setTareas] = useState<ResumenTareaDTO[]>([])
  const [tareaAbierta, setTareaAbierta] = useState<string | null>(null)
  // "Se menciona en": lo resuelve el proceso principal escaneando las notas del
  // vault (el enlace vive dentro del texto, no en el índice).
  const [menciones, setMenciones] = useState<ResumenMencionDTO[]>([])

  const volver = useUiStore((s) => s.seleccionarConcepto)
  const fijarEtiqueta = useUiStore((s) => s.filtrarPorEtiqueta)

  /** Pulsar una etiqueta sale de la ficha y deja el listado ya filtrado por ella. */
  const filtrarPorEtiqueta = (etiqueta: string): void => {
    fijarEtiqueta(etiqueta)
    volver(null)
  }
  const notificarError = useUiStore((s) => s.notificarError)
  const eliminar = useConceptosStore((s) => s.eliminar)
  const asignaturas = useAsignaturasStore((s) => s.lista)
  const abrirVistazo = useVistazoStore((s) => s.abrir)

  const cargarTareas = useCallback(async () => {
    try {
      setTareas(await api.listarTareasDeConcepto(conceptoId))
    } catch {
      /* no bloquea la ficha */
    }
  }, [conceptoId])

  useEffect(() => {
    void cargarTareas()
  }, [cargarTareas])

  useEffect(() => {
    let vivo = true
    void api
      .obtenerMenciones(conceptoId)
      .then((m) => vivo && setMenciones(m))
      .catch(() => vivo && setMenciones([]))
    return () => {
      vivo = false
    }
  }, [conceptoId])

  const cargar = useCallback(async () => {
    setCargando(true)
    try {
      setFicha(await api.obtenerFichaConcepto(conceptoId))
    } catch (error) {
      notificarError(error)
      volver(null)
    } finally {
      setCargando(false)
    }
  }, [conceptoId, notificarError, volver])

  useEffect(() => {
    void cargar()
  }, [cargar])

  const confirmarEliminar = async (): Promise<void> => {
    if (!ficha) return
    const ok = await eliminar(conceptoId, ficha.concepto.nombre)
    if (ok) volver(null)
  }

  if (cargando || !ficha) {
    return <p className="px-8 py-10 text-sm text-slate-400">Cargando…</p>
  }

  const { concepto, usos } = ficha

  return (
    <div className="mx-auto max-w-3xl px-8 py-8">
      <button
        onClick={() => volver(null)}
        className="mb-5 text-sm text-slate-500 transition hover:text-slate-800"
      >
        ← Conceptos
      </button>

      <header className="mb-6 flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">{concepto.nombre}</h1>
          {concepto.descripcion && (
            <p className="mt-2 max-w-prose text-sm text-slate-600">{concepto.descripcion}</p>
          )}
          {concepto.etiquetas.length > 0 && (
            <div className="mt-3 flex flex-wrap gap-1.5">
              {concepto.etiquetas.map((e) => (
                <button
                  key={e}
                  onClick={() => filtrarPorEtiqueta(e)}
                  title={`Ver todo lo etiquetado como «${e}»`}
                  className="rounded-full bg-marca-50 px-2.5 py-0.5 text-xs font-medium text-marca-700 transition hover:bg-marca-100"
                >
                  {e}
                </button>
              ))}
            </div>
          )}
        </div>
        <div className="flex shrink-0 gap-2">
          <Boton variante="secundario" onClick={() => setEditando(true)}>
            Editar
          </Boton>
          <Boton variante="fantasma" onClick={() => setConfirmando(true)}>
            Eliminar
          </Boton>
        </div>
      </header>

      {/* Material */}
      <section className="mb-8">
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-400">
          Material
        </h2>
        <ZonaMaterial
          conceptoId={concepto.id}
          recursos={concepto.recursos}
          onActualizado={(actualizado) =>
            setFicha((f) => (f ? { ...f, concepto: actualizado } : f))
          }
        />
      </section>

      {/* Notas y observaciones */}
      <NotasConcepto concepto={concepto} onGuardado={() => void cargar()} />

      {/* Se usa en */}
      <section>
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-400">
          Se usa en
        </h2>
        {usos.length === 0 ? (
          <p className="rounded-xl border border-dashed border-slate-200 px-4 py-6 text-center text-sm text-slate-400">
            Este concepto todavía no se usa en ninguna asignatura.
          </p>
        ) : (
          <ul className="space-y-2">
            {usos.map((uso) => (
              <li
                key={`${uso.asignaturaId}-${uso.temaId}`}
                className="rounded-lg border border-slate-200 px-4 py-2.5 text-sm text-slate-700"
              >
                <span className="font-medium">
                  {uso.asignatura} · {uso.periodos.join(', ')}
                </span>
                <span className="text-slate-400"> › {uso.unidad} › </span>
                <span>{uso.tema}</span>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* Se menciona en (retroenlaces desde las notas de otros conceptos) */}
      {menciones.length > 0 && (
        <section className="mt-8">
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-400">
            Se menciona en
          </h2>
          <ul className="space-y-2">
            {menciones.map((c) => (
              <li key={c.id}>
                <button
                  onClick={() => abrirVistazo(c.id)}
                  className="flex w-full items-center gap-2 rounded-lg border border-slate-200 px-4 py-2.5 text-left text-sm transition hover:border-marca-300 hover:shadow-sm"
                >
                  <span className="flex-1 truncate font-medium text-slate-700">{c.nombre}</span>
                  <span className="text-xs text-slate-400">Ver</span>
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* Tareas basadas en este concepto */}
      {tareas.length > 0 && (
        <section className="mt-8">
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-400">
            Tareas basadas en este concepto
          </h2>
          <ul className="space-y-2">
            {tareas.map((t) => {
              const asig = asignaturas.find((a) => a.id === t.asignaturaId)
              return (
                <li key={t.id}>
                  <button
                    onClick={() => setTareaAbierta(t.id)}
                    className="flex w-full items-center gap-2 rounded-lg border border-slate-200 px-4 py-2.5 text-left text-sm transition hover:border-marca-300 hover:shadow-sm"
                  >
                    <span className="flex-1 truncate font-medium text-slate-700">{t.titulo}</span>
                    {asig && (
                      <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-500">
                        {asig.nombre} · {asig.periodos.join(', ')}
                      </span>
                    )}
                  </button>
                </li>
              )
            })}
          </ul>
        </section>
      )}

      {tareaAbierta && (
        <FichaTarea
          tareaId={tareaAbierta}
          onCerrar={() => setTareaAbierta(null)}
          onCambiada={() => void cargarTareas()}
        />
      )}

      {editando && (
        <FormularioConcepto
          conceptoInicial={{
            id: concepto.id,
            nombre: concepto.nombre,
            descripcion: concepto.descripcion,
            etiquetas: concepto.etiquetas
          }}
          onCerrar={() => setEditando(false)}
          onGuardado={() => void cargar()}
        />
      )}

      {confirmando && (
        <DialogoConfirmacion
          titulo={`¿Eliminar «${concepto.nombre}»?`}
          mensaje={`Se eliminará el concepto y todo su material. ${avisoDeEliminacion(modoEliminacion)}`}
          onConfirmar={confirmarEliminar}
          onCancelar={() => setConfirmando(false)}
        />
      )}
    </div>
  )
}
