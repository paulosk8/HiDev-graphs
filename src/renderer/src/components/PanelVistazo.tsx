import { useCallback, useEffect, useState } from 'react'
import type { ConceptoDTO } from '@shared/dtos'
import { api } from '../lib/api'
import { NotasConcepto } from '../features/conceptos/NotasConcepto'
import { ZonaMaterial } from '../features/conceptos/ZonaMaterial'
import { useUiStore } from '../stores/uiStore'
import { useVistazoStore } from '../stores/vistazoStore'
import { empezarArrastreDe } from '../features/lienzo/arrastreAlLienzo'

/**
 * Panel lateral del concepto: se abre al pulsar un `[[enlace]]` o una tarjeta
 * del lienzo, y lo enseña sin sacarte de donde estabas.
 *
 * **Reutiliza los componentes de la ficha** (`NotasConcepto`, `ZonaMaterial`)
 * en vez de traer su propio editor. El primer intento tenía uno a medida y se
 * quedaba corto enseguida: no soportaba los formatos de nota, ni pegar con
 * formato, ni arrastrar material — por eso las notas "no se dejaban editar".
 * Reutilizando, lo que se arregle en la ficha llega aquí solo.
 *
 * Es una COLUMNA del layout, no un panel flotante: empuja el contenido en vez
 * de taparlo.
 */
export function PanelVistazo(): JSX.Element | null {
  const pila = useVistazoStore((s) => s.pila)
  const volver = useVistazoStore((s) => s.volver)
  const irA = useVistazoStore((s) => s.irA)
  const cerrar = useVistazoStore((s) => s.cerrar)
  const llevarAlLienzo = useVistazoStore((s) => s.llevarAlLienzo)
  const irAConcepto = useUiStore((s) => s.seleccionarConcepto)
  const irASeccion = useUiStore((s) => s.irASeccion)

  const conceptoId = pila[pila.length - 1] ?? null
  const [concepto, setConcepto] = useState<ConceptoDTO | null>(null)
  const [cargando, setCargando] = useState(false)
  /** Nombre de cada concepto de la pila, para rotular sus pestañas. */
  const [nombres, setNombres] = useState<Record<string, string>>({})

  const cargar = useCallback(async () => {
    if (!conceptoId) return
    setCargando(true)
    try {
      const c = (await api.obtenerFichaConcepto(conceptoId)).concepto
      setConcepto(c)
      setNombres((n) => ({ ...n, [c.id]: c.nombre }))
    } catch {
      setConcepto(null)
    } finally {
      setCargando(false)
    }
  }, [conceptoId])

  useEffect(() => {
    if (!conceptoId) {
      setConcepto(null)
      return
    }
    void cargar()
  }, [conceptoId, cargar])

  useEffect(() => {
    if (!conceptoId) return
    const alTeclear = (e: KeyboardEvent): void => {
      // Escape cierra, salvo si se está escribiendo: ahí lo gestiona el editor.
      const enCampo = (e.target as HTMLElement)?.tagName?.match(/INPUT|TEXTAREA/)
      if (e.key === 'Escape' && !enCampo) cerrar()
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
      className="flex h-full shrink-0 border-l border-slate-200 bg-white"
      aria-label="Vistazo al concepto"
    >
      {/* Pestañas verticales: al ir tirando de enlaces se acumulan varios
          conceptos, y con solo "← volver" había que deshacer uno a uno para
          llegar al primero. Aquí se salta a cualquiera de un clic. */}
      {pila.length > 1 && (
        <nav
          className="flex w-9 shrink-0 flex-col items-center gap-1 border-r border-slate-100 bg-slate-50 py-2"
          aria-label="Conceptos abiertos"
        >
          {pila.map((id, i) => {
            const activo = i === pila.length - 1
            const nombre = nombres[id] ?? id
            return (
              <button
                key={`${id}-${i}`}
                onClick={() => irA(i)}
                title={nombre}
                aria-current={activo}
                className={`w-7 rounded px-1 py-2 text-[10px] font-semibold uppercase transition ${
                  activo
                    ? 'bg-marca-600 text-white'
                    : 'text-slate-500 hover:bg-white hover:text-slate-800'
                }`}
              >
                {/* Dos letras: el ancho de la franja no da para más y el
                    título completo está en el tooltip. */}
                {nombre.slice(0, 2)}
              </button>
            )
          })}
        </nav>
      )}

      <div className="flex h-full w-[26rem] flex-col">
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
        {cargando && !concepto ? (
          <p className="text-sm text-slate-400">Cargando…</p>
        ) : !concepto ? (
          <p className="text-sm text-slate-500">
            Este concepto ya no existe. Puede que se haya eliminado o cambiado de nombre.
          </p>
        ) : (
          <>
            {concepto.descripcion && (
              <p className="text-sm text-slate-600">{concepto.descripcion}</p>
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

            {/* En un lienzo, todo esto se arrastra allí. Se conserva el clic
                como alternativa: arrastrar no siempre es cómodo, y quien no
                descubra el gesto tiene que poder igual. */}
            {llevarAlLienzo && (
              <button
                draggable
                onDragStart={(e) => empezarArrastreDe(e, { tipo: 'concepto', conceptoId })}
                onClick={() => llevarAlLienzo({ tipo: 'concepto', conceptoId })}
                title="Arrástralo al lienzo, o pulsa para añadirlo"
                className="mt-3 w-full cursor-grab rounded-lg border border-marca-200 bg-marca-50 px-3 py-1.5 text-xs font-medium text-marca-700 transition hover:bg-marca-100 active:cursor-grabbing"
              >
                ⠿ Arrastra este concepto al lienzo
              </button>
            )}

            <section className="mt-5">
              <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-400">
                Material
              </h3>
              <ZonaMaterial
                conceptoId={concepto.id}
                recursos={concepto.recursos}
                onActualizado={(c) => setConcepto(c)}
              />

              {/* Las notas también se arrastran, cada una por separado. */}
              {llevarAlLienzo && concepto.notas.length > 0 && (
                <div className="mt-4">
                  <h3 className="mb-1 text-xs font-semibold uppercase tracking-wide text-slate-400">
                    Arrastra una nota al lienzo
                  </h3>
                  <ul className="space-y-1">
                    {concepto.notas.map((n) => (
                      <li key={n.id}>
                        <button
                          draggable
                          onDragStart={(e) =>
                            empezarArrastreDe(e, {
                              tipo: 'nota',
                              conceptoId: concepto.id,
                              notaId: n.id
                            })
                          }
                          onClick={() =>
                            llevarAlLienzo({ tipo: 'nota', conceptoId: concepto.id, notaId: n.id })
                          }
                          title="Arrástrala al lienzo, o pulsa para añadirla"
                          className="w-full cursor-grab truncate rounded px-2 py-1 text-left text-xs text-marca-700 hover:bg-marca-50 active:cursor-grabbing"
                        >
                          ⠿ {n.titulo || 'Nota sin título'}
                        </button>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </section>

            {/* El mismo componente de la ficha: formatos, pegado con formato y
                todo lo que ya funcionaba allí, sin duplicar nada. */}
            <div className="mt-5">
              <NotasConcepto concepto={concepto} onGuardado={() => void cargar()} />
            </div>
          </>
        )}
      </div>

      {concepto && (
        <footer className="border-t border-slate-100 px-4 py-3">
          <button
            onClick={abrirFicha}
            className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
          >
            Abrir ficha completa
          </button>
        </footer>
      )}
      </div>
    </aside>
  )
}
