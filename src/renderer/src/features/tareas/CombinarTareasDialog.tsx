import { useEffect, useMemo, useState } from 'react'
import type { AsignaturaDTO, TareaDTO } from '@shared/dtos'
import { Boton } from '../../components/Boton'
import { Modal } from '../../components/Modal'
import { api } from '../../lib/api'
import { useAsignaturasStore } from '../../stores/asignaturasStore'
import { useUiStore } from '../../stores/uiStore'

interface Props {
  /** Tareas origen a combinar (id + título para mostrar). */
  origen: { id: string; titulo: string }[]
  /** Asignatura sugerida por defecto (la de la primera tarea). */
  asignaturaSugerida?: string
  onCerrar: () => void
  onCombinada: (tarea: TareaDTO) => void
}

/**
 * Combina varias tareas en una nueva reutilizando su material: la nueva hereda
 * los adjuntos de las tareas origen (unión) y se ata a los temas elegidos.
 */
export function CombinarTareasDialog({ origen, asignaturaSugerida, onCerrar, onCombinada }: Props): JSX.Element {
  const asignaturas = useAsignaturasStore((s) => s.lista)
  const cargarAsignaturas = useAsignaturasStore((s) => s.cargar)
  const notificar = useUiStore((s) => s.notificar)
  const notificarError = useUiStore((s) => s.notificarError)

  const [titulo, setTitulo] = useState('Actividad combinada')
  const [asignaturaId, setAsignaturaId] = useState(asignaturaSugerida ?? '')
  const [detalle, setDetalle] = useState<AsignaturaDTO | null>(null)
  const [temas, setTemas] = useState<Set<string>>(new Set())
  const [instrucciones, setInstrucciones] = useState('')
  const [guardando, setGuardando] = useState(false)

  useEffect(() => {
    if (asignaturas.length === 0) void cargarAsignaturas()
  }, [asignaturas.length, cargarAsignaturas])

  // Si no hay asignatura sugerida, toma la primera disponible.
  useEffect(() => {
    if (!asignaturaId && asignaturas.length > 0) setAsignaturaId(asignaturas[0].id)
  }, [asignaturaId, asignaturas])

  // Carga los temas de la asignatura elegida.
  useEffect(() => {
    if (!asignaturaId) return
    setDetalle(null)
    setTemas(new Set())
    api.obtenerAsignatura(asignaturaId).then(setDetalle).catch((e) => notificarError(e))
  }, [asignaturaId, notificarError])

  const temasDisponibles = useMemo(
    () =>
      (detalle?.unidades ?? []).flatMap((u) =>
        u.temas.map((t) => ({ id: t.id, etiqueta: `${u.titulo} › ${t.titulo}` }))
      ),
    [detalle]
  )

  const alternarTema = (id: string): void =>
    setTemas((prev) => {
      const s = new Set(prev)
      s.has(id) ? s.delete(id) : s.add(id)
      return s
    })

  const combinar = async (): Promise<void> => {
    if (!titulo.trim() || temas.size === 0) return
    setGuardando(true)
    try {
      const nueva = await api.combinarTareas({
        tareasOrigen: origen.map((o) => o.id),
        asignaturaId,
        temas: [...temas],
        titulo: titulo.trim(),
        instrucciones: instrucciones.trim() || undefined
      })
      notificar({ tipo: 'exito', mensaje: 'Tarea combinada creada; hereda el material de las originales.' })
      onCombinada(nueva)
    } catch (error) {
      notificarError(error)
    } finally {
      setGuardando(false)
    }
  }

  return (
    <Modal titulo="Combinar tareas en una nueva" ancho="lg" onCerrar={onCerrar}>
      <div className="space-y-4 text-sm">
        <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
          <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-slate-400">
            Reutiliza el material de
          </p>
          <ul className="space-y-0.5">
            {origen.map((o) => (
              <li key={o.id} className="text-slate-700">
                • {o.titulo}
              </li>
            ))}
          </ul>
          <p className="mt-1 text-xs text-slate-400">
            La nueva tarea hereda los adjuntos de estas tareas (sin duplicarlos).
          </p>
        </div>

        <label className="block">
          <span className="mb-1 block text-xs font-medium text-slate-600">Título</span>
          <input
            value={titulo}
            onChange={(e) => setTitulo(e.target.value)}
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-marca-500 focus:ring-2 focus:ring-marca-100"
          />
        </label>

        <label className="block">
          <span className="mb-1 block text-xs font-medium text-slate-600">Asignatura</span>
          <select
            value={asignaturaId}
            onChange={(e) => setAsignaturaId(e.target.value)}
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-marca-500 focus:ring-2 focus:ring-marca-100"
          >
            {asignaturas.map((a) => (
              <option key={a.id} value={a.id}>
                {a.nombre}
                {a.periodos.length > 0 ? ` · ${a.periodos.join(', ')}` : ''}
              </option>
            ))}
          </select>
        </label>

        <div>
          <span className="mb-1 block text-xs font-medium text-slate-600">Temas</span>
          {temasDisponibles.length === 0 ? (
            <p className="text-xs text-slate-400">Esta asignatura no tiene temas.</p>
          ) : (
            <div className="max-h-40 space-y-1 overflow-y-auto rounded-lg border border-slate-200 p-2">
              {temasDisponibles.map((t) => (
                <label key={t.id} className="flex items-center gap-2 rounded px-1.5 py-1 hover:bg-slate-50">
                  <input type="checkbox" checked={temas.has(t.id)} onChange={() => alternarTema(t.id)} />
                  <span className="text-slate-700">{t.etiqueta}</span>
                </label>
              ))}
            </div>
          )}
        </div>

        <label className="block">
          <span className="mb-1 block text-xs font-medium text-slate-600">
            Instrucciones (opcional)
          </span>
          <textarea
            value={instrucciones}
            onChange={(e) => setInstrucciones(e.target.value)}
            rows={3}
            placeholder="Déjalo vacío para fusionar las instrucciones de las tareas originales."
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-marca-500 focus:ring-2 focus:ring-marca-100"
          />
        </label>

        <div className="flex justify-end gap-2">
          <Boton variante="secundario" onClick={onCerrar}>
            Cancelar
          </Boton>
          <Boton variante="primario" onClick={() => void combinar()} disabled={!titulo.trim() || temas.size === 0 || guardando}>
            {guardando ? 'Creando…' : 'Crear tarea combinada'}
          </Boton>
        </div>
      </div>
    </Modal>
  )
}
