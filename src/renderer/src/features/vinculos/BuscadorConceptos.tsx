import { useEffect, useRef, useState } from 'react'
import type { ResumenConceptoDTO } from '@shared/dtos'
import { api } from '../../lib/api'
import { useConceptosStore } from '../../stores/conceptosStore'

interface Props {
  /** Conceptos ya vinculados (se excluyen de los resultados). */
  excluir: string[]
  onSeleccionar: (conceptoId: string) => void | Promise<void>
  onCerrar: () => void
}

/**
 * Buscador con autocompletado para vincular un concepto a un tema. Si el texto
 * no coincide con ninguno, ofrece crear el concepto nuevo en el momento.
 */
export function BuscadorConceptos({ excluir, onSeleccionar, onCerrar }: Props): JSX.Element {
  const crearConcepto = useConceptosStore((s) => s.crear)
  const [texto, setTexto] = useState('')
  const [resultados, setResultados] = useState<ResumenConceptoDTO[]>([])
  const [ocupado, setOcupado] = useState(false)
  const contenedor = useRef<HTMLDivElement>(null)

  // Búsqueda con pequeño retardo (debounce).
  useEffect(() => {
    let vigente = true
    const t = setTimeout(async () => {
      try {
        const lista = texto.trim() ? await api.buscarConceptos(texto.trim()) : await api.listarConceptos()
        if (vigente) setResultados(lista.filter((c) => !excluir.includes(c.id)))
      } catch {
        if (vigente) setResultados([])
      }
    }, 180)
    return () => {
      vigente = false
      clearTimeout(t)
    }
  }, [texto, excluir])

  // Cerrar al hacer clic fuera o con Escape.
  useEffect(() => {
    const fuera = (e: MouseEvent): void => {
      if (contenedor.current && !contenedor.current.contains(e.target as Node)) onCerrar()
    }
    const escape = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') onCerrar()
    }
    document.addEventListener('mousedown', fuera)
    document.addEventListener('keydown', escape)
    return () => {
      document.removeEventListener('mousedown', fuera)
      document.removeEventListener('keydown', escape)
    }
  }, [onCerrar])

  const nombreLimpio = texto.trim()
  const hayCoincidenciaExacta = resultados.some(
    (c) => c.nombre.toLowerCase() === nombreLimpio.toLowerCase()
  )

  const seleccionar = async (conceptoId: string): Promise<void> => {
    setOcupado(true)
    await onSeleccionar(conceptoId)
    setOcupado(false)
  }

  const crearYVincular = async (): Promise<void> => {
    if (!nombreLimpio) return
    setOcupado(true)
    const creado = await crearConcepto({ nombre: nombreLimpio })
    if (creado) await onSeleccionar(creado.id)
    setOcupado(false)
  }

  return (
    <div
      ref={contenedor}
      className="absolute z-30 mt-1 w-72 overflow-hidden rounded-lg border border-slate-200 bg-white shadow-lg"
    >
      <input
        autoFocus
        value={texto}
        onChange={(e) => setTexto(e.target.value)}
        placeholder="Buscar o crear concepto…"
        disabled={ocupado}
        className="w-full border-b border-slate-100 px-3 py-2 text-sm outline-none placeholder:text-slate-400"
      />
      <ul className="max-h-56 overflow-y-auto py-1">
        {resultados.map((c) => (
          <li key={c.id}>
            <button
              onClick={() => void seleccionar(c.id)}
              disabled={ocupado}
              className="flex w-full items-center justify-between px-3 py-2 text-left text-sm text-slate-700 hover:bg-slate-50"
            >
              <span className="truncate">{c.nombre}</span>
              {c.totalRecursos > 0 && (
                <span className="ml-2 shrink-0 text-xs text-slate-400">
                  {c.totalRecursos} mat.
                </span>
              )}
            </button>
          </li>
        ))}

        {nombreLimpio && !hayCoincidenciaExacta && (
          <li>
            <button
              onClick={() => void crearYVincular()}
              disabled={ocupado}
              className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-marca-700 hover:bg-marca-50"
            >
              <span className="text-base leading-none">＋</span>
              Crear «{nombreLimpio}»
            </button>
          </li>
        )}

        {resultados.length === 0 && !nombreLimpio && (
          <li className="px-3 py-2 text-xs text-slate-400">Escribe para buscar un concepto…</li>
        )}
      </ul>
    </div>
  )
}
