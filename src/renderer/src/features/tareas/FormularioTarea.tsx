import { useMemo, useRef, useState, type ClipboardEvent, type FormEvent } from 'react'
import { marked } from 'marked'
import type { AsignaturaDTO, FormatoInstrucciones, TareaDTO } from '@shared/dtos'
import { Boton } from '../../components/Boton'
import { CampoTexto } from '../../components/Campos'
import { Modal } from '../../components/Modal'
import { VistaCodigo } from '../../components/VistaCodigo'
import { VistaHtml } from '../../components/VistaHtml'
import { api } from '../../lib/api'
import { manejarPegadoRico } from '../../lib/pegadoRico'
import { useTareasStore } from '../../stores/tareasStore'
import { HerramientasTexto } from '../../components/HerramientasTexto'
import { BuscadorConceptos } from '../vinculos/BuscadorConceptos'
import { useConceptosStore } from '../../stores/conceptosStore'

interface Props {
  asignatura: AsignaturaDTO
  tareaInicial?: TareaDTO
  temaPreseleccionado?: string
  temasPreseleccionados?: string[]
  /** Conceptos ya vinculados al abrir (crear la práctica DE un concepto). */
  conceptosPreseleccionados?: string[]
  /** Título de partida, editable (al crear desde un concepto). */
  tituloInicial?: string
  onCerrar: () => void
  onGuardada: (tarea: TareaDTO) => void
}

export function FormularioTarea({
  asignatura,
  tareaInicial,
  temaPreseleccionado,
  temasPreseleccionados,
  conceptosPreseleccionados,
  tituloInicial,
  onCerrar,
  onGuardada
}: Props): JSX.Element {
  const editando = tareaInicial !== undefined
  // En un espacio de aprendizaje no hay asignatura y las tareas son "prácticas".
  const esAprendizaje = asignatura.tipo === 'aprendizaje'
  const crear = useTareasStore((s) => s.crear)
  const editar = useTareasStore((s) => s.editar)
  const agregarAdjunto = useTareasStore((s) => s.agregarAdjunto)

  const [titulo, setTitulo] = useState(tareaInicial?.titulo ?? tituloInicial ?? '')
  const [componente, setComponente] = useState<string>(tareaInicial?.componente ?? '')
  const [temas, setTemas] = useState<Set<string>>(
    () =>
      new Set(
        tareaInicial?.temas ??
          temasPreseleccionados ??
          (temaPreseleccionado ? [temaPreseleccionado] : [])
      )
  )
  // Conceptos vinculados a mano. Los que vienen de los temas se muestran aparte
  // y no se tocan: quitarlos aquí sería mentir sobre lo que el tema declara.
  const [conceptosPropios, setConceptosPropios] = useState<string[]>(
    () => tareaInicial?.conceptosPropios ?? conceptosPreseleccionados ?? []
  )
  const [buscandoConcepto, setBuscandoConcepto] = useState(false)
  const listaConceptos = useConceptosStore((st) => st.lista)
  const conceptoPorId = useMemo(
    () => new Map(listaConceptos.map((c) => [c.id, c] as const)),
    [listaConceptos]
  )
  const [instrucciones, setInstrucciones] = useState(tareaInicial?.instrucciones ?? '')
  const [formato, setFormato] = useState<FormatoInstrucciones>(tareaInicial?.formato ?? 'markdown')
  const [enlaces, setEnlaces] = useState<{ url: string; titulo: string }[]>(
    () => tareaInicial?.enlaces.map((e) => ({ url: e.url, titulo: e.titulo })) ?? []
  )
  const [archivos, setArchivos] = useState<File[]>([])
  const inputArchivos = useRef<HTMLInputElement>(null)
  const [previa, setPrevia] = useState(false)
  const [ocupado, setOcupado] = useState(false)
  const areaRef = useRef<HTMLTextAreaElement>(null)

  /**
   * Conceptos que ya trae la tarea por sus temas (y por los subtemas de esos
   * temas). Se enseñan para que el docente no vuelva a añadir lo que ya está.
   */
  const derivados = useMemo(() => {
    const ids = new Set<string>()
    for (const u of asignatura.unidades) {
      for (const t of u.temas) {
        if (!temas.has(t.id)) continue
        for (const c of t.conceptos) ids.add(c)
        for (const sub of t.subtemas) for (const c of sub.conceptos) ids.add(c)
      }
    }
    return [...ids]
  }, [asignatura, temas])

  /** Al pegar: imágenes → base64 autocontenido; HTML con formato → Markdown/HTML. */
  const alPegar = (e: ClipboardEvent<HTMLTextAreaElement>): void =>
    manejarPegadoRico(e, { formato, ref: areaRef, setValor: setInstrucciones })

  const alternarTema = (id: string): void =>
    setTemas((prev) => {
      const s = new Set(prev)
      s.has(id) ? s.delete(id) : s.add(id)
      return s
    })

  const guardar = async (e: FormEvent): Promise<void> => {
    e.preventDefault()
    if (titulo.trim().length === 0 || temas.size === 0) return
    setOcupado(true)
    const datos = {
      titulo: titulo.trim(),
      instrucciones,
      formato,
      asignaturaId: asignatura.id,
      temas: [...temas],
      componente: componente || null,
      conceptosPropios,
      enlaces: enlaces.filter((e) => e.url.trim().length > 0)
    }
    let tarea = editando ? await editar(tareaInicial.id, datos) : await crear(datos)
    // Adjunta los archivos seleccionados a la tarea ya creada/actualizada.
    if (tarea && archivos.length > 0) {
      const conAdjuntos = await agregarAdjunto(tarea.id, archivos.map((a) => api.rutaDeArchivo(a)))
      if (conAdjuntos) tarea = conAdjuntos
    }
    setOcupado(false)
    if (tarea) {
      onGuardada(tarea)
      onCerrar()
    }
  }

  return (
    <Modal
      titulo={
        editando
          ? esAprendizaje
            ? 'Editar práctica'
            : 'Editar tarea'
          : esAprendizaje
            ? 'Nueva práctica'
            : 'Nueva tarea'
      }
      ancho="xl"
      onCerrar={onCerrar}
    >
      <form onSubmit={guardar} className="space-y-4">
        <CampoTexto
          etiqueta="Título"
          placeholder="Ej. Taller de recursión"
          value={titulo}
          onChange={(e) => setTitulo(e.target.value)}
          autoFocus
        />

        {/* Temas */}
        <div>
          <span className="mb-1.5 block text-sm font-medium text-slate-700">Temas</span>
          <div className="max-h-40 space-y-2 overflow-y-auto rounded-lg border border-slate-200 p-3">
            {asignatura.unidades.map((u) => (
              <div key={u.id}>
                {!esAprendizaje && (
                  <p className="text-xs font-semibold text-slate-400">{u.titulo}</p>
                )}
                {u.temas.map((t) => (
                  <label key={t.id} className="flex items-center gap-2 py-0.5 text-sm text-slate-700">
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
            {asignatura.unidades.length === 0 && (
              <p className="text-xs text-slate-400">
                {esAprendizaje
                  ? 'Este espacio no tiene temas todavía.'
                  : 'Esta asignatura no tiene temas todavía.'}
              </p>
            )}
          </div>
        </div>

        {/* Conceptos: los que trae el tema, más los que se vinculen aquí */}
        <div>
          <span className="mb-1.5 block text-sm font-medium text-slate-700">Conceptos</span>
          <div className="flex flex-wrap items-center gap-1.5 rounded-lg border border-slate-200 p-2.5">
            {derivados.map((id) => (
              <span
                key={id}
                title="Viene del tema. Se quita desvinculándolo del tema."
                className="rounded-full bg-slate-100 px-2.5 py-0.5 text-xs text-slate-600"
              >
                {conceptoPorId.get(id)?.nombre ?? id}
                <span className="ml-1 text-slate-400">del tema</span>
              </span>
            ))}
            {conceptosPropios
              .filter((id) => !derivados.includes(id))
              .map((id) => (
                <span
                  key={id}
                  className="inline-flex items-center gap-1 rounded-full bg-marca-50 py-0.5 pl-2.5 pr-1 text-xs font-medium text-marca-700"
                >
                  {conceptoPorId.get(id)?.nombre ?? id}
                  <button
                    type="button"
                    onClick={() => setConceptosPropios((c) => c.filter((x) => x !== id))}
                    aria-label={`Quitar ${conceptoPorId.get(id)?.nombre ?? id}`}
                    className="text-marca-400 transition hover:text-red-600"
                  >
                    ✕
                  </button>
                </span>
              ))}
            <span className="relative">
              <button
                type="button"
                onClick={() => setBuscandoConcepto((v) => !v)}
                className="rounded-full border border-dashed border-slate-300 px-2.5 py-0.5 text-xs text-slate-500 transition hover:border-marca-300 hover:text-marca-700"
              >
                + Vincular concepto
              </button>
              {buscandoConcepto && (
                <BuscadorConceptos
                  excluir={[...new Set([...derivados, ...conceptosPropios])]}
                  onSeleccionar={(id) => {
                    setConceptosPropios((c) => (c.includes(id) ? c : [...c, id]))
                    setBuscandoConcepto(false)
                  }}
                  onCerrar={() => setBuscandoConcepto(false)}
                />
              )}
            </span>
          </div>
          <span className="mt-1 block text-xs text-slate-400">
            Los de sus temas se añaden solos. Vincula aquí lo que además ejercita.
          </span>
        </div>

        {/* Componente: solo si la asignatura tiene alguno definido. En un espacio
            de aprendizaje no los hay, y un desplegable con una sola opción
            («General») no decide nada: solo estorba. */}
        {asignatura.componentes.length > 0 && (
          <label className="block">
            <span className="mb-1.5 block text-sm font-medium text-slate-700">
              Componente de aprendizaje (opcional)
            </span>
            <select
              value={componente}
              onChange={(e) => setComponente(e.target.value)}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-marca-500 focus:ring-2 focus:ring-marca-100"
            >
              <option value="">Sin clasificar</option>
              {asignatura.componentes.map((c) => (
                <option key={c.clave} value={c.clave}>
                  {c.clave} · {c.nombre}
                </option>
              ))}
            </select>
            <span className="mt-1 block text-xs text-slate-400">
              Agrupa las tareas por el componente al que cuentan.
            </span>
          </label>
        )}

        {/* Instrucciones (Markdown) */}
        <div>
          <div className="mb-1.5 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium text-slate-700">Instrucciones</span>
              <div className="inline-flex overflow-hidden rounded-md border border-slate-200 text-xs">
                {(['markdown', 'html', 'codigo'] as const).map((f) => (
                  <button
                    key={f}
                    type="button"
                    onClick={() => setFormato(f)}
                    className={`px-2 py-0.5 transition ${
                      formato === f ? 'bg-marca-600 text-white' : 'bg-white text-slate-600 hover:bg-slate-50'
                    }`}
                  >
                    {f === 'markdown' ? 'Markdown' : f === 'html' ? 'HTML' : 'Código'}
                  </button>
                ))}
              </div>
            </div>
            <button
              type="button"
              onClick={() => setPrevia((p) => !p)}
              className="text-xs text-marca-600 hover:text-marca-700"
            >
              {previa ? 'Editar' : 'Vista previa'}
            </button>
          </div>
          {previa ? (
            formato === 'html' ? (
              // Mismo visor que la ficha ya guardada: lo que ves aquí es
              // exactamente lo que verás al guardar, incrustados incluidos.
              <VistaHtml
                titulo="Vista previa"
                html={
                  instrucciones || '<p style="color:#94a3b8;font-family:sans-serif">Sin contenido</p>'
                }
                className="min-h-[12rem]"
              />
            ) : formato === 'codigo' ? (
              <VistaCodigo texto={instrucciones || '// Sin contenido'} />
            ) : (
              <div
                className="markdown-preview min-h-[8rem] rounded-lg border border-slate-200 bg-slate-50 p-3"
                dangerouslySetInnerHTML={{ __html: marked.parse(instrucciones || '_Sin contenido_') as string }}
              />
            )
          ) : (
            <>
              {/* Las mismas herramientas que al escribir una nota de concepto:
                  una sola barra que aprender. */}
              <HerramientasTexto
                formato={formato}
                areaRef={areaRef}
                valor={instrucciones}
                onCambiar={setInstrucciones}
              />
              <textarea
                ref={areaRef}
                value={instrucciones}
                onChange={(e) => setInstrucciones(e.target.value)}
                onPaste={alPegar}
                placeholder={
                  formato === 'html'
                    ? 'Escribe o pega HTML (con <style> y <script> si lo necesitas). Se sube tal cual a Moodle.'
                    : 'Escribe o PEGA desde Word/web: títulos, párrafos, listas, tablas y rúbrica se convierten a formato automáticamente. Los enlaces también.'
                }
                rows={10}
                className="w-full resize-none rounded-lg border border-slate-300 px-3 py-2 font-mono text-sm outline-none focus:border-marca-500 focus:ring-2 focus:ring-marca-100"
              />
              <p className="mt-1 text-xs text-slate-400">
                {formato === 'html'
                  ? 'El HTML se guarda tal cual; la vista previa se ejecuta aislada (sandbox). Las imágenes pegadas se incrustan (base64).'
                  : 'Pega contenido con formato y se convierte solo; las imágenes se incrustan (base64). Usa «Vista previa» para verlo.'}
              </p>
            </>
          )}
        </div>

        {/* Archivos base (adjuntos) */}
        <div>
          <div className="mb-1.5 flex items-center justify-between">
            <span className="text-sm font-medium text-slate-700">Archivos base</span>
            <button
              type="button"
              onClick={() => inputArchivos.current?.click()}
              className="text-xs text-marca-600 hover:text-marca-700"
            >
              + Añadir archivos
            </button>
          </div>
          <input
            ref={inputArchivos}
            type="file"
            multiple
            className="hidden"
            onChange={(e) => {
              const nuevos = Array.from(e.target.files ?? [])
              if (nuevos.length) setArchivos((prev) => [...prev, ...nuevos])
              e.target.value = ''
            }}
          />
          {editando && tareaInicial.recursos.length > 0 && (
            <p className="mb-1 text-xs text-slate-400">
              Ya adjuntos: {tareaInicial.recursos.map((r) => r.nombre).join(', ')} (se gestionan en la ficha).
            </p>
          )}
          {archivos.length === 0 ? (
            <p className="text-xs text-slate-400">
              Archivos que el estudiante necesita para desarrollar la tarea. Opcional.
            </p>
          ) : (
            <ul className="flex flex-wrap gap-1.5">
              {archivos.map((a, i) => (
                <li
                  key={i}
                  className="flex items-center gap-1.5 rounded-full bg-slate-100 px-2.5 py-1 text-xs text-slate-700"
                >
                  <span className="max-w-[12rem] truncate">📎 {a.name}</span>
                  <button
                    type="button"
                    onClick={() => setArchivos((prev) => prev.filter((_, j) => j !== i))}
                    className="text-slate-400 transition hover:text-red-600"
                    aria-label="Quitar archivo"
                  >
                    ✕
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* Recursos online (enlaces con título) */}
        <div>
          <div className="mb-1.5 flex items-center justify-between">
            <span className="text-sm font-medium text-slate-700">Recursos online</span>
            <button
              type="button"
              onClick={() => setEnlaces((e) => [...e, { url: '', titulo: '' }])}
              className="text-xs text-marca-600 hover:text-marca-700"
            >
              + Añadir enlace
            </button>
          </div>
          {enlaces.length === 0 ? (
            <p className="text-xs text-slate-400">
              Enlaces que el estudiante puede consultar (documentación, videos…). Opcional.
            </p>
          ) : (
            <div className="space-y-2">
              {enlaces.map((e, i) => (
                <div key={i} className="flex items-center gap-2">
                  <input
                    value={e.titulo}
                    onChange={(ev) =>
                      setEnlaces((prev) => prev.map((x, j) => (j === i ? { ...x, titulo: ev.target.value } : x)))
                    }
                    placeholder="Título (ej. Documentación)"
                    className="w-2/5 rounded-lg border border-slate-300 px-3 py-1.5 text-sm outline-none focus:border-marca-500 focus:ring-2 focus:ring-marca-100"
                  />
                  <input
                    value={e.url}
                    onChange={(ev) =>
                      setEnlaces((prev) => prev.map((x, j) => (j === i ? { ...x, url: ev.target.value } : x)))
                    }
                    placeholder="https://…"
                    className="flex-1 rounded-lg border border-slate-300 px-3 py-1.5 text-sm outline-none focus:border-marca-500 focus:ring-2 focus:ring-marca-100"
                  />
                  <button
                    type="button"
                    onClick={() => setEnlaces((prev) => prev.filter((_, j) => j !== i))}
                    className="text-slate-400 transition hover:text-red-600"
                    aria-label="Quitar enlace"
                  >
                    ✕
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="flex justify-end gap-2 pt-1">
          <Boton variante="secundario" onClick={onCerrar} disabled={ocupado}>
            Cancelar
          </Boton>
          <Boton
            variante="primario"
            type="submit"
            disabled={ocupado || titulo.trim().length === 0 || temas.size === 0}
          >
            {ocupado ? 'Guardando…' : 'Guardar'}
          </Boton>
        </div>
      </form>
    </Modal>
  )
}
