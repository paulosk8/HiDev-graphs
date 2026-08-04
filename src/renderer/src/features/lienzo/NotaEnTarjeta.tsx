import { useEffect, useState } from 'react'
import type { NotaDTO } from '@shared/dtos'
import { api } from '../../lib/api'
import { useConceptosStore } from '../../stores/conceptosStore'
import { useUiStore } from '../../stores/uiStore'

/**
 * Edición de una nota de un concepto SIN salir del lienzo.
 *
 * Edita la nota de verdad: la tarjeta es una referencia, no una copia, así que
 * lo que se escriba aquí aparece igual en la ficha del concepto y al repasar.
 *
 * Si el concepto tiene VARIAS notas se pregunta cuál. La versión anterior
 * editaba siempre la primera y al guardar la sobrescribía, así que se podía
 * perder una nota creyendo estar editando otra.
 */
export function NotaEnTarjeta({
  conceptoId,
  onCerrar
}: {
  conceptoId: string
  onCerrar: () => void
}): JSX.Element {
  const editarConcepto = useConceptosStore((s) => s.editar)
  const notificarError = useUiStore((s) => s.notificarError)
  const [notas, setNotas] = useState<NotaDTO[] | null>(null)
  /** Id de la nota en edición, 'nueva' para una nota nueva, o null (eligiendo). */
  const [eligiendo, setEligiendo] = useState<string | null>(null)
  const [texto, setTexto] = useState('')
  const [guardando, setGuardando] = useState(false)

  useEffect(() => {
    let vivo = true
    void api
      .obtenerFichaConcepto(conceptoId)
      .then((f) => {
        if (!vivo) return
        const suyas = f.concepto.notas
        setNotas(suyas)
        // Con una sola nota (o ninguna) no hay nada que elegir: se entra directo.
        if (suyas.length === 0) {
          setEligiendo('nueva')
          setTexto('')
        } else if (suyas.length === 1) {
          setEligiendo(suyas[0].id)
          setTexto(suyas[0].contenido)
        }
      })
      .catch((e) => {
        if (vivo) {
          notificarError(e)
          onCerrar()
        }
      })
    return () => {
      vivo = false
    }
  }, [conceptoId, notificarError, onCerrar])

  const elegir = (nota: NotaDTO | 'nueva'): void => {
    if (nota === 'nueva') {
      setEligiendo('nueva')
      setTexto('')
    } else {
      setEligiendo(nota.id)
      setTexto(nota.contenido)
    }
  }

  const guardar = async (): Promise<void> => {
    if (!eligiendo) return
    setGuardando(true)
    try {
      // Se relee justo antes de escribir: entre abrir y guardar puede haber
      // cambiado algo (otro equipo, la propia ficha), y no debe perderse.
      const ficha = await api.obtenerFichaConcepto(conceptoId)
      const actuales = ficha.concepto.notas
      const nuevas: NotaDTO[] =
        eligiendo === 'nueva'
          ? [
              ...actuales,
              {
                id: `nota-${Date.now().toString(36)}`,
                titulo: '',
                contenido: texto,
                formato: 'markdown'
              }
            ]
          : actuales.map((n) => (n.id === eligiendo ? { ...n, contenido: texto } : n))

      await editarConcepto(conceptoId, {
        nombre: ficha.concepto.nombre,
        descripcion: ficha.concepto.descripcion,
        etiquetas: ficha.concepto.etiquetas,
        notas: nuevas
      })
      onCerrar()
    } catch (error) {
      notificarError(error)
    } finally {
      setGuardando(false)
    }
  }

  if (notas === null) {
    return <p className="mt-2 text-xs text-slate-400">Cargando…</p>
  }

  // Varias notas y ninguna elegida todavía: hay que preguntar cuál.
  if (eligiendo === null) {
    return (
      <div className="mt-2 min-h-0 flex-1 overflow-auto" onMouseDown={(e) => e.stopPropagation()}>
        <p className="mb-1 text-xs text-slate-500">¿Qué nota quieres editar?</p>
        <ul className="space-y-1">
          {notas.map((n) => (
            <li key={n.id}>
              <button
                onClick={() => elegir(n)}
                className="w-full truncate rounded border border-slate-200 px-2 py-1 text-left text-xs text-slate-700 hover:border-marca-300 hover:bg-marca-50"
              >
                {n.titulo || primeraLinea(n.contenido) || 'Nota sin título'}
              </button>
            </li>
          ))}
          <li>
            <button
              onClick={() => elegir('nueva')}
              className="w-full rounded px-2 py-1 text-left text-xs text-marca-700 hover:bg-marca-50"
            >
              + Escribir una nueva
            </button>
          </li>
        </ul>
      </div>
    )
  }

  return (
    // `min-h-0 flex-1`: el editor se ajusta a la tarjeta en vez de desbordarla,
    // que es lo que pasaba con un alto fijo.
    <div className="mt-2 flex min-h-0 flex-1 flex-col" onMouseDown={(e) => e.stopPropagation()}>
      <textarea
        autoFocus
        value={texto}
        onChange={(e) => setTexto(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Escape') onCerrar()
          // Ctrl/⌘+Enter guarda: Enter solo debe hacer un salto de línea.
          if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) void guardar()
        }}
        placeholder="Escribe una nota sobre este concepto…"
        className="min-h-0 w-full flex-1 resize-none rounded border border-slate-300 px-2 py-1 text-xs outline-none focus:border-marca-500"
      />
      <div className="mt-1 flex shrink-0 items-center gap-2">
        <button
          onClick={() => void guardar()}
          disabled={guardando}
          className="rounded bg-marca-600 px-2 py-0.5 text-xs text-white disabled:opacity-50"
        >
          {guardando ? 'Guardando…' : 'Guardar'}
        </button>
        <button onClick={onCerrar} className="text-xs text-slate-500 hover:text-slate-800">
          Cancelar
        </button>
        {notas.length > 1 && (
          <button
            onClick={() => setEligiendo(null)}
            className="ml-auto text-xs text-slate-400 hover:text-slate-700"
          >
            Otra nota
          </button>
        )}
      </div>
    </div>
  )
}

/** Primeras palabras del contenido, para reconocer una nota sin título. */
function primeraLinea(contenido: string): string {
  const linea = contenido.split('\n').find((l) => l.trim()) ?? ''
  return linea.trim().slice(0, 40)
}
