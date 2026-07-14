import { useState } from 'react'
import type { ConceptoDTO, FormatoInstrucciones } from '@shared/dtos'
import { Boton } from '../../components/Boton'
import { ContenidoFormateado } from '../../components/ContenidoFormateado'
import { useConceptosStore } from '../../stores/conceptosStore'

const FORMATOS: { clave: FormatoInstrucciones; etiqueta: string }[] = [
  { clave: 'markdown', etiqueta: 'Markdown' },
  { clave: 'html', etiqueta: 'HTML' },
  { clave: 'codigo', etiqueta: 'Código' }
]

/**
 * Notas u observaciones propias sobre un concepto (Markdown, HTML o código).
 * Se muestran en la ficha y en el repaso. Gestiona su propia edición.
 */
export function NotasConcepto({
  concepto,
  onGuardado
}: {
  concepto: ConceptoDTO
  onGuardado: () => void
}): JSX.Element {
  const editar = useConceptosStore((s) => s.editar)
  const [editando, setEditando] = useState(false)
  const [notas, setNotas] = useState(concepto.notas)
  const [formato, setFormato] = useState<FormatoInstrucciones>(concepto.formatoNotas)
  const [previa, setPrevia] = useState(false)
  const [guardando, setGuardando] = useState(false)

  const abrir = (): void => {
    setNotas(concepto.notas)
    setFormato(concepto.formatoNotas)
    setPrevia(false)
    setEditando(true)
  }

  const guardar = async (): Promise<void> => {
    setGuardando(true)
    const r = await editar(concepto.id, {
      nombre: concepto.nombre,
      descripcion: concepto.descripcion,
      notas,
      formatoNotas: formato
    })
    setGuardando(false)
    if (r) {
      setEditando(false)
      onGuardado()
    }
  }

  return (
    <section className="mb-8">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-400">
          Notas y observaciones
        </h2>
        {!editando && (
          <Boton variante="fantasma" onClick={abrir}>
            {concepto.notas.trim() ? 'Editar notas' : '+ Agregar notas'}
          </Boton>
        )}
      </div>

      {!editando ? (
        concepto.notas.trim() ? (
          <ContenidoFormateado
            texto={concepto.notas}
            formato={concepto.formatoNotas}
            className="rounded-lg border border-slate-200 bg-white p-3"
          />
        ) : (
          <p className="rounded-xl border border-dashed border-slate-200 px-4 py-6 text-center text-sm text-slate-400">
            Añade notas u observaciones importantes: te aparecerán aquí y al repasar el concepto.
          </p>
        )
      ) : (
        <div className="space-y-2">
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
              texto={notas || (formato === 'codigo' ? '// Sin contenido' : '_Sin contenido_')}
              formato={formato}
              className="min-h-[8rem] rounded-lg border border-slate-200 bg-slate-50 p-3"
            />
          ) : (
            <textarea
              value={notas}
              onChange={(e) => setNotas(e.target.value)}
              rows={8}
              placeholder={
                formato === 'codigo'
                  ? 'Escribe o pega código (se verá como en un editor).'
                  : formato === 'html'
                    ? 'Escribe o pega HTML.'
                    : 'Escribe tus notas en Markdown.'
              }
              className="w-full resize-none rounded-lg border border-slate-300 px-3 py-2 font-mono text-sm outline-none focus:border-marca-500 focus:ring-2 focus:ring-marca-100"
            />
          )}

          <div className="flex justify-end gap-2">
            <Boton variante="secundario" onClick={() => setEditando(false)} disabled={guardando}>
              Cancelar
            </Boton>
            <Boton variante="primario" onClick={guardar} disabled={guardando}>
              {guardando ? 'Guardando…' : 'Guardar notas'}
            </Boton>
          </div>
        </div>
      )}
    </section>
  )
}
