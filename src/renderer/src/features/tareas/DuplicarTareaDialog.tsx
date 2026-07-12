import { useEffect, useState } from 'react'
import type { AsignaturaDTO, TareaDTO } from '@shared/dtos'
import { Boton } from '../../components/Boton'
import { CampoTexto } from '../../components/Campos'
import { Modal } from '../../components/Modal'
import { api } from '../../lib/api'
import { useAsignaturasStore } from '../../stores/asignaturasStore'
import { useTareasStore } from '../../stores/tareasStore'
import { useUiStore } from '../../stores/uiStore'

interface Props {
  tarea: TareaDTO
  asignaturaIdInicial?: string
  temasSugeridos?: string[]
  onCerrar: () => void
  onDuplicada: (nueva: TareaDTO) => void
}

export function DuplicarTareaDialog({
  tarea,
  asignaturaIdInicial,
  temasSugeridos,
  onCerrar,
  onDuplicada
}: Props): JSX.Element {
  const asignaturas = useAsignaturasStore((s) => s.lista)
  const duplicar = useTareasStore((s) => s.duplicar)
  const notificarError = useUiStore((s) => s.notificarError)

  const [asignaturaId, setAsignaturaId] = useState(asignaturaIdInicial ?? '')
  const [destino, setDestino] = useState<AsignaturaDTO | null>(null)
  const [temas, setTemas] = useState<Set<string>>(new Set())
  const [titulo, setTitulo] = useState(`${tarea.titulo} (copia)`)
  const [ocupado, setOcupado] = useState(false)

  useEffect(() => {
    if (!asignaturaId) {
      setDestino(null)
      setTemas(new Set())
      return
    }
    let vivo = true
    api
      .obtenerAsignatura(asignaturaId)
      .then((a) => {
        if (!vivo) return
        setDestino(a)
        const validos = (temasSugeridos ?? []).filter((id) =>
          a.unidades.some((u) => u.temas.some((t) => t.id === id))
        )
        setTemas(new Set(validos))
      })
      .catch((e) => notificarError(e))
    return () => {
      vivo = false
    }
  }, [asignaturaId, temasSugeridos, notificarError])

  const alternarTema = (id: string): void =>
    setTemas((prev) => {
      const s = new Set(prev)
      s.has(id) ? s.delete(id) : s.add(id)
      return s
    })

  const guardar = async (): Promise<void> => {
    if (!asignaturaId || temas.size === 0 || titulo.trim().length === 0) return
    setOcupado(true)
    const nueva = await duplicar(tarea.id, {
      asignaturaId,
      temas: [...temas],
      titulo: titulo.trim()
    })
    setOcupado(false)
    if (nueva) {
      onDuplicada(nueva)
      onCerrar()
    }
  }

  return (
    <Modal
      titulo="Duplicar tarea"
      descripcion="Reutiliza esta tarea en otra asignatura o periodo. Podrás retocarla después."
      ancho="lg"
      onCerrar={onCerrar}
    >
      <div className="space-y-4">
        <label className="block">
          <span className="mb-1.5 block text-sm font-medium text-slate-700">Asignatura destino</span>
          <select
            value={asignaturaId}
            onChange={(e) => setAsignaturaId(e.target.value)}
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-marca-500 focus:ring-2 focus:ring-marca-100"
          >
            <option value="">Elige una asignatura…</option>
            {asignaturas.map((a) => (
              <option key={a.id} value={a.id}>
                {a.nombre} · {a.periodos.join(', ')}
              </option>
            ))}
          </select>
        </label>

        {destino && (
          <div>
            <span className="mb-1.5 block text-sm font-medium text-slate-700">Temas destino</span>
            <div className="max-h-40 space-y-2 overflow-y-auto rounded-lg border border-slate-200 p-3">
              {destino.unidades.map((u) => (
                <div key={u.id}>
                  <p className="text-xs font-semibold text-slate-400">{u.titulo}</p>
                  {u.temas.map((t) => (
                    <label
                      key={t.id}
                      className="flex items-center gap-2 py-0.5 text-sm text-slate-700"
                    >
                      <input
                        type="checkbox"
                        checked={temas.has(t.id)}
                        onChange={() => alternarTema(t.id)}
                      />
                      {t.titulo}
                    </label>
                  ))}
                </div>
              ))}
              {destino.unidades.length === 0 && (
                <p className="text-xs text-slate-400">Esta asignatura no tiene temas todavía.</p>
              )}
            </div>
          </div>
        )}

        <CampoTexto
          etiqueta="Título de la copia"
          value={titulo}
          onChange={(e) => setTitulo(e.target.value)}
        />

        <div className="flex justify-end gap-2 pt-1">
          <Boton variante="secundario" onClick={onCerrar} disabled={ocupado}>
            Cancelar
          </Boton>
          <Boton
            variante="primario"
            onClick={guardar}
            disabled={ocupado || !asignaturaId || temas.size === 0 || titulo.trim().length === 0}
          >
            {ocupado ? 'Duplicando…' : 'Duplicar'}
          </Boton>
        </div>
      </div>
    </Modal>
  )
}
