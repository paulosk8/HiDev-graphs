import { useMemo, useState } from 'react'
import { Boton } from './Boton'
import { Modal } from './Modal'

export interface DestinoMover {
  id: string
  /** Lo que se lee en grande ("Unidad 2", "Interfaz"). */
  titulo: string
  /** Contexto en gris ("Algoritmos · 2026A"), para desempatar homónimos. */
  detalle?: string
  /** true si es donde está ahora: se marca y no se puede elegir. */
  actual?: boolean
}

/**
 * Diálogo para elegir a dónde mover algo.
 *
 * La decisión de UX que importa: se busca escribiendo, en vez de navegar por
 * submenús. Con dos asignaturas un submenú anidado funciona; con diez es
 * inmanejable y obliga a recordar dónde estaba cada cosa. Escribir tres letras
 * funciona igual con dos que con cincuenta destinos.
 *
 * El destino actual se muestra marcado en vez de ocultarse: ver de dónde sale
 * algo es parte de entender a dónde va.
 */
export function DialogoMover({
  titulo,
  queSeMueve,
  destinos,
  textoVacio = 'No hay ningún otro sitio al que moverlo.',
  onMover,
  onCerrar
}: {
  titulo: string
  /** Nombre de lo que se mueve, para que el docente confirme que es lo que cree. */
  queSeMueve: string
  destinos: DestinoMover[]
  textoVacio?: string
  onMover: (destinoId: string) => Promise<void>
  onCerrar: () => void
}): JSX.Element {
  const [busqueda, setBusqueda] = useState('')
  const [moviendo, setMoviendo] = useState(false)

  const normalizar = (t: string): string =>
    t
      .normalize('NFD')
      .replace(/[̀-ͯ]/g, '')
      .toLowerCase()

  const filtrados = useMemo(() => {
    const q = normalizar(busqueda.trim())
    if (!q) return destinos
    return destinos.filter((d) => normalizar(`${d.titulo} ${d.detalle ?? ''}`).includes(q))
  }, [destinos, busqueda])

  const mover = async (id: string): Promise<void> => {
    setMoviendo(true)
    try {
      await onMover(id)
      onCerrar()
    } finally {
      setMoviendo(false)
    }
  }

  const elegibles = destinos.filter((d) => !d.actual)

  return (
    <Modal titulo={titulo} descripcion={`Vas a mover «${queSeMueve}».`} onCerrar={onCerrar}>
      {elegibles.length === 0 ? (
        <p className="text-sm text-slate-500">{textoVacio}</p>
      ) : (
        <>
          {/* El buscador solo aparece cuando de verdad ayuda. */}
          {destinos.length > 6 && (
            <input
              type="search"
              autoFocus
              value={busqueda}
              onChange={(e) => setBusqueda(e.target.value)}
              placeholder="Escribe para buscar el destino…"
              className="mb-3 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-marca-500 focus:ring-2 focus:ring-marca-100"
            />
          )}

          <ul className="max-h-72 space-y-1 overflow-auto">
            {filtrados.map((d) => (
              <li key={d.id}>
                <button
                  type="button"
                  disabled={d.actual || moviendo}
                  onClick={() => void mover(d.id)}
                  className={`flex w-full items-center gap-2 rounded-lg border px-3 py-2 text-left transition ${
                    d.actual
                      ? 'cursor-default border-slate-100 bg-slate-50'
                      : 'border-slate-200 hover:border-marca-300 hover:bg-marca-50'
                  }`}
                >
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm text-slate-800">{d.titulo}</span>
                    {d.detalle && (
                      <span className="block truncate text-xs text-slate-400">{d.detalle}</span>
                    )}
                  </span>
                  {d.actual && (
                    <span className="shrink-0 rounded-full bg-slate-200 px-2 py-0.5 text-xs text-slate-600">
                      Está aquí
                    </span>
                  )}
                </button>
              </li>
            ))}
            {filtrados.length === 0 && (
              <li className="px-1 py-3 text-sm text-slate-400">
                Ningún destino coincide con «{busqueda}».
              </li>
            )}
          </ul>
        </>
      )}

      <div className="mt-4 flex justify-end">
        <Boton variante="secundario" onClick={onCerrar} disabled={moviendo}>
          {moviendo ? 'Moviendo…' : 'Cancelar'}
        </Boton>
      </div>
    </Modal>
  )
}
