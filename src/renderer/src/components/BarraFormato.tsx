/**
 * Botones de color y de contenido incrustado para el editor de instrucciones.
 *
 * El editor es un área de texto (no un procesador de textos), así que "poner
 * color" es envolver lo seleccionado en un `<span style="color:…">`. Funciona
 * igual en Markdown y en HTML porque el Markdown de la app admite HTML dentro,
 * y en ambos casos se guarda tal cual para poder copiarlo a Moodle.
 */

/** Colores de texto: pocos, con nombre y pensados para resaltar en clase. */
const COLORES_TEXTO = [
  { nombre: 'Rojo', valor: '#dc2626' },
  { nombre: 'Naranja', valor: '#ea580c' },
  { nombre: 'Verde', valor: '#16a34a' },
  { nombre: 'Azul', valor: '#2563eb' },
  { nombre: 'Morado', valor: '#7c3aed' },
  { nombre: 'Gris', valor: '#64748b' }
]

/** Fondos de resaltado, como un subrayador. */
const COLORES_FONDO = [
  { nombre: 'Amarillo', valor: '#fef08a' },
  { nombre: 'Verde', valor: '#bbf7d0' },
  { nombre: 'Azul', valor: '#bfdbfe' },
  { nombre: 'Rosa', valor: '#fbcfe8' }
]

/**
 * Plantilla de contenido incrustado. Se deja el `src` de Excalidraw como
 * ejemplo porque es el caso que más se usa: el docente pega ahí el enlace que
 * le da "Compartir → Insertar".
 */
const PLANTILLA_INCRUSTADO = `\n<iframe\n  src="https://excalidraw.com/"\n  width="100%"\n  height="480"\n  style="border:1px solid #e2e8f0;border-radius:8px"\n  allowfullscreen\n></iframe>\n`

export function BarraFormato({
  onEnvolver,
  onInsertar,
  mostrarIncrustado
}: {
  /** Envuelve la selección: (antes, después, ejemplo si no hay selección). */
  onEnvolver: (antes: string, despues: string, ejemplo: string) => void
  onInsertar: (texto: string) => void
  /** El botón de incrustar solo tiene sentido en modo HTML. */
  mostrarIncrustado: boolean
}): JSX.Element {
  return (
    <div className="mb-1.5 flex flex-wrap items-center gap-2">
      <GrupoColores
        etiqueta="Color del texto"
        colores={COLORES_TEXTO}
        muestraDeFondo={false}
        onElegir={(c) =>
          onEnvolver(`<span style="color:${c.valor}">`, '</span>', 'texto en color')
        }
      />
      <GrupoColores
        etiqueta="Resaltar"
        colores={COLORES_FONDO}
        muestraDeFondo
        onElegir={(c) =>
          onEnvolver(
            `<mark style="background:${c.valor};padding:0 .15em;border-radius:3px">`,
            '</mark>',
            'texto resaltado'
          )
        }
      />
      <button
        type="button"
        onClick={() => onEnvolver('<span style="color:inherit">', '</span>', 'texto')}
        className="rounded border border-slate-200 bg-white px-2 py-1 text-xs text-slate-600 transition hover:bg-slate-50"
        title="Quitar el color de lo seleccionado"
      >
        Sin color
      </button>

      {mostrarIncrustado && (
        <button
          type="button"
          onClick={() => onInsertar(PLANTILLA_INCRUSTADO)}
          className="rounded border border-slate-200 bg-white px-2 py-1 text-xs text-slate-600 transition hover:bg-slate-50"
          title="Inserta un recuadro para incrustar un esquema de Excalidraw, un vídeo, GeoGebra…"
        >
          + Insertar esquema o vídeo
        </button>
      )}
    </div>
  )
}

function GrupoColores({
  etiqueta,
  colores,
  muestraDeFondo,
  onElegir
}: {
  etiqueta: string
  colores: { nombre: string; valor: string }[]
  /** true = el botón se pinta relleno (resaltado); false = solo la letra. */
  muestraDeFondo: boolean
  onElegir: (color: { nombre: string; valor: string }) => void
}): JSX.Element {
  return (
    <span className="inline-flex items-center gap-1">
      <span className="text-xs text-slate-500">{etiqueta}</span>
      {colores.map((c) => (
        <button
          key={c.valor}
          type="button"
          onClick={() => onElegir(c)}
          title={`${etiqueta}: ${c.nombre}`}
          aria-label={`${etiqueta}: ${c.nombre}`}
          className="h-5 w-5 rounded border border-slate-300 text-xs font-bold leading-none transition hover:scale-110"
          style={
            muestraDeFondo
              ? { background: c.valor, color: '#334155' }
              : { color: c.valor, background: 'white' }
          }
        >
          A
        </button>
      ))}
    </span>
  )
}
