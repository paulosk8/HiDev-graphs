import { useRef, useState, type DragEvent } from 'react'
import type { ConceptoDTO, RecursoDTO } from '@shared/dtos'
import { Boton } from '../../components/Boton'
import { DialogoConfirmacion } from '../../components/DialogoConfirmacion'
import { api } from '../../lib/api'
import { useConceptosStore } from '../../stores/conceptosStore'
import { useUiStore } from '../../stores/uiStore'
import { PREVISUALIZABLES, VistaPreviaMaterial } from './VistaPreviaMaterial'

const FORMATOS_ACEPTADOS = '.pdf,.pptx,.docx,.md,.html,.xml'

interface Props {
  conceptoId: string
  recursos: RecursoDTO[]
  onActualizado: (concepto: ConceptoDTO) => void
}

export function ZonaMaterial({ conceptoId, recursos, onActualizado }: Props): JSX.Element {
  const [arrastrando, setArrastrando] = useState(false)
  const [ocupado, setOcupado] = useState(false)
  const [aEliminar, setAEliminar] = useState<RecursoDTO | null>(null)
  const [aVer, setAVer] = useState<RecursoDTO | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  const agregarMaterial = useConceptosStore((s) => s.agregarMaterial)
  const eliminarMaterial = useConceptosStore((s) => s.eliminarMaterial)
  const notificarError = useUiStore((s) => s.notificarError)

  const abrir = (recurso: RecursoDTO): void => {
    void api.abrirMaterial(conceptoId, recurso.archivo).catch((e) => notificarError(e))
  }

  const procesarArchivos = async (archivos: FileList | null): Promise<void> => {
    if (!archivos || archivos.length === 0) return
    const rutas = Array.from(archivos).map((a) => api.rutaDeArchivo(a))
    setOcupado(true)
    const concepto = await agregarMaterial(conceptoId, rutas)
    setOcupado(false)
    if (concepto) onActualizado(concepto)
  }

  const alSoltar = (e: DragEvent): void => {
    e.preventDefault()
    setArrastrando(false)
    void procesarArchivos(e.dataTransfer.files)
  }

  const confirmarEliminar = async (): Promise<void> => {
    if (!aEliminar) return
    const concepto = await eliminarMaterial(conceptoId, aEliminar.id)
    setAEliminar(null)
    if (concepto) onActualizado(concepto)
  }

  return (
    <div
      onDragOver={(e) => {
        e.preventDefault()
        setArrastrando(true)
      }}
      onDragLeave={() => setArrastrando(false)}
      onDrop={alSoltar}
      className={`rounded-xl border transition ${
        arrastrando ? 'border-marca-400 bg-marca-50' : 'border-slate-200'
      }`}
    >
      <input
        ref={inputRef}
        type="file"
        multiple
        accept={FORMATOS_ACEPTADOS}
        className="hidden"
        onChange={(e) => {
          void procesarArchivos(e.target.files)
          e.target.value = ''
        }}
      />

      {recursos.length === 0 ? (
        <div className="flex flex-col items-center justify-center px-6 py-12 text-center">
          <div className="mb-2 text-3xl" aria-hidden>
            📎
          </div>
          <p className="text-sm font-medium text-slate-700">
            {arrastrando ? 'Suelta para agregar' : 'Arrastra tus archivos aquí'}
          </p>
          <p className="mt-1 text-xs text-slate-400">PDF, PowerPoint, Word, Markdown, HTML o XML</p>
          <Boton variante="secundario" className="mt-4" onClick={() => inputRef.current?.click()} disabled={ocupado}>
            {ocupado ? 'Agregando…' : 'Agregar material'}
          </Boton>
        </div>
      ) : (
        <div className="p-2">
          <ul className="divide-y divide-slate-100">
            {recursos.map((recurso) => (
              <li key={recurso.id} className="group flex items-center gap-3 px-3 py-2.5">
                <span className="rounded bg-slate-100 px-2 py-0.5 text-xs font-semibold uppercase text-slate-500">
                  {recurso.formato}
                </span>
                <span className="flex-1 truncate text-sm text-slate-700">{recurso.nombre}</span>
                {PREVISUALIZABLES.includes(recurso.formato) && (
                  <button
                    onClick={() => setAVer(recurso)}
                    className="text-xs text-slate-500 transition hover:text-marca-700"
                  >
                    Ver
                  </button>
                )}
                <button
                  onClick={() => abrir(recurso)}
                  className="text-xs text-slate-500 transition hover:text-marca-700"
                >
                  Abrir
                </button>
                <button
                  onClick={() => setAEliminar(recurso)}
                  className="text-slate-400 transition hover:text-red-600"
                  aria-label={`Quitar ${recurso.nombre}`}
                >
                  ✕
                </button>
              </li>
            ))}
          </ul>
          <div className="flex items-center justify-between px-3 py-2">
            <span className="text-xs text-slate-400">
              {arrastrando ? 'Suelta para agregar más' : 'Arrastra más archivos o'}
            </span>
            <Boton variante="fantasma" onClick={() => inputRef.current?.click()} disabled={ocupado}>
              {ocupado ? 'Agregando…' : '+ Agregar material'}
            </Boton>
          </div>
        </div>
      )}

      {aEliminar && (
        <DialogoConfirmacion
          titulo={`¿Quitar «${aEliminar.nombre}»?`}
          mensaje="Se eliminará este material del concepto. Esta acción no se puede deshacer."
          textoConfirmar="Quitar"
          onConfirmar={confirmarEliminar}
          onCancelar={() => setAEliminar(null)}
        />
      )}

      {aVer && (
        <VistaPreviaMaterial conceptoId={conceptoId} recurso={aVer} onCerrar={() => setAVer(null)} />
      )}
    </div>
  )
}
