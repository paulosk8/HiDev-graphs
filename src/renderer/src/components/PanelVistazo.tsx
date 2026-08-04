import { useEffect, useState } from 'react'
import type { ConceptoDTO } from '@shared/dtos'
import { api } from '../lib/api'
import { useConceptosStore } from '../stores/conceptosStore'
import { useUiStore } from '../stores/uiStore'
import { useVistazoStore } from '../stores/vistazoStore'
import { ContenidoFormateado } from './ContenidoFormateado'

/**
 * Panel lateral de vistazo: enseña el concepto enlazado sin sacarte de donde
 * estabas leyendo. Se abre al pulsar un `[[enlace]]`.
 *
 * Detalles pensados para no perderse:
 *  - "← volver" recorre la pila de enlaces que has ido abriendo.
 *  - Escape cierra el panel entero.
 *  - "Abrir ficha completa" es la salida explícita cuando ya quieres irte ahí.
 */
export function PanelVistazo(): JSX.Element | null {
  const pila = useVistazoStore((s) => s.pila)
  const volver = useVistazoStore((s) => s.volver)
  const cerrar = useVistazoStore((s) => s.cerrar)
  const irAConcepto = useUiStore((s) => s.seleccionarConcepto)
  const irASeccion = useUiStore((s) => s.irASeccion)

  const conceptoId = pila[pila.length - 1] ?? null
  const [concepto, setConcepto] = useState<ConceptoDTO | null>(null)
  const [cargando, setCargando] = useState(false)
  /** Qué se está editando: 'descripcion', el id de una nota, o 'nueva'. */
  const [editando, setEditando] = useState<string | null>(null)
  const [borrador, setBorrador] = useState('')
  const [guardando, setGuardando] = useState(false)
  const editarConcepto = useConceptosStore((s) => s.editar)
  const notificarError = useUiStore((s) => s.notificarError)

  /**
   * Guarda lo editado. Se relee el concepto justo antes de escribir: entre
   * abrir el panel y guardar puede haber cambiado algo (la ficha, otro equipo),
   * y guardar una nota nunca debe llevarse por delante lo demás.
   */
  const guardar = async (): Promise<void> => {
    if (!conceptoId || !editando) return
    setGuardando(true)
    try {
      const ficha = await api.obtenerFichaConcepto(conceptoId)
      const c = ficha.concepto
      const notas =
        editando === 'descripcion'
          ? c.notas
          : editando === 'nueva'
            ? [
                ...c.notas,
                {
                  id: `nota-${Date.now().toString(36)}`,
                  titulo: '',
                  contenido: borrador,
                  formato: 'markdown' as const
                }
              ]
            : c.notas.map((n) => (n.id === editando ? { ...n, contenido: borrador } : n))

      const actualizado = await editarConcepto(conceptoId, {
        nombre: c.nombre,
        descripcion: editando === 'descripcion' ? borrador : c.descripcion,
        etiquetas: c.etiquetas,
        notas
      })
      if (actualizado) setConcepto((await api.obtenerFichaConcepto(conceptoId)).concepto)
      setEditando(null)
    } catch (error) {
      notificarError(error)
    } finally {
      setGuardando(false)
    }
  }

  const abrirEdicion = (que: string, valor: string): void => {
    setEditando(que)
    setBorrador(valor)
  }

  useEffect(() => {
    if (!conceptoId) {
      setConcepto(null)
      return
    }
    let vivo = true
    setCargando(true)
    void api
      .obtenerFichaConcepto(conceptoId)
      .then((f) => vivo && setConcepto(f.concepto))
      .catch(() => vivo && setConcepto(null))
      .finally(() => vivo && setCargando(false))
    return () => {
      vivo = false
    }
  }, [conceptoId])

  useEffect(() => {
    if (!conceptoId) return
    const alTeclear = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') cerrar()
    }
    window.addEventListener('keydown', alTeclear)
    return () => window.removeEventListener('keydown', alTeclear)
  }, [conceptoId, cerrar])

  if (!conceptoId) return null

  const abrirFicha = (): void => {
    irASeccion('conceptos')
    irAConcepto(conceptoId)
    cerrar()
  }

  return (
    <aside
      // Es una COLUMNA del layout, no un panel flotante: así empuja el
      // contenido en vez de montarse encima de la barra superior del lienzo,
      // que dejaba sus botones inalcanzables.
      className="flex h-full w-[22rem] shrink-0 flex-col border-l border-slate-200 bg-white"
      aria-label="Vistazo al concepto"
    >
      <header className="flex items-center gap-2 border-b border-slate-100 px-4 py-3">
        {pila.length > 1 && (
          <button
            onClick={volver}
            className="text-sm text-slate-500 transition hover:text-slate-800"
            title="Volver al concepto anterior"
          >
            ←
          </button>
        )}
        <h2 className="min-w-0 flex-1 truncate text-sm font-semibold text-slate-900">
          {concepto?.nombre ?? (cargando ? 'Cargando…' : 'No encontrado')}
        </h2>
        <button
          onClick={cerrar}
          className="text-slate-400 transition hover:text-slate-700"
          aria-label="Cerrar el vistazo"
        >
          ✕
        </button>
      </header>

      <div className="flex-1 overflow-auto px-4 py-4">
        {cargando ? (
          <p className="text-sm text-slate-400">Cargando…</p>
        ) : !concepto ? (
          <p className="text-sm text-slate-500">
            Este concepto ya no existe. Puede que se haya eliminado o cambiado de nombre.
          </p>
        ) : (
          <>
            {editando === 'descripcion' ? (
              <EditorEnPanel
                valor={borrador}
                onCambiar={setBorrador}
                onGuardar={() => void guardar()}
                onCancelar={() => setEditando(null)}
                guardando={guardando}
                placeholder="¿De qué trata este concepto?"
              />
            ) : (
              <button
                onClick={() => abrirEdicion('descripcion', concepto.descripcion)}
                title="Pulsa para editar"
                className="w-full rounded px-1 py-0.5 text-left text-sm text-slate-600 hover:bg-slate-50"
              >
                {concepto.descripcion || (
                  <span className="text-slate-400">Sin descripción · pulsa para escribirla</span>
                )}
              </button>
            )}

            {concepto.etiquetas.length > 0 && (
              <div className="mt-3 flex flex-wrap gap-1.5">
                {concepto.etiquetas.map((e) => (
                  <span
                    key={e}
                    className="rounded-full bg-marca-50 px-2 py-0.5 text-xs font-medium text-marca-700"
                  >
                    {e}
                  </span>
                ))}
              </div>
            )}

            <section className="mt-5">
              <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-400">
                Notas
              </h3>
              <div className="space-y-3">
                {concepto.notas.map((n) => (
                  <div key={n.id} className="rounded-lg border border-slate-100 p-3">
                    {n.titulo && (
                      <p className="mb-1 text-sm font-medium text-slate-800">{n.titulo}</p>
                    )}
                    {editando === n.id ? (
                      <EditorEnPanel
                        valor={borrador}
                        onCambiar={setBorrador}
                        onGuardar={() => void guardar()}
                        onCancelar={() => setEditando(null)}
                        guardando={guardando}
                        placeholder="Escribe la nota…"
                      />
                    ) : (
                      <>
                        {/* El contenido puede traer más [[enlaces]]: se siguen
                            dentro del propio panel, apilándose. */}
                        <ContenidoFormateado texto={n.contenido} formato={n.formato} />
                        <button
                          onClick={() => abrirEdicion(n.id, n.contenido)}
                          className="mt-1 text-xs text-slate-400 hover:text-marca-700"
                        >
                          Editar
                        </button>
                      </>
                    )}
                  </div>
                ))}

                {editando === 'nueva' ? (
                  <div className="rounded-lg border border-slate-100 p-3">
                    <EditorEnPanel
                      valor={borrador}
                      onCambiar={setBorrador}
                      onGuardar={() => void guardar()}
                      onCancelar={() => setEditando(null)}
                      guardando={guardando}
                      placeholder="Escribe la nota…"
                    />
                  </div>
                ) : (
                  <button
                    onClick={() => abrirEdicion('nueva', '')}
                    className="text-xs text-marca-700 hover:underline"
                  >
                    + Añadir nota
                  </button>
                )}
              </div>
            </section>

            {concepto.recursos.length > 0 && (
              <section className="mt-5">
                <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-400">
                  Material
                </h3>
                <ul className="space-y-1.5">
                  {concepto.recursos.map((r) => (
                    <li key={r.id} className="flex items-center gap-2 text-sm text-slate-700">
                      <span className="rounded bg-slate-100 px-1.5 py-0.5 text-[10px] font-semibold uppercase text-slate-500">
                        {r.formato}
                      </span>
                      <span className="truncate">{r.nombre}</span>
                    </li>
                  ))}
                </ul>
              </section>
            )}


          </>
        )}
      </div>

      {concepto && (
        <footer className="border-t border-slate-100 px-4 py-3">
          <button
            onClick={abrirFicha}
            className="w-full rounded-lg bg-marca-600 px-3 py-2 text-sm font-medium text-white transition hover:bg-marca-700"
          >
            Abrir ficha completa
          </button>
        </footer>
      )}
    </aside>
  )
}


/**
 * Cajita de edición del panel. Se repite para la descripción y para cada nota,
 * así que vive aquí en vez de duplicarse tres veces.
 */
function EditorEnPanel({
  valor,
  onCambiar,
  onGuardar,
  onCancelar,
  guardando,
  placeholder
}: {
  valor: string
  onCambiar: (v: string) => void
  onGuardar: () => void
  onCancelar: () => void
  guardando: boolean
  placeholder: string
}): JSX.Element {
  return (
    <div>
      <textarea
        autoFocus
        value={valor}
        onChange={(e) => onCambiar(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Escape') onCancelar()
          // Ctrl/⌘+Enter guarda; Enter hace un salto de línea.
          if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) onGuardar()
        }}
        placeholder={placeholder}
        rows={4}
        className="w-full resize-none rounded border border-slate-300 px-2 py-1 text-sm outline-none focus:border-marca-500"
      />
      <div className="mt-1 flex items-center gap-2">
        <button
          onClick={onGuardar}
          disabled={guardando}
          className="rounded bg-marca-600 px-2 py-0.5 text-xs text-white disabled:opacity-50"
        >
          {guardando ? 'Guardando…' : 'Guardar'}
        </button>
        <button onClick={onCancelar} className="text-xs text-slate-500 hover:text-slate-800">
          Cancelar
        </button>
      </div>
    </div>
  )
}
