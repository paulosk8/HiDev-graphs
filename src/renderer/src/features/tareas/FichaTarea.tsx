import { useCallback, useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { marked } from 'marked'
import type { AsignaturaDTO, CruceDTO, RecursoDTO, TareaDTO } from '@shared/dtos'
import { Boton } from '../../components/Boton'
import { DialogoConfirmacion } from '../../components/DialogoConfirmacion'
import { api } from '../../lib/api'
import { useTareasStore } from '../../stores/tareasStore'
import { useUiStore } from '../../stores/uiStore'
import { FormularioTarea } from './FormularioTarea'
import { DuplicarTareaDialog } from './DuplicarTareaDialog'

interface Props {
  tareaId: string
  onCerrar: () => void
  onCambiada: () => void
}

export function FichaTarea({ tareaId, onCerrar, onCambiada }: Props): JSX.Element {
  const [tarea, setTarea] = useState<TareaDTO | null>(null)
  const [asignatura, setAsignatura] = useState<AsignaturaDTO | null>(null)
  const [editando, setEditando] = useState(false)
  const [confirmando, setConfirmando] = useState(false)
  const [adjEliminar, setAdjEliminar] = useState<RecursoDTO | null>(null)
  const [cruces, setCruces] = useState<CruceDTO[]>([])
  const [duplicando, setDuplicando] = useState<{
    asignaturaIdInicial?: string
    temasSugeridos?: string[]
  } | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  const notificarError = useUiStore((s) => s.notificarError)
  const { eliminar, agregarAdjunto, eliminarAdjunto } = useTareasStore.getState()

  const cargar = useCallback(async () => {
    try {
      const t = await api.obtenerTarea(tareaId)
      setTarea(t)
      setAsignatura(await api.obtenerAsignatura(t.asignaturaId))
    } catch (error) {
      notificarError(error)
      onCerrar()
    }
  }, [tareaId, notificarError, onCerrar])

  const cargarCruces = useCallback(async () => {
    try {
      setCruces(await api.crucesDeTarea(tareaId))
    } catch {
      setCruces([])
    }
  }, [tareaId])

  useEffect(() => {
    void cargar()
    void cargarCruces()
  }, [cargar, cargarCruces])

  useEffect(() => {
    const alPulsar = (e: KeyboardEvent): void => {
      if (e.key === 'Escape' && !editando) onCerrar()
    }
    window.addEventListener('keydown', alPulsar)
    return () => window.removeEventListener('keydown', alPulsar)
  }, [onCerrar, editando])

  if (!tarea || !asignatura) return <></>

  const nombreTema = new Map(
    asignatura.unidades.flatMap((u) => u.temas.map((t) => [t.id, t.titulo] as const))
  )
  const nombreComponente = asignatura.componentes.find((c) => c.clave === tarea.componente)?.nombre

  const crucesPorAsig = new Map<
    string,
    { asignatura: string; periodos: string[]; temas: { temaId: string; tema: string; unidad: string }[] }
  >()
  for (const c of cruces) {
    const g = crucesPorAsig.get(c.asignaturaId) ?? {
      asignatura: c.asignatura,
      periodos: c.periodos,
      temas: []
    }
    if (!g.temas.some((t) => t.temaId === c.temaId)) {
      g.temas.push({ temaId: c.temaId, tema: c.tema, unidad: c.unidad })
    }
    crucesPorAsig.set(c.asignaturaId, g)
  }

  const descargar = (): void => {
    const blob = new Blob([tarea.instrucciones], { type: 'text/markdown;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${tarea.titulo}.md`
    a.click()
    URL.revokeObjectURL(url)
  }

  const procesarAdjuntos = async (archivos: FileList | null): Promise<void> => {
    if (!archivos || archivos.length === 0) return
    const rutas = Array.from(archivos).map((a) => api.rutaDeArchivo(a))
    const t = await agregarAdjunto(tarea.id, rutas)
    if (t) setTarea(t)
  }

  const confirmarEliminar = async (): Promise<void> => {
    const ok = await eliminar(tarea.id, tarea.titulo)
    if (ok) {
      onCambiada()
      onCerrar()
    }
  }

  const quitarAdjunto = async (): Promise<void> => {
    if (!adjEliminar) return
    const t = await eliminarAdjunto(tarea.id, adjEliminar.id)
    setAdjEliminar(null)
    if (t) setTarea(t)
  }

  return createPortal(
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-6"
      onMouseDown={onCerrar}
    >
      <div
        className="flex h-[86vh] w-full max-w-3xl flex-col overflow-hidden rounded-xl bg-white shadow-2xl"
        onMouseDown={(e) => e.stopPropagation()}
      >
        <header className="flex items-start gap-3 border-b border-slate-200 px-6 py-4">
          <div className="min-w-0 flex-1">
            <h2 className="text-lg font-semibold text-slate-900">{tarea.titulo}</h2>
            <div className="mt-1 flex flex-wrap items-center gap-1.5">
              {tarea.componente && (
                <span className="rounded-full bg-marca-50 px-2 py-0.5 text-xs text-marca-700">
                  {tarea.componente}
                  {nombreComponente ? ` · ${nombreComponente}` : ''}
                </span>
              )}
              {tarea.temas.map((id) => (
                <span key={id} className="rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-600">
                  {nombreTema.get(id) ?? id}
                </span>
              ))}
            </div>
          </div>
          <Boton variante="secundario" onClick={() => setDuplicando({})}>
            Duplicar
          </Boton>
          <Boton variante="secundario" onClick={() => setEditando(true)}>
            Editar
          </Boton>
          <Boton variante="fantasma" onClick={() => setConfirmando(true)}>
            Eliminar
          </Boton>
          <button onClick={onCerrar} className="ml-1 text-slate-400 hover:text-slate-700" aria-label="Cerrar">
            ✕
          </button>
        </header>

        <div className="min-h-0 flex-1 overflow-auto px-6 py-5">
          {/* Instrucciones */}
          <div className="mb-4 flex items-center justify-between">
            <h3 className="text-sm font-semibold uppercase tracking-wide text-slate-400">
              Instrucciones
            </h3>
            <Boton variante="secundario" onClick={descargar}>
              ⬇ Descargar .md
            </Boton>
          </div>
          {tarea.instrucciones.trim() ? (
            <div
              className="markdown-preview"
              dangerouslySetInnerHTML={{ __html: marked.parse(tarea.instrucciones) as string }}
            />
          ) : (
            <p className="text-sm text-slate-400">Esta tarea todavía no tiene instrucciones.</p>
          )}

          {/* Adjuntos */}
          <div className="mt-8">
            <div className="mb-2 flex items-center justify-between">
              <h3 className="text-sm font-semibold uppercase tracking-wide text-slate-400">
                Recursos de la tarea
              </h3>
              <input
                ref={inputRef}
                type="file"
                multiple
                accept=".pdf,.pptx,.docx,.md,.html,.xml"
                className="hidden"
                onChange={(e) => {
                  void procesarAdjuntos(e.target.files)
                  e.target.value = ''
                }}
              />
              <Boton variante="fantasma" onClick={() => inputRef.current?.click()}>
                + Agregar adjunto
              </Boton>
            </div>
            {tarea.recursos.length === 0 ? (
              <p className="rounded-lg border border-dashed border-slate-200 px-4 py-4 text-center text-sm text-slate-400">
                Sin adjuntos. Agrega archivos que el estudiante necesite para desarrollar la tarea.
              </p>
            ) : (
              <ul className="divide-y divide-slate-100 rounded-xl border border-slate-200">
                {tarea.recursos.map((r) => (
                  <li key={r.id} className="flex items-center gap-3 px-4 py-2.5">
                    <span className="rounded bg-slate-100 px-2 py-0.5 text-xs font-semibold uppercase text-slate-500">
                      {r.formato}
                    </span>
                    <span className="flex-1 truncate text-sm text-slate-700">{r.nombre}</span>
                    <button
                      onClick={() =>
                        void api.abrirAdjuntoTarea(tarea.id, r.archivo).catch((e) => notificarError(e))
                      }
                      className="text-xs text-slate-500 hover:text-marca-700"
                    >
                      Abrir
                    </button>
                    <button
                      onClick={() => setAdjEliminar(r)}
                      className="text-slate-400 hover:text-red-600"
                      aria-label={`Quitar ${r.nombre}`}
                    >
                      ✕
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>

          {/* Cruces con otras asignaturas (vía conceptos compartidos) */}
          {crucesPorAsig.size > 0 && (
            <div className="mt-8">
              <h3 className="mb-2 text-sm font-semibold uppercase tracking-wide text-slate-400">
                Este contenido también se usa en
              </h3>
              <div className="space-y-2">
                {[...crucesPorAsig.entries()].map(([id, g]) => (
                  <div
                    key={id}
                    className="flex items-start gap-3 rounded-lg border border-slate-200 px-4 py-3"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium text-slate-700">
                        {g.asignatura} · {g.periodos.join(', ')}
                      </p>
                      <p className="mt-0.5 text-xs text-slate-500">
                        {g.temas.map((t) => `${t.unidad} › ${t.tema}`).join(' · ')}
                      </p>
                    </div>
                    <Boton
                      variante="secundario"
                      onClick={() =>
                        setDuplicando({
                          asignaturaIdInicial: id,
                          temasSugeridos: g.temas.map((t) => t.temaId)
                        })
                      }
                    >
                      Duplicar aquí
                    </Boton>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {editando && (
        <FormularioTarea
          asignatura={asignatura}
          tareaInicial={tarea}
          onCerrar={() => setEditando(false)}
          onGuardada={(t) => {
            setTarea(t)
            onCambiada()
          }}
        />
      )}
      {confirmando && (
        <DialogoConfirmacion
          titulo={`¿Eliminar «${tarea.titulo}»?`}
          mensaje="Se eliminará la tarea y sus adjuntos. Esta acción no se puede deshacer."
          onConfirmar={confirmarEliminar}
          onCancelar={() => setConfirmando(false)}
        />
      )}
      {adjEliminar && (
        <DialogoConfirmacion
          titulo={`¿Quitar «${adjEliminar.nombre}»?`}
          mensaje="Se eliminará este adjunto de la tarea."
          textoConfirmar="Quitar"
          onConfirmar={quitarAdjunto}
          onCancelar={() => setAdjEliminar(null)}
        />
      )}
      {duplicando && (
        <DuplicarTareaDialog
          tarea={tarea}
          asignaturaIdInicial={duplicando.asignaturaIdInicial}
          temasSugeridos={duplicando.temasSugeridos}
          onCerrar={() => setDuplicando(null)}
          onDuplicada={() => onCambiada()}
        />
      )}
    </div>,
    document.body
  )
}
