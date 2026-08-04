import { useEffect, useMemo, useState, type RefObject } from 'react'
import { enlaceEnCurso, normalizarNombre } from '../lib/enlacesWiki'
import { useConceptosStore } from '../stores/conceptosStore'

/**
 * Autocompletado de `[[enlaces]]` mientras se escribe en un área de texto.
 *
 * Se engancha a un `<textarea>` normal en vez de montar un editor enriquecido:
 * el contenido debe seguir siendo texto plano que se guarda tal cual en el
 * YAML del vault y que Obsidian entendería. Un editor WYSIWYG obligaría a
 * serializar de vuelta y rompería esa garantía.
 */
export function SugerenciasEnlace({
  areaRef,
  texto,
  onCambiar
}: {
  areaRef: RefObject<HTMLTextAreaElement>
  texto: string
  onCambiar: (nuevo: string) => void
}): JSX.Element | null {
  const conceptos = useConceptosStore((s) => s.lista)
  const crearConcepto = useConceptosStore((s) => s.crear)
  const [cursor, setCursor] = useState(0)
  const [resaltado, setResaltado] = useState(0)
  const [creando, setCreando] = useState(false)

  // El cursor no provoca renders por sí solo: hay que sondearlo en los eventos
  // que sí lo mueven.
  useEffect(() => {
    const area = areaRef.current
    if (!area) return
    const sincronizar = (): void => setCursor(area.selectionStart)
    for (const evento of ['keyup', 'click', 'input', 'focus'] as const) {
      area.addEventListener(evento, sincronizar)
    }
    return () => {
      for (const evento of ['keyup', 'click', 'input', 'focus'] as const) {
        area.removeEventListener(evento, sincronizar)
      }
    }
  }, [areaRef])

  const enCurso = useMemo(() => enlaceEnCurso(texto, cursor), [texto, cursor])

  const candidatos = useMemo(() => {
    if (!enCurso) return []
    const q = normalizarNombre(enCurso.consulta)
    return conceptos
      .filter((c) => !q || normalizarNombre(c.nombre).includes(q))
      .slice(0, 6)
  }, [conceptos, enCurso])

  useEffect(() => setResaltado(0), [enCurso?.consulta])

  if (!enCurso) return null

  const consulta = enCurso.consulta.trim()
  const coincideExacto = conceptos.some(
    (c) => normalizarNombre(c.nombre) === normalizarNombre(consulta)
  )

  /** Cierra el `[[` en curso con el nombre elegido y deja el cursor detrás. */
  const elegir = (nombre: string): void => {
    const antes = texto.slice(0, enCurso.desde)
    const despues = texto.slice(cursor)
    const insertado = `[[${nombre}]]`
    onCambiar(antes + insertado + despues)
    const pos = enCurso.desde + insertado.length
    requestAnimationFrame(() => {
      const area = areaRef.current
      if (!area) return
      area.focus()
      area.setSelectionRange(pos, pos)
      setCursor(pos)
    })
  }

  /** Crear el concepto que falta sin salir de la nota (patrón ya usado al vincular). */
  const crearYEnlazar = async (): Promise<void> => {
    setCreando(true)
    const creado = await crearConcepto({ nombre: consulta })
    setCreando(false)
    if (creado) elegir(creado.nombre)
  }

  if (candidatos.length === 0 && !consulta) return null

  return (
    <div className="absolute z-30 mt-1 w-72 overflow-hidden rounded-lg border border-slate-200 bg-white shadow-lg">
      <p className="border-b border-slate-100 px-3 py-1.5 text-xs text-slate-400">
        Enlazar a un concepto
      </p>
      <ul className="max-h-56 overflow-auto">
        {candidatos.map((c, i) => (
          <li key={c.id}>
            <button
              type="button"
              // `onMouseDown` y no `onClick`: el clic quitaría antes el foco del
              // área de texto y se perdería la posición del cursor.
              onMouseDown={(e) => {
                e.preventDefault()
                elegir(c.nombre)
              }}
              onMouseEnter={() => setResaltado(i)}
              className={`block w-full px-3 py-2 text-left text-sm ${
                i === resaltado ? 'bg-marca-50 text-marca-800' : 'text-slate-700'
              }`}
            >
              {c.nombre}
            </button>
          </li>
        ))}
      </ul>
      {consulta && !coincideExacto && (
        <button
          type="button"
          disabled={creando}
          onMouseDown={(e) => {
            e.preventDefault()
            void crearYEnlazar()
          }}
          className="block w-full border-t border-slate-100 px-3 py-2 text-left text-sm text-marca-700 hover:bg-marca-50 disabled:text-slate-400"
        >
          {creando ? 'Creando…' : `+ Crear el concepto «${consulta}»`}
        </button>
      )}
    </div>
  )
}
