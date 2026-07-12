import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { marked } from 'marked'
import type { RecursoDTO } from '@shared/dtos'
import { Boton } from '../../components/Boton'
import { api } from '../../lib/api'
import { useUiStore } from '../../stores/uiStore'

interface Props {
  conceptoId: string
  recurso: RecursoDTO
  onCerrar: () => void
}

const PREVISUALIZABLES = ['pdf', 'md', 'html', 'xml']

export function VistaPreviaMaterial({ conceptoId, recurso, onCerrar }: Props): JSX.Element {
  const [texto, setTexto] = useState<string | null>(null)
  const [cargando, setCargando] = useState(false)
  const notificarError = useUiStore((s) => s.notificarError)
  const url = api.urlRecurso(conceptoId, recurso.archivo)

  useEffect(() => {
    const alPulsar = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') onCerrar()
    }
    window.addEventListener('keydown', alPulsar)
    return () => window.removeEventListener('keydown', alPulsar)
  }, [onCerrar])

  useEffect(() => {
    if (recurso.formato !== 'md' && recurso.formato !== 'xml') return
    setCargando(true)
    api
      .leerTextoMaterial(conceptoId, recurso.archivo)
      .then((t) => setTexto(t))
      .catch((e) => {
        notificarError(e)
        onCerrar()
      })
      .finally(() => setCargando(false))
  }, [conceptoId, recurso.archivo, recurso.formato, notificarError, onCerrar])

  const abrir = (): void => {
    void api.abrirMaterial(conceptoId, recurso.archivo).catch((e) => notificarError(e))
  }

  const cuerpo = (): JSX.Element => {
    if (recurso.formato === 'pdf') {
      return <iframe title={recurso.nombre} src={url} className="h-full w-full border-0" />
    }
    if (recurso.formato === 'html') {
      return (
        <iframe
          title={recurso.nombre}
          src={url}
          sandbox=""
          className="h-full w-full border-0 bg-white"
        />
      )
    }
    if (cargando) {
      return <p className="p-8 text-sm text-slate-400">Cargando…</p>
    }
    if (recurso.formato === 'md') {
      return (
        <div
          className="markdown-preview mx-auto max-w-3xl p-8"
          dangerouslySetInnerHTML={{ __html: marked.parse(texto ?? '') as string }}
        />
      )
    }
    if (recurso.formato === 'xml') {
      return (
        <pre className="h-full overflow-auto p-6 text-xs leading-relaxed text-slate-700">
          {texto}
        </pre>
      )
    }
    // docx, pptx: sin previsualización embebida.
    return (
      <div className="flex h-full flex-col items-center justify-center gap-3 p-8 text-center">
        <div className="text-4xl" aria-hidden>
          📄
        </div>
        <p className="text-sm text-slate-600">
          Este tipo de archivo no se puede previsualizar aquí.
        </p>
        <Boton variante="primario" onClick={abrir}>
          Abrir en mi computador
        </Boton>
      </div>
    )
  }

  return createPortal(
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-6"
      onMouseDown={onCerrar}
    >
      <div
        className="flex h-[86vh] w-full max-w-5xl flex-col overflow-hidden rounded-xl bg-white shadow-2xl"
        onMouseDown={(e) => e.stopPropagation()}
      >
        <header className="flex items-center gap-3 border-b border-slate-200 px-5 py-3">
          <span className="rounded bg-slate-100 px-2 py-0.5 text-xs font-semibold uppercase text-slate-500">
            {recurso.formato}
          </span>
          <span className="flex-1 truncate text-sm font-medium text-slate-800">{recurso.nombre}</span>
          <Boton variante="secundario" onClick={abrir}>
            Abrir en mi computador
          </Boton>
          <button
            onClick={onCerrar}
            className="ml-1 text-slate-400 transition hover:text-slate-700"
            aria-label="Cerrar"
          >
            ✕
          </button>
        </header>
        <div className="min-h-0 flex-1 overflow-auto bg-slate-50">{cuerpo()}</div>
      </div>
    </div>,
    document.body
  )
}

export { PREVISUALIZABLES }
