import { useEffect, useState } from 'react'
import type { ItemHistorialDTO, VersionHistorialDTO } from '@shared/dtos'
import { Boton } from '../../components/Boton'
import { Modal } from '../../components/Modal'
import { api } from '../../lib/api'
import { useAsignaturasStore } from '../../stores/asignaturasStore'
import { useConceptosStore } from '../../stores/conceptosStore'
import { useUiStore } from '../../stores/uiStore'

/** Fecha/hora relativa amable ("hace 5 min", "ayer 14:30", "12 jul 09:00"). */
function cuando(ms: number): string {
  const seg = Math.round((Date.now() - ms) / 1000)
  if (seg < 60) return 'hace un momento'
  if (seg < 3600) return `hace ${Math.floor(seg / 60)} min`
  if (seg < 86400) return `hace ${Math.floor(seg / 3600)} h`
  return new Date(ms).toLocaleString('es', { dateStyle: 'medium', timeStyle: 'short' })
}

/**
 * Historial de cambios: lista los elementos que han cambiado y, para cada uno,
 * sus versiones anteriores, con opción de restaurar una. Los snapshots viven en
 * este equipo (userData), no en la carpeta del material.
 */
export function HistorialCambios({ onCerrar }: { onCerrar: () => void }): JSX.Element {
  const notificar = useUiStore((s) => s.notificar)
  const notificarError = useUiStore((s) => s.notificarError)
  const cargarConceptos = useConceptosStore((s) => s.cargar)
  const cargarAsignaturas = useAsignaturasStore((s) => s.cargar)

  const [items, setItems] = useState<ItemHistorialDTO[]>([])
  const [cargando, setCargando] = useState(true)
  const [sel, setSel] = useState<ItemHistorialDTO | null>(null)
  const [versiones, setVersiones] = useState<VersionHistorialDTO[]>([])
  const [confirmando, setConfirmando] = useState<string | null>(null)
  const [restaurando, setRestaurando] = useState(false)

  const cargarItems = async (): Promise<void> => {
    try {
      setItems(await api.listarHistorial())
    } catch (error) {
      notificarError(error)
    } finally {
      setCargando(false)
    }
  }

  useEffect(() => {
    void cargarItems()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const abrir = async (item: ItemHistorialDTO): Promise<void> => {
    setSel(item)
    setConfirmando(null)
    setVersiones([])
    try {
      setVersiones(await api.versionesHistorial(item.tabla, item.id))
    } catch (error) {
      notificarError(error)
    }
  }

  const restaurar = async (versionId: string): Promise<void> => {
    if (!sel) return
    setRestaurando(true)
    try {
      await api.restaurarVersion(sel.tabla, sel.id, versionId)
      notificar({ tipo: 'exito', mensaje: 'Versión restaurada.' })
      await Promise.all([cargarConceptos(), cargarAsignaturas()])
      setConfirmando(null)
      // Deja que el historial capture la versión restaurada y refresca las listas.
      setTimeout(() => {
        void cargarItems()
        void api.versionesHistorial(sel.tabla, sel.id).then(setVersiones).catch(() => {})
      }, 700)
    } catch (error) {
      notificarError(error)
    } finally {
      setRestaurando(false)
    }
  }

  return (
    <Modal
      titulo="Historial de cambios"
      descripcion="Revisa las modificaciones de tu material y vuelve a una versión anterior si lo necesitas."
      ancho="xl"
      onCerrar={onCerrar}
    >
      {cargando ? (
        <p className="text-sm text-slate-500">Cargando…</p>
      ) : items.length === 0 ? (
        <div className="rounded-lg border border-dashed border-slate-300 bg-slate-50 p-6 text-center">
          <p className="text-sm text-slate-600">Todavía no hay cambios registrados.</p>
          <p className="mt-1 text-xs text-slate-500">
            A medida que edites tus conceptos, asignaturas o tareas, sus versiones aparecerán aquí.
          </p>
        </div>
      ) : (
        <div className="flex h-[26rem] gap-4">
          {/* Panel izquierdo: elementos con historial */}
          <div className="w-2/5 shrink-0 overflow-y-auto rounded-lg border border-slate-200">
            {items.map((item) => (
              <button
                key={`${item.tabla}:${item.id}`}
                onClick={() => void abrir(item)}
                className={`flex w-full flex-col items-start gap-0.5 border-b border-slate-100 p-3 text-left transition ${
                  sel?.tabla === item.tabla && sel?.id === item.id ? 'bg-marca-50' : 'hover:bg-slate-50'
                }`}
              >
                <div className="flex w-full items-center gap-2">
                  <span className="truncate text-sm font-medium text-slate-800">{item.nombre}</span>
                  <span className="ml-auto shrink-0 rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-medium text-slate-500">
                    {item.tipoEtiqueta}
                  </span>
                </div>
                <span className="text-xs text-slate-400">
                  {item.versiones} versiones · {cuando(item.ultimaModificacionMs)}
                </span>
              </button>
            ))}
          </div>

          {/* Panel derecho: versiones del elemento seleccionado */}
          <div className="min-w-0 flex-1 overflow-y-auto">
            {!sel ? (
              <div className="flex h-full items-center justify-center text-sm text-slate-400">
                Elige un elemento para ver sus versiones.
              </div>
            ) : (
              <ul className="space-y-2">
                {versiones.map((v, i) => (
                  <li key={v.versionId} className="rounded-lg border border-slate-200 p-3">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium text-slate-700">{cuando(v.capturadoEnMs)}</span>
                      {i === 0 && (
                        <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-medium text-emerald-700">
                          Actual
                        </span>
                      )}
                      {i !== 0 &&
                        (confirmando === v.versionId ? (
                          <span className="ml-auto flex items-center gap-2">
                            <span className="text-xs text-slate-500">¿Restaurar?</span>
                            <Boton variante="secundario" onClick={() => setConfirmando(null)} disabled={restaurando}>
                              No
                            </Boton>
                            <Boton variante="primario" onClick={() => void restaurar(v.versionId)} disabled={restaurando}>
                              {restaurando ? 'Restaurando…' : 'Sí, restaurar'}
                            </Boton>
                          </span>
                        ) : (
                          <Boton
                            variante="secundario"
                            className="ml-auto"
                            onClick={() => setConfirmando(v.versionId)}
                            disabled={restaurando}
                          >
                            Restaurar
                          </Boton>
                        ))}
                    </div>
                    <p className="mt-1 truncate text-xs text-slate-500">{v.resumen}</p>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      )}

      <div className="mt-5 flex justify-end">
        <Boton variante="secundario" onClick={onCerrar}>
          Cerrar
        </Boton>
      </div>
    </Modal>
  )
}
