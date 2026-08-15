import { useCallback, useEffect, useMemo, useRef, useState, type DragEvent } from 'react'
import type { ConceptoDTO, EnlaceMaterialDTO, RecursoDTO } from '@shared/dtos'
import { Boton } from '../../components/Boton'
import { DialogoConfirmacion } from '../../components/DialogoConfirmacion'
import { DialogoMover } from '../../components/DialogoMover'
import {
  MenuContextual,
  useMenuContextual,
  type OpcionMenu
} from '../../components/MenuContextual'
import { api } from '../../lib/api'
import { empezarArrastreDe, leerArrastre } from '../lienzo/arrastreAlLienzo'
import { useConceptosStore } from '../../stores/conceptosStore'
import { useUiStore } from '../../stores/uiStore'
import {
  avisoDeEliminacion,
  useEliminacionStore
} from '../../stores/eliminacionStore'
import { DialogoEnlace } from './DialogoEnlace'
import { PREVISUALIZABLES, VistaPreviaMaterial } from './VistaPreviaMaterial'

const FORMATOS_ACEPTADOS = '.pdf,.pptx,.docx,.md,.html,.xml'

/** Clave de la sección "sin carpeta", que siempre va primero. */
const RAIZ = ''

/**
 * Una fila de la lista: un archivo del vault o un enlace web.
 *
 * Van juntos a propósito. Para el docente, un vídeo de YouTube es material
 * igual que un PDF, y separarlos en dos listas le obligaría a buscar en dos
 * sitios "lo que tengo de este concepto".
 */
type ItemMaterial =
  | { clase: 'archivo'; recurso: RecursoDTO }
  | { clase: 'enlace'; enlace: EnlaceMaterialDTO }

/** Completa la dirección para el navegador (el docente no teclea el esquema). */
function direccionCompleta(url: string): string {
  return /^https?:\/\//i.test(url) ? url : `https://${url}`
}

interface Props {
  conceptoId: string
  recursos: RecursoDTO[]
  enlaces: EnlaceMaterialDTO[]
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
 *
 * Los enlaces web se listan aquí mismo, pero no son archivos: su "carpeta" es
 * solo una etiqueta guardada en `concepto.yaml`. Por eso se mueven desde el
 * menú del clic derecho y no arrastrándolos: no hay nada que mover en disco.
 */
export function ZonaMaterial({
  conceptoId,
  recursos,
  enlaces,
  onActualizado
}: Props): JSX.Element {
  const modoEliminacion = useEliminacionStore((s) => s.modo)
  // Qué carpeta está resaltada al arrastrar (null = ninguna).
  const [arrastrando, setArrastrando] = useState<string | null>(null)
  const [ocupado, setOcupado] = useState(false)
  const [aEliminar, setAEliminar] = useState<RecursoDTO | null>(null)
  const [enlaceAEliminar, setEnlaceAEliminar] = useState<EnlaceMaterialDTO | null>(null)
  const [aVer, setAVer] = useState<RecursoDTO | null>(null)
  const [aMover, setAMover] = useState<ItemMaterial | null>(null)
  const [carpetas, setCarpetas] = useState<string[]>([])
  const [creandoCarpeta, setCreandoCarpeta] = useState(false)
  /** Enlace en edición, o la carpeta destino si se está creando uno nuevo. */
  const [editandoEnlace, setEditandoEnlace] = useState<
    { enlace: EnlaceMaterialDTO } | { carpeta: string } | null
  >(null)
  /** Carpetas desplegadas. Empiezan cerradas: el panel del lienzo es estrecho
   *  y con varias carpetas abiertas no se ve nada de un vistazo. */
  const [abiertas, setAbiertas] = useState<Set<string>>(new Set())
  const [nombreCarpeta, setNombreCarpeta] = useState('')
  /** Carpeta destino del selector nativo (no cabe en su evento). */
  const destinoRef = useRef<string>(RAIZ)
  const inputRef = useRef<HTMLInputElement>(null)

  const agregarMaterial = useConceptosStore((s) => s.agregarMaterial)
  const eliminarMaterial = useConceptosStore((s) => s.eliminarMaterial)
  const reflejarMaterial = useConceptosStore((s) => s.reflejarMaterial)
  const notificarError = useUiStore((s) => s.notificarError)
  const { menu, abrir: abrirMenu, cerrar: cerrarMenu } = useMenuContextual<ItemMaterial>()
  // Menú de "+ Agregar material": elegir entre un archivo del equipo y un enlace.
  const {
    menu: menuAgregar,
    abrir: abrirMenuAgregar,
    cerrar: cerrarMenuAgregar
  } = useMenuContextual<string>()

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
    const porCarpeta = new Map<string, ItemMaterial[]>([[RAIZ, []]])
    for (const c of carpetas) porCarpeta.set(c, [])
    const meter = (clave: string, item: ItemMaterial): void => {
      porCarpeta.set(clave, [...(porCarpeta.get(clave) ?? []), item])
    }
    for (const r of recursos) meter(r.carpeta || RAIZ, { clase: 'archivo', recurso: r })
    // Los enlaces van después de los archivos de su carpeta: el material
    // descargado es lo que el docente abre más a menudo.
    for (const e of enlaces) meter(e.carpeta || RAIZ, { clase: 'enlace', enlace: e })
    return [...porCarpeta.keys()]
      .sort((a, b) => (a === RAIZ ? -1 : b === RAIZ ? 1 : a.localeCompare(b, 'es')))
      .map((clave) => ({ carpeta: clave, items: porCarpeta.get(clave) ?? [] }))
  }, [recursos, enlaces, carpetas])

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

    // Dos arrastres distintos caen en el mismo sitio y NO deben confundirse:
    // uno trae archivos del sistema (añadir material) y otro un material que
    // ya está en el concepto (moverlo de carpeta). Se distinguen por el tipo
    // que lleva el arrastre, no por adivinar.
    const interno = leerArrastre(e)
    if (interno && interno.tipo === 'material' && interno.conceptoId === conceptoId) {
      void moverACarpeta(interno.archivo, carpeta)
      return
    }
    void procesarArchivos(e.dataTransfer.files, carpeta)
  }

  /** Mueve un material ya existente a otra carpeta del mismo concepto. */
  const moverACarpeta = async (archivo: string, carpeta: string): Promise<void> => {
    const recurso = recursos.find((r) => r.archivo === archivo)
    if (!recurso || (recurso.carpeta || '') === carpeta) return
    try {
      onActualizado(await api.moverMaterialACarpeta(conceptoId, recurso.id, carpeta))
      void cargarCarpetas()
    } catch (error) {
      notificarError(error)
    }
  }

  const elegirArchivos = (carpeta: string): void => {
    destinoRef.current = carpeta
    inputRef.current?.click()
  }

  /** Opciones de "+ Agregar material": del equipo o de la web. */
  const opcionesAgregar = (carpeta: string): OpcionMenu[] => [
    {
      etiqueta: 'Un archivo de mi equipo…',
      icono: '📄',
      onElegir: () => elegirArchivos(carpeta)
    },
    {
      etiqueta: 'Un enlace a una página web…',
      icono: '🔗',
      onElegir: () => setEditandoEnlace({ carpeta })
    }
  ]

  /** Opciones del clic derecho sobre una fila (distintas para archivo y enlace). */
  const opcionesDeItem = (item: ItemMaterial): OpcionMenu[] =>
    item.clase === 'archivo'
      ? [
          { etiqueta: 'Abrir', icono: '↗', onElegir: () => abrir(item.recurso) },
          { etiqueta: 'Mover a otra carpeta…', icono: '→', onElegir: () => setAMover(item) },
          {
            etiqueta: 'Quitar',
            icono: '✕',
            destructiva: true,
            onElegir: () => setAEliminar(item.recurso)
          }
        ]
      : [
          {
            etiqueta: 'Editar el enlace…',
            icono: '✎',
            onElegir: () => setEditandoEnlace({ enlace: item.enlace })
          },
          { etiqueta: 'Mover a otra carpeta…', icono: '→', onElegir: () => setAMover(item) },
          {
            etiqueta: 'Quitar',
            icono: '✕',
            destructiva: true,
            onElegir: () => setEnlaceAEliminar(item.enlace)
          }
        ]

  const guardarEnlace = async (datos: { titulo: string; url: string }): Promise<void> => {
    if (!editandoEnlace) return
    try {
      const concepto =
        'enlace' in editandoEnlace
          ? await api.editarEnlaceMaterial(conceptoId, editandoEnlace.enlace.id, datos)
          : await api.agregarEnlaceMaterial(conceptoId, {
              ...datos,
              carpeta: editandoEnlace.carpeta
            })
      onActualizado(concepto)
      reflejarMaterial(concepto)
      setEditandoEnlace(null)
    } catch (error) {
      notificarError(error)
    }
  }

  const confirmarEliminar = async (): Promise<void> => {
    if (!aEliminar) return
    const concepto = await eliminarMaterial(conceptoId, aEliminar.id)
    setAEliminar(null)
    if (concepto) onActualizado(concepto)
  }

  const confirmarEliminarEnlace = async (): Promise<void> => {
    if (!enlaceAEliminar) return
    try {
      const concepto = await api.eliminarEnlaceMaterial(conceptoId, enlaceAEliminar.id)
      onActualizado(concepto)
      reflejarMaterial(concepto)
    } catch (error) {
      notificarError(error)
    } finally {
      setEnlaceAEliminar(null)
    }
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

  const sinNada = recursos.length === 0 && enlaces.length === 0 && carpetas.length === 0

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
          <p className="mt-1 text-xs text-slate-400">
            PDF, PowerPoint, Word, Markdown, HTML o XML — o guarda un enlace a una página web
          </p>
          <div className="mt-4 flex flex-wrap justify-center gap-2">
            <Boton variante="secundario" onClick={() => elegirArchivos(RAIZ)} disabled={ocupado}>
              {ocupado ? 'Agregando…' : 'Agregar material'}
            </Boton>
            <Boton variante="secundario" onClick={() => setEditandoEnlace({ carpeta: RAIZ })}>
              🔗 Agregar un enlace
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
                  <button
                    onClick={() =>
                      setAbiertas((s) => {
                        const n = new Set(s)
                        n.has(carpeta) ? n.delete(carpeta) : n.add(carpeta)
                        return n
                      })
                    }
                    className="flex min-w-0 flex-1 items-center gap-2 text-left"
                  >
                    <span aria-hidden className="text-slate-400">
                      {abiertas.has(carpeta) ? '▾' : '▸'}
                    </span>
                    <span aria-hidden>📁</span>
                    <span className="truncate text-xs font-semibold uppercase tracking-wide text-slate-500">
                      {carpeta}
                    </span>
                    <span className="text-xs text-slate-400">{items.length}</span>
                  </button>
                  <button
                    onClick={(e) => abrirMenuAgregar(e, carpeta)}
                    className="text-xs text-slate-400 transition hover:text-marca-700"
                  >
                    + Agregar aquí
                  </button>
                </div>
              )}

              {carpeta !== RAIZ && !abiertas.has(carpeta) ? (
                // Cerrada: sigue siendo zona de destino, para poder soltarle
                // algo sin tener que abrirla antes.
                <p className="px-3 py-1.5 text-xs text-slate-300">
                  {arrastrando === carpeta ? 'Suelta aquí para guardarlo dentro' : ''}
                </p>
              ) : items.length === 0 ? (
                <p className="px-3 py-2 text-xs text-slate-300">
                  {arrastrando === carpeta
                    ? 'Suelta aquí para guardarlo en esta carpeta'
                    : 'Carpeta vacía · arrastra archivos aquí'}
                </p>
              ) : (
                <ul className="divide-y divide-slate-100">
                  {items.map((item) =>
                    item.clase === 'archivo' ? (
                      <li
                        key={item.recurso.id}
                        // Arrastrable: si hay un lienzo abierto, soltarlo allí
                        // crea su tarjeta. Fuera del lienzo no molesta.
                        draggable
                        onDragStart={(e) =>
                          empezarArrastreDe(e, {
                            tipo: 'material',
                            conceptoId,
                            archivo: item.recurso.archivo
                          })
                        }
                        onContextMenu={(e) => abrirMenu(e, item)}
                        className="group flex cursor-grab items-center gap-3 px-3 py-2.5 active:cursor-grabbing"
                      >
                        <span className="rounded bg-slate-100 px-2 py-0.5 text-xs font-semibold uppercase text-slate-500">
                          {item.recurso.formato}
                        </span>
                        <span className="flex-1 truncate text-sm text-slate-700">
                          {item.recurso.nombre}
                        </span>
                        {PREVISUALIZABLES.includes(item.recurso.formato) && (
                          <button
                            onClick={() => setAVer(item.recurso)}
                            className="text-xs text-slate-500 transition hover:text-marca-700"
                          >
                            Ver
                          </button>
                        )}
                        <button
                          onClick={() => abrir(item.recurso)}
                          className="text-xs text-slate-500 transition hover:text-marca-700"
                        >
                          Abrir
                        </button>
                        <button
                          onClick={() => setAEliminar(item.recurso)}
                          className="text-slate-400 transition hover:text-red-600"
                          aria-label={`Quitar ${item.recurso.nombre}`}
                        >
                          ✕
                        </button>
                      </li>
                    ) : (
                      <li
                        key={item.enlace.id}
                        onContextMenu={(e) => abrirMenu(e, item)}
                        className="group flex items-center gap-3 px-3 py-2.5"
                      >
                        <span className="rounded bg-sky-100 px-2 py-0.5 text-xs font-semibold uppercase text-sky-800">
                          web
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-sm text-slate-700">
                            {item.enlace.titulo}
                          </span>
                          {item.enlace.titulo !== item.enlace.url && (
                            <span className="block truncate text-xs text-slate-400">
                              {item.enlace.url.replace(/^https?:\/\//i, '')}
                            </span>
                          )}
                        </span>
                        {/* Un ancla y no un botón: la ventana ya manda a fuera
                            todo lo que se abre en pestaña nueva. */}
                        <a
                          href={direccionCompleta(item.enlace.url)}
                          target="_blank"
                          rel="noreferrer"
                          className="text-xs text-slate-500 transition hover:text-marca-700"
                        >
                          Abrir
                        </a>
                        <button
                          onClick={() => setEnlaceAEliminar(item.enlace)}
                          className="text-slate-400 transition hover:text-red-600"
                          aria-label={`Quitar ${item.enlace.titulo}`}
                        >
                          ✕
                        </button>
                      </li>
                    )
                  )}
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
                <Boton
                  variante="fantasma"
                  onClick={(e) => abrirMenuAgregar(e, RAIZ)}
                  disabled={ocupado}
                >
                  {ocupado ? 'Agregando…' : '+ Agregar material ▾'}
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

      {menuAgregar && (
        <MenuContextual
          x={menuAgregar.x}
          y={menuAgregar.y}
          onCerrar={cerrarMenuAgregar}
          opciones={opcionesAgregar(menuAgregar.dato)}
        />
      )}

      {menu && (
        <MenuContextual
          x={menu.x}
          y={menu.y}
          onCerrar={cerrarMenu}
          opciones={opcionesDeItem(menu.dato)}
        />
      )}

      {aMover && (
        <DialogoMover
          titulo={
            aMover.clase === 'archivo'
              ? 'Mover el material a otra carpeta'
              : 'Mover el enlace a otra carpeta'
          }
          queSeMueve={aMover.clase === 'archivo' ? aMover.recurso.nombre : aMover.enlace.titulo}
          destinos={[
            {
              id: RAIZ,
              titulo: 'Sin carpeta',
              detalle: 'Suelto en el concepto',
              actual:
                aMover.clase === 'archivo' ? !aMover.recurso.carpeta : !aMover.enlace.carpeta
            },
            ...carpetas.map((c) => ({
              id: c,
              titulo: c,
              actual:
                aMover.clase === 'archivo'
                  ? aMover.recurso.carpeta === c
                  : aMover.enlace.carpeta === c
            }))
          ]}
          textoVacio="Crea una carpeta para poder mover aquí el material."
          onMover={async (destino) => {
            try {
              onActualizado(
                aMover.clase === 'archivo'
                  ? await api.moverMaterialACarpeta(conceptoId, aMover.recurso.id, destino)
                  : await api.moverEnlaceACarpeta(conceptoId, aMover.enlace.id, destino)
              )
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

      {enlaceAEliminar && (
        <DialogoConfirmacion
          titulo={`¿Quitar «${enlaceAEliminar.titulo}»?`}
          // Aquí no cabe el aviso de la papelera: no se borra ningún archivo,
          // solo se olvida la dirección. La página sigue donde estaba.
          mensaje="Se quitará este enlace del material del concepto. La página web no se toca."
          textoConfirmar="Quitar"
          onConfirmar={confirmarEliminarEnlace}
          onCancelar={() => setEnlaceAEliminar(null)}
        />
      )}

      {editandoEnlace && (
        <DialogoEnlace
          enlace={'enlace' in editandoEnlace ? editandoEnlace.enlace : null}
          carpeta={'carpeta' in editandoEnlace ? editandoEnlace.carpeta : undefined}
          onGuardar={guardarEnlace}
          onCerrar={() => setEditandoEnlace(null)}
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
