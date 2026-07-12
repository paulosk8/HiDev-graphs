import { useRef, useState, type ClipboardEvent, type FormEvent } from 'react'
import { marked } from 'marked'
import type { AsignaturaDTO, FormatoInstrucciones, TareaDTO } from '@shared/dtos'
import { Boton } from '../../components/Boton'
import { CampoTexto } from '../../components/Campos'
import { Modal } from '../../components/Modal'
import { api } from '../../lib/api'
import { htmlAMarkdown } from '../../lib/markdown'
import { useTareasStore } from '../../stores/tareasStore'

/** Fragmentos que inserta la barra de formato. */
const PLANTILLA_TABLA = '\n| Criterio | Puntos |\n| --- | --- |\n| … | … |\n| … | … |\n'

/** Lee un archivo (imagen) como Data URI base64 para incrustarlo autocontenido. */
function leerComoDataUri(archivo: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const lector = new FileReader()
    lector.onload = () => resolve(lector.result as string)
    lector.onerror = () => reject(lector.error)
    lector.readAsDataURL(archivo)
  })
}

interface Props {
  asignatura: AsignaturaDTO
  tareaInicial?: TareaDTO
  temaPreseleccionado?: string
  onCerrar: () => void
  onGuardada: (tarea: TareaDTO) => void
}

export function FormularioTarea({
  asignatura,
  tareaInicial,
  temaPreseleccionado,
  onCerrar,
  onGuardada
}: Props): JSX.Element {
  const editando = tareaInicial !== undefined
  const crear = useTareasStore((s) => s.crear)
  const editar = useTareasStore((s) => s.editar)
  const agregarAdjunto = useTareasStore((s) => s.agregarAdjunto)

  const [titulo, setTitulo] = useState(tareaInicial?.titulo ?? '')
  const [componente, setComponente] = useState<string>(tareaInicial?.componente ?? '')
  const [temas, setTemas] = useState<Set<string>>(
    () => new Set(tareaInicial?.temas ?? (temaPreseleccionado ? [temaPreseleccionado] : []))
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

  /** Inserta texto en la posición del cursor (o al final si no hay foco). */
  const insertar = (texto: string): void => {
    const el = areaRef.current
    const inicio = el?.selectionStart ?? instrucciones.length
    const fin = el?.selectionEnd ?? instrucciones.length
    setInstrucciones(instrucciones.slice(0, inicio) + texto + instrucciones.slice(fin))
    requestAnimationFrame(() => {
      if (!el) return
      el.focus()
      const pos = inicio + texto.length
      el.setSelectionRange(pos, pos)
    })
  }

  /** Al pegar: imágenes → base64 autocontenido; HTML con formato → Markdown/HTML. */
  const alPegar = (e: ClipboardEvent<HTMLTextAreaElement>): void => {
    // 1) Imágenes del portapapeles: se incrustan en base64 (viajan con el contenido).
    const imagenes: File[] = []
    for (const item of Array.from(e.clipboardData.items)) {
      if (item.kind === 'file' && item.type.startsWith('image/')) {
        const f = item.getAsFile()
        if (f) imagenes.push(f)
      }
    }
    if (imagenes.length > 0) {
      e.preventDefault()
      const el = areaRef.current
      const inicio = el?.selectionStart ?? instrucciones.length
      const fin = el?.selectionEnd ?? instrucciones.length
      void Promise.all(imagenes.map(leerComoDataUri)).then((uris) => {
        const frag = uris
          .map((u) =>
            formato === 'html'
              ? `<img src="${u}" alt="imagen" style="max-width:100%">`
              : `\n![imagen](${u})\n`
          )
          .join('')
        setInstrucciones((prev) => prev.slice(0, inicio) + frag + prev.slice(fin))
      })
      return
    }
    // 2) HTML con formato: en modo HTML se pega tal cual; en Markdown se convierte.
    const html = e.clipboardData.getData('text/html')
    if (html && html.trim()) {
      e.preventDefault()
      insertar(formato === 'html' ? html : `${htmlAMarkdown(html)}\n`)
    }
    // Sin HTML ni imagen (texto plano): se deja el pegado por defecto.
  }

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
    <Modal titulo={editando ? 'Editar tarea' : 'Nueva tarea'} ancho="xl" onCerrar={onCerrar}>
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
                <p className="text-xs font-semibold text-slate-400">{u.titulo}</p>
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
              <p className="text-xs text-slate-400">Esta asignatura no tiene temas todavía.</p>
            )}
          </div>
        </div>

        {/* Componente */}
        <label className="block">
          <span className="mb-1.5 block text-sm font-medium text-slate-700">
            Componente (opcional)
          </span>
          <select
            value={componente}
            onChange={(e) => setComponente(e.target.value)}
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-marca-500 focus:ring-2 focus:ring-marca-100"
          >
            <option value="">General (sin componente)</option>
            {asignatura.componentes.map((c) => (
              <option key={c.clave} value={c.clave}>
                {c.clave} · {c.nombre}
              </option>
            ))}
          </select>
        </label>

        {/* Instrucciones (Markdown) */}
        <div>
          <div className="mb-1.5 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium text-slate-700">Instrucciones</span>
              <div className="inline-flex overflow-hidden rounded-md border border-slate-200 text-xs">
                {(['markdown', 'html'] as const).map((f) => (
                  <button
                    key={f}
                    type="button"
                    onClick={() => setFormato(f)}
                    className={`px-2 py-0.5 transition ${
                      formato === f ? 'bg-marca-600 text-white' : 'bg-white text-slate-600 hover:bg-slate-50'
                    }`}
                  >
                    {f === 'markdown' ? 'Markdown' : 'HTML'}
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
              <iframe
                title="Vista previa"
                sandbox="allow-scripts"
                srcDoc={instrucciones || '<p style="color:#94a3b8;font-family:sans-serif">Sin contenido</p>'}
                className="min-h-[12rem] w-full rounded-lg border border-slate-200 bg-white"
              />
            ) : (
              <div
                className="markdown-preview min-h-[8rem] rounded-lg border border-slate-200 bg-slate-50 p-3"
                dangerouslySetInnerHTML={{ __html: marked.parse(instrucciones || '_Sin contenido_') as string }}
              />
            )
          ) : (
            <>
              {formato === 'markdown' ? (
                <div className="mb-1.5 flex flex-wrap gap-1">
                  {[
                    { etiqueta: 'Título', frag: '\n## Título\n' },
                    { etiqueta: 'Subtítulo', frag: '\n### Subtítulo\n' },
                    { etiqueta: 'Lista', frag: '\n- \n' },
                    { etiqueta: 'Tabla / rúbrica', frag: PLANTILLA_TABLA },
                    { etiqueta: 'Enlace', frag: '[texto](https://…)' },
                    { etiqueta: 'Negrita', frag: '**texto**' }
                  ].map((b) => (
                    <button
                      key={b.etiqueta}
                      type="button"
                      onClick={() => insertar(b.frag)}
                      className="rounded border border-slate-200 bg-white px-2 py-1 text-xs text-slate-600 transition hover:bg-slate-50"
                    >
                      {b.etiqueta}
                    </button>
                  ))}
                </div>
              ) : (
                <p className="mb-1.5 text-xs text-slate-500">
                  Modo HTML: pega o escribe HTML; admite <code>&lt;style&gt;</code> y{' '}
                  <code>&lt;script&gt;</code>. Se guarda tal cual para copiarlo en Moodle.
                </p>
              )}
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
