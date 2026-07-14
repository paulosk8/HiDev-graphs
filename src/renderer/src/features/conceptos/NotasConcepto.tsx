import { useRef, useState } from 'react'
import type { ConceptoDTO, FormatoInstrucciones, NotaDTO } from '@shared/dtos'
import { Boton } from '../../components/Boton'
import { ContenidoFormateado } from '../../components/ContenidoFormateado'
import { VistaCodigo } from '../../components/VistaCodigo'
import { useConceptosStore } from '../../stores/conceptosStore'
import { manejarPegadoRico } from '../../lib/pegadoRico'

const FORMATOS: { clave: FormatoInstrucciones; etiqueta: string }[] = [
  { clave: 'markdown', etiqueta: 'Markdown' },
  { clave: 'html', etiqueta: 'HTML' },
  { clave: 'codigo', etiqueta: 'Código' }
]

/**
 * Notas u observaciones sobre un concepto (varias, cada una en Markdown, HTML o
 * código). Se muestran en la ficha y en el repaso. Soporta pegar contenido rico
 * (Word/web: tablas e imágenes).
 */
export function NotasConcepto({
  concepto,
  onGuardado
}: {
  concepto: ConceptoDTO
  onGuardado: () => void
}): JSX.Element {
  const editar = useConceptosStore((s) => s.editar)
  // Id de la nota en edición, 'nuevo' para una nota nueva, o null (solo lista).
  const [editando, setEditando] = useState<string | 'nuevo' | null>(null)
  const [titulo, setTitulo] = useState('')
  const [contenido, setContenido] = useState('')
  const [formato, setFormato] = useState<FormatoInstrucciones>('markdown')
  const [previa, setPrevia] = useState(false)
  const [guardando, setGuardando] = useState(false)
  // Notas que se muestran como código fuente en vez de renderizadas.
  const [verCodigo, setVerCodigo] = useState<Set<string>>(new Set())
  const areaRef = useRef<HTMLTextAreaElement>(null)

  const alternarCodigo = (id: string): void =>
    setVerCodigo((prev) => {
      const s = new Set(prev)
      s.has(id) ? s.delete(id) : s.add(id)
      return s
    })

  const abrirNueva = (): void => {
    setTitulo('')
    setContenido('')
    setFormato('markdown')
    setPrevia(false)
    setEditando('nuevo')
  }
  const abrirEditar = (n: NotaDTO): void => {
    setTitulo(n.titulo)
    setContenido(n.contenido)
    setFormato(n.formato)
    setPrevia(false)
    setEditando(n.id)
  }

  const persistir = async (notas: NotaDTO[]): Promise<void> => {
    setGuardando(true)
    const r = await editar(concepto.id, {
      nombre: concepto.nombre,
      descripcion: concepto.descripcion,
      notas
    })
    setGuardando(false)
    if (r) {
      setEditando(null)
      onGuardado()
    }
  }

  const guardar = async (): Promise<void> => {
    if (!contenido.trim()) return
    const nota: NotaDTO = {
      id: editando === 'nuevo' ? crypto.randomUUID() : (editando as string),
      titulo: titulo.trim(),
      contenido,
      formato
    }
    const notas =
      editando === 'nuevo'
        ? [...concepto.notas, nota]
        : concepto.notas.map((n) => (n.id === editando ? nota : n))
    await persistir(notas)
  }

  const eliminar = async (id: string): Promise<void> => {
    await persistir(concepto.notas.filter((n) => n.id !== id))
  }

  return (
    <section className="mb-8">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-400">
          Notas y observaciones
        </h2>
        {editando === null && (
          <Boton variante="fantasma" onClick={abrirNueva}>
            + Agregar nota
          </Boton>
        )}
      </div>

      {editando !== null ? (
        <div className="space-y-2 rounded-xl border border-slate-200 p-4">
          <input
            value={titulo}
            onChange={(e) => setTitulo(e.target.value)}
            placeholder="Título de la nota (opcional)"
            className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm font-medium outline-none focus:border-marca-400 focus:ring-2 focus:ring-marca-100"
          />
          <div className="flex items-center justify-between">
            <div className="inline-flex overflow-hidden rounded-md border border-slate-200 text-xs">
              {FORMATOS.map((f) => (
                <button
                  key={f.clave}
                  type="button"
                  onClick={() => setFormato(f.clave)}
                  className={`px-2 py-0.5 transition ${
                    formato === f.clave ? 'bg-marca-600 text-white' : 'bg-white text-slate-600 hover:bg-slate-50'
                  }`}
                >
                  {f.etiqueta}
                </button>
              ))}
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
            <ContenidoFormateado
              texto={contenido || (formato === 'codigo' ? '// Sin contenido' : '_Sin contenido_')}
              formato={formato}
              className="min-h-[8rem] rounded-lg border border-slate-200 bg-slate-50 p-3"
            />
          ) : (
            <textarea
              ref={areaRef}
              value={contenido}
              onChange={(e) => setContenido(e.target.value)}
              onPaste={(e) => manejarPegadoRico(e, { formato, ref: areaRef, setValor: setContenido })}
              rows={8}
              placeholder={
                formato === 'codigo'
                  ? 'Escribe o pega código (se verá como en un editor).'
                  : formato === 'html'
                    ? 'Escribe o pega HTML (tablas incluidas). Pega desde Word/web y se conserva el formato.'
                    : 'Escribe en Markdown. Pega desde Word/web (tablas e imágenes) y se convierte solo.'
              }
              className="w-full resize-none rounded-lg border border-slate-300 px-3 py-2 font-mono text-sm outline-none focus:border-marca-500 focus:ring-2 focus:ring-marca-100"
            />
          )}
          {formato !== 'codigo' && (
            <p className="text-[11px] text-slate-400">
              Puedes pegar contenido con formato desde Word o la web (tablas e imágenes).
            </p>
          )}

          <div className="flex justify-end gap-2">
            <Boton variante="secundario" onClick={() => setEditando(null)} disabled={guardando}>
              Cancelar
            </Boton>
            <Boton variante="primario" onClick={guardar} disabled={guardando || !contenido.trim()}>
              {guardando ? 'Guardando…' : 'Guardar nota'}
            </Boton>
          </div>
        </div>
      ) : concepto.notas.length === 0 ? (
        <p className="rounded-xl border border-dashed border-slate-200 px-4 py-6 text-center text-sm text-slate-400">
          Añade notas u observaciones importantes: te aparecerán aquí y al repasar el concepto.
        </p>
      ) : (
        <div className="space-y-3">
          {concepto.notas.map((n) => (
            <div key={n.id} className="rounded-xl border border-slate-200 bg-white p-3">
              <div className="mb-1.5 flex items-start justify-between gap-2">
                {n.titulo ? (
                  <h3 className="text-sm font-medium text-slate-800">{n.titulo}</h3>
                ) : (
                  <span className="text-xs uppercase tracking-wide text-slate-300">Nota</span>
                )}
                <div className="flex shrink-0 items-center gap-1">
                  {/* Vista renderizada / código fuente (para HTML y Markdown) */}
                  {(n.formato === 'html' || n.formato === 'markdown') && (
                    <button
                      onClick={() => alternarCodigo(n.id)}
                      title={verCodigo.has(n.id) ? 'Ver renderizado' : 'Ver el código'}
                      className="rounded-md border border-slate-200 px-2 py-0.5 text-[11px] text-slate-500 transition hover:bg-slate-50"
                    >
                      {verCodigo.has(n.id) ? '👁 Vista' : '</> Código'}
                    </button>
                  )}
                  <button
                    onClick={() => abrirEditar(n)}
                    className="rounded-md px-2 py-0.5 text-xs text-slate-500 transition hover:bg-slate-100"
                  >
                    Editar
                  </button>
                  <button
                    onClick={() => void eliminar(n.id)}
                    className="rounded-md px-2 py-0.5 text-xs text-slate-400 transition hover:bg-red-50 hover:text-red-600"
                  >
                    Eliminar
                  </button>
                </div>
              </div>
              {verCodigo.has(n.id) && (n.formato === 'html' || n.formato === 'markdown') ? (
                <VistaCodigo texto={n.contenido} lenguaje={n.formato} />
              ) : (
                <ContenidoFormateado texto={n.contenido} formato={n.formato} />
              )}
            </div>
          ))}
        </div>
      )}
    </section>
  )
}
