import { useCallback, useEffect, useMemo, useRef, useState, type DragEvent } from 'react'
import type { ConceptoDTO, RecursoDTO } from '@shared/dtos'
import { Boton } from '../../components/Boton'
import { DialogoConfirmacion } from '../../components/DialogoConfirmacion'
import { DialogoMover } from '../../components/DialogoMover'
import { MenuContextual, useMenuContextual } from '../../components/MenuContextual'
import { api } from '../../lib/api'
import { useConceptosStore } from '../../stores/conceptosStore'
import { useUiStore } from '../../stores/uiStore'
import {
  avisoDeEliminacion,
  useEliminacionStore
} from '../../stores/eliminacionStore'
import { PREVISUALIZABLES, VistaPreviaMaterial } from './VistaPreviaMaterial'

const FORMATOS_ACEPTADOS = '.pdf,.pptx,.docx,.md,.html,.xml'

/** Clave de la sección "sin carpeta", que siempre va primero. */
const RAIZ = ''

interface Props {
  conceptoId: string
  recursos: RecursoDTO[]
  onActualizado: (concepto: ConceptoDTO) => void
}

/**
 * Material de un concepto, organizado en carpetas.
 *
 * Las carpetas son REALES en disco (`conceptos/<slug>/Lecturas/…`), así que el
 * docente ve la misma organización desde OneDrive o el Finder. De ahí dos
 * decisiones de interfaz: se puede soltar directamente SOBRE una carpeta (el
 * archivo se guarda ahí, no en un montón común), y mover algo de carpeta mueve
 * el archivo de verdad, no solo una etiqueta.
 */
export function ZonaMaterial({ conceptoId, recursos, onActualizado }: Props): JSX.Element {
  const modoEliminacion = useEliminacionStore((s) => s.modo)
  // Qué carpeta está resaltada al arrastrar (null = ninguna).
  const [arrastrando, setArrastrando] = useState<string | null>(null)
  const [ocupado, setOcupado] = useState(false)
  const [aEliminar, setAEliminar] = useState<RecursoDTO | null>(null)
  const [aVer, setAVer] = useState<RecursoDTO | null>(null)
  const [aMover, setAMover] = useState<RecursoDTO | null>(null)
  const [carpetas, setCarpetas] = useState<string[]>([])
  const [creandoCarpeta, setCreandoCarpeta] = useState(false)
  const [nombreCarpeta, setNombreCarpeta] = useState('')
  /** Carpeta destino del selector nativo (no cabe en su evento). */
  const destinoRef = useRef<string>(RAIZ)
  const inputRef = useRef<HTMLInputElement>(null)

  const agregarMaterial = useConceptosStore((s) => s.agregarMaterial)
  const eliminarMaterial = useConceptosStore((s) => s.eliminarMaterial)
  const notificarError = useUiStore((s) => s.notificarError)
  const { menu, abrir: abrirMenu, cerrar: cerrarMenu } = useMenuContextual<RecursoDTO>()

  const cargarCarpetas = useCallback(async () => {
    try {
      setCarpetas(await api.listarCarpetasMaterial(conceptoId))
    } catch {
      setCarpetas([])
    }
  }, [conceptoId])

  useEffect(() => {
    void cargarCarpetas()
  }, [cargarCarpetas])

  /**
   * Secciones a pintar: la raíz siempre, más cada carpeta que exista en disco o
   * que contenga algo. Una carpeta vacía se muestra igual: si no, no habría
   * dónde soltar los archivos que van a ella.
   */
  const secciones = useMemo(() => {
    const porCarpeta = new Map<string, RecursoDTO[]>([[RAIZ, []]])
    for (const c of carpetas) porCarpeta.set(c, [])
    for (const r of recursos) {
      const clave = r.carpeta || RAIZ
      porCarpeta.set(clave, [...(porCarpeta.get(clave) ?? []), r])
    }
    return [...porCarpeta.keys()]
      .sort((a, b) => (a === RAIZ ? -1 : b === RAIZ ? 1 : a.localeCompare(b, 'es')))
      .map((clave) => ({ carpeta: clave, items: porCarpeta.get(clave) ?? [] }))
  }, [recursos, carpetas])

  const abrir = (recurso: RecursoDTO): void => {
    void api.abrirMaterial(conceptoId, recurso.archivo).catch((e) => notificarError(e))
  }

  const procesarArchivos = async (archivos: FileList | null, carpeta: string): Promise<void> => {
    if (!archivos || archivos.length === 0) return
    const rutas = Array.from(archivos).map((a) => api.rutaDeArchivo(a))
    setOcupado(true)
    const concepto = await agregarMaterial(conceptoId, rutas, carpeta)
    setOcupado(false)
    if (concepto) {
      onActualizado(concepto)
      void cargarCarpetas()
    }
  }

  const alSoltar = (e: DragEvent, carpeta: string): void => {
    e.preventDefault()
    // Sin esto, soltar en una carpeta dispararía además el de la zona entera.
    e.stopPropagation()
    setArrastrando(null)
    void procesarArchivos(e.dataTransfer.files, carpeta)
  }

  const elegirArchivos = (carpeta: string): void => {
    destinoRef.current = carpeta
    inputRef.current?.click()
  }

  const confirmarEliminar = async (): Promise<void> => {
    if (!aEliminar) return
    const concepto = await eliminarMaterial(conceptoId, aEliminar.id)
    setAEliminar(null)
    if (concepto) onActualizado(concepto)
  }

  const crearCarpeta = async (): Promise<void> => {
    const nombre = nombreCarpeta.trim()
    if (!nombre) return
    try {
      setCarpetas(await api.crearCarpetaMaterial(conceptoId, nombre))
      setNombreCarpeta('')
      setCreandoCarpeta(false)
    } catch (error) {
      notificarError(error)
    }
  }

  const sinNada = recursos.length === 0 && carpetas.length === 0

  return (
    <div className="rounded-xl border border-slate-200">
      <input
        ref={inputRef}
        type="file"
        multiple
        accept={FORMATOS_ACEPTADOS}
        className="hidden"
        onChange={(e) => {
          void procesarArchivos(e.target.files, destinoRef.current)
          e.target.value = ''
        }}
      />

      {sinNada ? (
        <div
          onDragOver={(e) => {
            e.preventDefault()
            setArrastrando(RAIZ)
          }}
          onDragLeave={() => setArrastrando(null)}
          onDrop={(e) => alSoltar(e, RAIZ)}
          className={`flex flex-col items-center justify-center px-6 py-12 text-center transition ${
            arrastrando !== null ? 'bg-marca-50' : ''
          }`}
        >
          <div className="mb-2 text-3xl" aria-hidden>
            📎
          </div>
          <p className="text-sm font-medium text-slate-700">
            {arrastrando !== null ? 'Suelta para agregar' : 'Arrastra tus archivos aquí'}
          </p>
          <p className="mt-1 text-xs text-slate-400">PDF, PowerPoint, Word, Markdown, HTML o XML</p>
          <div className="mt-4 flex gap-2">
            <Boton variante="secundario" onClick={() => elegirArchivos(RAIZ)} disabled={ocupado}>
              {ocupado ? 'Agregando…' : 'Agregar material'}
            </Boton>
            <Boton variante="fantasma" onClick={() => setCreandoCarpeta(true)}>
              + Nueva carpeta
            </Boton>
          </div>
        </div>
      ) : (
        <div className="p-2">
          {secciones.map(({ carpeta, items }) => (
            <section
              key={carpeta || '(sin carpeta)'}
              onDragOver={(e) => {
                e.preventDefault()
                setArrastrando(carpeta)
              }}
              onDragLeave={() => setArrastrando(null)}
              onDrop={(e) => alSoltar(e, carpeta)}
              className={`mb-1 rounded-lg transition ${
                arrastrando === carpeta ? 'bg-marca-50 ring-1 ring-marca-300' : ''
              }`}
            >
              {carpeta !== RAIZ && (
                <div className="flex items-center gap-2 px-3 pt-2">
                  <span aria-hidden>📁</span>
                  <span className="flex-1 truncate text-xs font-semibold uppercase tracking-wide text-slate-500">
                    {carpeta}
                  </span>
                  <button
                    onClick={() => elegirArchivos(carpeta)}
                    className="text-xs text-slate-400 transition hover:text-marca-700"
                  >
                    + Agregar aquí
                  </button>
                </div>
              )}

              {items.length === 0 ? (
                <p className="px-3 py-2 text-xs text-slate-300">
                  {arrastrando === carpeta
                    ? 'Suelta aquí para guardarlo en esta carpeta'
                    : 'Carpeta vacía · arrastra archivos aquí'}
                </p>
              ) : (
                <ul className="divide-y divide-slate-100">
                  {items.map((recurso) => (
                    <li
                      key={recurso.id}
                      onContextMenu={(e) => abrirMenu(e, recurso)}
                      className="group flex items-center gap-3 px-3 py-2.5"
                    >
                      <span className="rounded bg-slate-100 px-2 py-0.5 text-xs font-semibold uppercase text-slate-500">
                        {recurso.formato}
                      </span>
                      <span className="flex-1 truncate text-sm text-slate-700">
                        {recurso.nombre}
                      </span>
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
              )}
            </section>
          ))}

          <div className="flex flex-wrap items-center justify-between gap-2 px-3 py-2">
            {creandoCarpeta ? (
              <NuevaCarpeta
                valor={nombreCarpeta}
                onCambiar={setNombreCarpeta}
                onCrear={() => void crearCarpeta()}
                onCancelar={() => setCreandoCarpeta(false)}
              />
            ) : (
              <>
                <Boton variante="fantasma" onClick={() => setCreandoCarpeta(true)}>
                  + Nueva carpeta
                </Boton>
                <Boton variante="fantasma" onClick={() => elegirArchivos(RAIZ)} disabled={ocupado}>
                  {ocupado ? 'Agregando…' : '+ Agregar material'}
                </Boton>
              </>
            )}
          </div>
        </div>
      )}

      {sinNada && creandoCarpeta && (
        <div className="border-t border-slate-100 px-3 py-2">
          <NuevaCarpeta
            valor={nombreCarpeta}
            onCambiar={setNombreCarpeta}
            onCrear={() => void crearCarpeta()}
            onCancelar={() => setCreandoCarpeta(false)}
          />
        </div>
      )}

      {menu && (
        <MenuContextual
          x={menu.x}
          y={menu.y}
          onCerrar={cerrarMenu}
          opciones={[
            { etiqueta: 'Abrir', icono: '↗', onElegir: () => abrir(menu.dato) },
            {
              etiqueta: 'Mover a otra carpeta…',
              icono: '→',
              onElegir: () => setAMover(menu.dato)
            },
            {
              etiqueta: 'Quitar',
              icono: '✕',
              destructiva: true,
              onElegir: () => setAEliminar(menu.dato)
            }
          ]}
        />
      )}

      {aMover && (
        <DialogoMover
          titulo="Mover el material a otra carpeta"
          queSeMueve={aMover.nombre}
          destinos={[
            {
              id: RAIZ,
              titulo: 'Sin carpeta',
              detalle: 'Suelto en el concepto',
              actual: !aMover.carpeta
            },
            ...carpetas.map((c) => ({ id: c, titulo: c, actual: aMover.carpeta === c }))
          ]}
          textoVacio="Crea una carpeta para poder mover aquí el material."
          onMover={async (destino) => {
            try {
              onActualizado(await api.moverMaterialACarpeta(conceptoId, aMover.id, destino))
              void cargarCarpetas()
            } catch (error) {
              notificarError(error)
            }
          }}
          onCerrar={() => setAMover(null)}
        />
      )}

      {aEliminar && (
        <DialogoConfirmacion
          titulo={`¿Quitar «${aEliminar.nombre}»?`}
          mensaje={`Se eliminará este material del concepto. ${avisoDeEliminacion(modoEliminacion)}`}
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

function NuevaCarpeta({
  valor,
  onCambiar,
  onCrear,
  onCancelar
}: {
  valor: string
  onCambiar: (v: string) => void
  onCrear: () => void
  onCancelar: () => void
}): JSX.Element {
  return (
    <div className="flex flex-1 items-center gap-2">
      <input
        autoFocus
        value={valor}
        onChange={(e) => onCambiar(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter') onCrear()
          if (e.key === 'Escape') onCancelar()
        }}
        placeholder="Nombre de la carpeta (ej. Lecturas)"
        maxLength={60}
        className="flex-1 rounded-lg border border-slate-300 px-3 py-1.5 text-sm outline-none focus:border-marca-500"
      />
      <Boton variante="primario" onClick={onCrear}>
        Crear
      </Boton>
      <Boton variante="secundario" onClick={onCancelar}>
        Cancelar
      </Boton>
    </div>
  )
}
