import { useRef, useState, type ClipboardEvent, type FormEvent } from 'react'
import { marked } from 'marked'
import type { AsignaturaDTO, TareaDTO } from '@shared/dtos'
import { Boton } from '../../components/Boton'
import { CampoTexto } from '../../components/Campos'
import { Modal } from '../../components/Modal'
import { htmlAMarkdown } from '../../lib/markdown'
import { useTareasStore } from '../../stores/tareasStore'

/** Fragmentos que inserta la barra de formato. */
const PLANTILLA_TABLA = '\n| Criterio | Puntos |\n| --- | --- |\n| … | … |\n| … | … |\n'

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

  const [titulo, setTitulo] = useState(tareaInicial?.titulo ?? '')
  const [componente, setComponente] = useState<string>(tareaInicial?.componente ?? '')
  const [temas, setTemas] = useState<Set<string>>(
    () => new Set(tareaInicial?.temas ?? (temaPreseleccionado ? [temaPreseleccionado] : []))
  )
  const [instrucciones, setInstrucciones] = useState(tareaInicial?.instrucciones ?? '')
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

  /** Al pegar contenido con formato (Word/web), lo convierte a Markdown. */
  const alPegar = (e: ClipboardEvent<HTMLTextAreaElement>): void => {
    const html = e.clipboardData.getData('text/html')
    if (html && html.trim()) {
      e.preventDefault()
      insertar(`${htmlAMarkdown(html)}\n`)
    }
    // Sin HTML (texto plano): se deja el pegado por defecto.
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
      asignaturaId: asignatura.id,
      temas: [...temas],
      componente: componente || null
    }
    const tarea = editando ? await editar(tareaInicial.id, datos) : await crear(datos)
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
            <span className="text-sm font-medium text-slate-700">Instrucciones</span>
            <button
              type="button"
              onClick={() => setPrevia((p) => !p)}
              className="text-xs text-marca-600 hover:text-marca-700"
            >
              {previa ? 'Editar' : 'Vista previa'}
            </button>
          </div>
          {previa ? (
            <div
              className="markdown-preview min-h-[8rem] rounded-lg border border-slate-200 bg-slate-50 p-3"
              dangerouslySetInnerHTML={{ __html: marked.parse(instrucciones || '_Sin contenido_') as string }}
            />
          ) : (
            <>
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
              <textarea
                ref={areaRef}
                value={instrucciones}
                onChange={(e) => setInstrucciones(e.target.value)}
                onPaste={alPegar}
                placeholder="Escribe o PEGA desde Word/web: títulos, párrafos, listas, tablas y rúbrica se convierten a formato automáticamente. Los enlaces también."
                rows={10}
                className="w-full resize-none rounded-lg border border-slate-300 px-3 py-2 font-mono text-sm outline-none focus:border-marca-500 focus:ring-2 focus:ring-marca-100"
              />
              <p className="mt-1 text-xs text-slate-400">
                Pega contenido con formato y se convierte solo. Usa «Vista previa» para verlo como quedará.
              </p>
            </>
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
