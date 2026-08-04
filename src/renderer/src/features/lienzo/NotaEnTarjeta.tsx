import { useEffect, useState } from 'react'
import type { NotaDTO } from '@shared/dtos'
import { api } from '../../lib/api'
import { useConceptosStore } from '../../stores/conceptosStore'
import { useUiStore } from '../../stores/uiStore'

/**
 * Edición de la nota de un concepto SIN salir del lienzo.
 *
 * Edita la nota de verdad: la tarjeta es una referencia, no una copia, así que
 * lo que se escriba aquí aparece igual en la ficha del concepto y al repasar.
 * Si el concepto no tenía ninguna nota se crea la primera, que es lo que se
 * espera al ponerse a escribir sobre una tarjeta vacía.
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
  const [texto, setTexto] = useState('')
  const [guardando, setGuardando] = useState(false)

  useEffect(() => {
    let vivo = true
    void api
      .obtenerFichaConcepto(conceptoId)
      .then((f) => {
        if (!vivo) return
        setNotas(f.concepto.notas)
        setTexto(f.concepto.notas[0]?.contenido ?? '')
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

  const guardar = async (): Promise<void> => {
    if (notas === null) return
    setGuardando(true)
    try {
      const ficha = await api.obtenerFichaConcepto(conceptoId)
      const actuales = ficha.concepto.notas
      const nuevas: NotaDTO[] =
        actuales.length > 0
          ? actuales.map((n, i) => (i === 0 ? { ...n, contenido: texto } : n))
          : [{ id: `nota-${Date.now().toString(36)}`, titulo: '', contenido: texto, formato: 'markdown' }]

      await editarConcepto(conceptoId, {
        nombre: ficha.concepto.nombre,
        descripcion: ficha.concepto.descripcion,
        // Se mandan las etiquetas actuales: omitirlas las conservaría igual,
        // pero enviarlas deja explícito que no se tocan.
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
    return <p className="mt-2 text-xs text-slate-400">Cargando la nota…</p>
  }

  return (
    <div className="mt-2" onMouseDown={(e) => e.stopPropagation()}>
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
        className="h-20 w-full resize-none rounded border border-slate-300 px-2 py-1 text-xs outline-none focus:border-marca-500"
      />
      <div className="mt-1 flex items-center gap-2">
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
          <span className="text-[10px] text-slate-400">
            Se edita la primera de {notas.length} notas
          </span>
        )}
      </div>
    </div>
  )
}
