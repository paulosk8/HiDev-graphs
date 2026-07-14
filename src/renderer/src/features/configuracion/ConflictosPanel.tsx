import { useEffect } from 'react'
import type { ConflictoDTO, EleccionConflicto } from '@shared/dtos'
import { Boton } from '../../components/Boton'
import { useConflictosStore } from '../../stores/conflictosStore'
import { useUiStore } from '../../stores/uiStore'

/** Fecha legible (medio + hora) a partir de una marca de tiempo en ms. */
function fecha(ms: number): string {
  if (!ms) return 'sin fecha'
  return new Date(ms).toLocaleString('es', { dateStyle: 'medium', timeStyle: 'short' })
}

/**
 * Lista de conflictos pendientes: el mismo ítem editado en dos equipos entre
 * sincronizaciones. Para cada uno, el docente elige con qué versión quedarse
 * (la de este equipo o la de la nube). No se pierde nada hasta que decide.
 */
export function ConflictosPanel(): JSX.Element | null {
  const lista = useConflictosStore((s) => s.lista)
  const resolviendo = useConflictosStore((s) => s.resolviendo)
  const resolver = useConflictosStore((s) => s.resolver)
  const cargar = useConflictosStore((s) => s.cargar)
  const notificar = useUiStore((s) => s.notificar)
  const notificarError = useUiStore((s) => s.notificarError)

  // Al abrir esta pantalla, recarga (captura conflictos detectados por auto-sync).
  useEffect(() => {
    void cargar()
  }, [cargar])

  if (lista.length === 0) return null

  const alResolver = async (c: ConflictoDTO, eleccion: EleccionConflicto): Promise<void> => {
    try {
      await resolver(c.tabla, c.id, eleccion)
      notificar({
        tipo: 'exito',
        mensaje: `«${c.titulo}»: se conservó la versión ${
          eleccion === 'local' ? 'de este equipo' : 'de la nube'
        }.`
      })
    } catch (error) {
      notificarError(error)
    }
  }

  return (
    <section className="mb-5 rounded-xl border border-amber-200 bg-amber-50 p-4">
      <header className="mb-1 flex items-center gap-2">
        <span aria-hidden className="text-lg">
          ⚠️
        </span>
        <h3 className="font-semibold text-amber-800">
          {lista.length === 1
            ? '1 conflicto por resolver'
            : `${lista.length} conflictos por resolver`}
        </h3>
      </header>
      <p className="mb-3 text-sm text-amber-800">
        Estos elementos se editaron en dos equipos a la vez. Elige con qué versión quedarte; la
        otra se descarta. Nada se pierde hasta que decides.
      </p>

      <ul className="space-y-3">
        {lista.map((c) => {
          const clave = `${c.tabla}:${c.id}`
          const ocupado = resolviendo === clave
          return (
            <li key={clave} className="rounded-lg border border-amber-200 bg-white p-3">
              <div className="mb-2 flex items-center gap-2">
                <span className="rounded bg-slate-100 px-1.5 py-0.5 text-xs font-medium text-slate-500">
                  {c.tipoEtiqueta}
                </span>
                <span className="truncate font-medium text-slate-800">{c.titulo}</span>
              </div>
              <div className="grid gap-2 sm:grid-cols-2">
                <VersionTarjeta
                  etiqueta="Versión de este equipo"
                  resumen={c.local.resumen}
                  cuando={fecha(c.local.editadoEnMs)}
                  textoBoton="Quedarme con esta"
                  disabled={ocupado}
                  onElegir={() => void alResolver(c, 'local')}
                />
                <VersionTarjeta
                  etiqueta="Versión de la nube"
                  resumen={c.nube.resumen}
                  cuando={fecha(c.nube.editadoEnMs)}
                  textoBoton="Quedarme con la de la nube"
                  disabled={ocupado}
                  onElegir={() => void alResolver(c, 'nube')}
                />
              </div>
            </li>
          )
        })}
      </ul>
    </section>
  )
}

function VersionTarjeta({
  etiqueta,
  resumen,
  cuando,
  textoBoton,
  disabled,
  onElegir
}: {
  etiqueta: string
  resumen: string
  cuando: string
  textoBoton: string
  disabled: boolean
  onElegir: () => void
}): JSX.Element {
  return (
    <div className="flex flex-col gap-2 rounded-md border border-slate-200 p-2.5">
      <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">{etiqueta}</p>
      <p className="min-h-[2.5rem] text-sm text-slate-700">{resumen || '(sin detalles)'}</p>
      <p className="text-xs text-slate-400">Editada: {cuando}</p>
      <Boton variante="secundario" onClick={onElegir} disabled={disabled}>
        {textoBoton}
      </Boton>
    </div>
  )
}
