import { useAuthStore } from '../stores/authStore'
import { useAsignaturasStore } from '../stores/asignaturasStore'
import { useConceptosStore } from '../stores/conceptosStore'
import { useLayoutStore } from '../stores/layoutStore'
import { useUiStore, type Contexto, type Seccion } from '../stores/uiStore'
import { conceptosDeAprendizaje, pendientesHoy } from '../lib/repaso'

interface ItemProps {
  seccion: Seccion
  /** Contexto al que pertenece el ítem (docencia/aprendizaje); ausente = transversal. */
  contexto?: Contexto
  etiqueta: string
  cuenta?: number
  icono: string
  colapsada: boolean
  /** Sangría para los sub-ítems de un grupo (docencia/aprendizaje). */
  sangrado?: boolean
  /** Acción al tocar; por defecto navega a la sección. Se usa para el toggle de Configuración. */
  alSeleccionar?: () => void
}

function Item({ seccion, contexto, etiqueta, cuenta, icono, colapsada, sangrado, alSeleccionar }: ItemProps): JSX.Element {
  const activo = useUiStore((s) => s.seccion === seccion && (contexto === undefined || s.contexto === contexto))
  const irASeccion = useUiStore((s) => s.irASeccion)

  return (
    <button
      onClick={() => (alSeleccionar ? alSeleccionar() : irASeccion(seccion, contexto))}
      title={colapsada ? (contexto ? `${contexto === 'docencia' ? 'Docencia' : 'Aprendizaje'} · ${etiqueta}` : etiqueta) : undefined}
      className={`flex w-full items-center rounded-md text-sm font-medium transition ${
        colapsada ? 'justify-center px-0 py-2.5' : `gap-2.5 py-2 ${sangrado ? 'pl-9 pr-3' : 'px-3'}`
      } ${activo ? 'bg-marca-50 text-marca-700' : 'text-slate-600 hover:bg-slate-100'}`}
    >
      <span aria-hidden className="text-base">
        {icono}
      </span>
      {!colapsada && (
        <>
          <span className="flex-1 text-left">{etiqueta}</span>
          {cuenta !== undefined && (
            <span className={`text-xs ${activo ? 'text-marca-500' : 'text-slate-400'}`}>{cuenta}</span>
          )}
        </>
      )}
    </button>
  )
}

/** Cabecera clicable de un grupo de contexto (Docencia / Aprendizaje): pliega/despliega sus sub-ítems. */
function EncabezadoGrupo({
  icono,
  etiqueta,
  colapsado,
  onAlternar
}: {
  icono: string
  etiqueta: string
  colapsado: boolean
  onAlternar: () => void
}): JSX.Element {
  return (
    <button
      onClick={onAlternar}
      title={colapsado ? `Desplegar ${etiqueta}` : `Plegar ${etiqueta}`}
      className="flex w-full items-center gap-2 rounded-md px-3 py-1.5 text-xs font-semibold uppercase tracking-wide text-slate-400 transition hover:bg-slate-100 hover:text-slate-600"
    >
      <span aria-hidden>{icono}</span>
      <span className="flex-1 text-left">{etiqueta}</span>
      <span aria-hidden className="text-[10px] normal-case">
        {colapsado ? '▸' : '▾'}
      </span>
    </button>
  )
}

export function Sidebar(): JSX.Element {
  const asignaturas = useAsignaturasStore((s) => s.lista)
  const totalDocencia = asignaturas.filter((a) => a.tipo !== 'aprendizaje').length
  const totalAprendizaje = asignaturas.filter((a) => a.tipo === 'aprendizaje').length
  const conceptos = useConceptosStore((s) => s.lista)
  // El repaso pertenece a la capa de Aprendizaje: solo cuenta sus conceptos.
  const pendientesRepaso = pendientesHoy(conceptosDeAprendizaje(conceptos, asignaturas)).length
  const colapsada = useLayoutStore((s) => s.sidebarColapsada)
  const alternar = useLayoutStore((s) => s.alternarSidebar)
  const docenciaColapsada = useLayoutStore((s) => s.docenciaColapsada)
  const aprendizajeColapsada = useLayoutStore((s) => s.aprendizajeColapsada)
  const alternarGrupo = useLayoutStore((s) => s.alternarGrupo)
  const usuario = useAuthStore((s) => s.sesion?.usuario)
  const cerrarSesion = useAuthStore((s) => s.cerrar)
  const alternarConfiguracion = useUiStore((s) => s.alternarConfiguracion)

  // En la franja de iconos (sidebar plegado) los grupos se muestran siempre.
  const mostrarDocencia = colapsada || !docenciaColapsada
  const mostrarAprendizaje = colapsada || !aprendizajeColapsada

  return (
    <aside
      className={`flex shrink-0 flex-col border-r border-slate-200 bg-slate-50 p-3 transition-all ${
        colapsada ? 'w-16 items-center' : 'w-64 p-4'
      }`}
    >
      <div className={`mb-8 flex items-center ${colapsada ? 'justify-center' : 'gap-2 px-2'}`}>
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-marca-600 text-sm font-bold text-white">
          P
        </div>
        {!colapsada && (
          <>
            <span className="text-lg font-semibold text-slate-800">PedagoGraph</span>
            <button
              onClick={alternar}
              title="Contraer el menú"
              className="ml-auto flex h-7 w-7 items-center justify-center rounded-md text-slate-400 transition hover:bg-slate-200 hover:text-slate-600"
            >
              «
            </button>
          </>
        )}
      </div>

      {colapsada && (
        <button
          onClick={alternar}
          title="Expandir el menú"
          className="mb-3 flex h-7 w-7 items-center justify-center rounded-md text-slate-400 transition hover:bg-slate-200 hover:text-slate-600"
        >
          »
        </button>
      )}

      <nav className="w-full space-y-1">
        {/* Docencia */}
        {!colapsada && (
          <EncabezadoGrupo
            icono="🎓"
            etiqueta="Docencia"
            colapsado={docenciaColapsada}
            onAlternar={() => alternarGrupo('docencia')}
          />
        )}
        {mostrarDocencia && (
          <>
            <Item seccion="asignaturas" contexto="docencia" etiqueta="Asignaturas" cuenta={colapsada ? undefined : totalDocencia} icono="🎓" colapsada={colapsada} sangrado />
            <Item seccion="conceptos" contexto="docencia" etiqueta="Conceptos" icono="💡" colapsada={colapsada} sangrado />
            <Item seccion="grafo" contexto="docencia" etiqueta="Mapa" icono="🕸️" colapsada={colapsada} sangrado />
          </>
        )}

        {/* Aprendizaje */}
        {colapsada && <div className="mx-auto my-1.5 h-px w-6 bg-slate-200" />}
        {!colapsada && (
          <div className="pt-2">
            <EncabezadoGrupo
              icono="📘"
              etiqueta="Aprendizaje"
              colapsado={aprendizajeColapsada}
              onAlternar={() => alternarGrupo('aprendizaje')}
            />
          </div>
        )}
        {mostrarAprendizaje && (
          <>
            <Item seccion="asignaturas" contexto="aprendizaje" etiqueta="Espacios" cuenta={colapsada ? undefined : totalAprendizaje} icono="📘" colapsada={colapsada} sangrado />
            <Item seccion="conceptos" contexto="aprendizaje" etiqueta="Conceptos" icono="💡" colapsada={colapsada} sangrado />
            <Item seccion="grafo" contexto="aprendizaje" etiqueta="Mapa" icono="🕸️" colapsada={colapsada} sangrado />
            {/* El repaso es una actividad de aprendizaje: vive en esta capa. */}
            <Item
              seccion="estudio"
              contexto="aprendizaje"
              etiqueta="Repaso"
              icono="🎯"
              colapsada={colapsada}
              cuenta={colapsada || pendientesRepaso === 0 ? undefined : pendientesRepaso}
              sangrado
            />
          </>
        )}
      </nav>

      <div className="mt-auto w-full space-y-2 border-t border-slate-100 pt-3">
        {/* Configuración: agrupa Apariencia (modo oscuro), Asistente IA, Datos y copias, Cuenta. */}
        <Item seccion="configuracion" etiqueta="Configuración" icono="⚙️" colapsada={colapsada} alSeleccionar={alternarConfiguracion} />

        {usuario && (
          <div className={`mt-1 flex items-center pt-1 ${colapsada ? 'justify-center' : 'gap-2 px-1'}`}>
            {usuario.foto ? (
              <img
                src={usuario.foto}
                alt=""
                referrerPolicy="no-referrer"
                className="h-7 w-7 shrink-0 rounded-full"
              />
            ) : (
              <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-marca-100 text-xs font-semibold text-marca-700">
                {usuario.nombre.charAt(0).toUpperCase()}
              </span>
            )}
            {!colapsada && (
              <>
                <span className="min-w-0 flex-1 truncate text-xs text-slate-500" title={usuario.email}>
                  {usuario.nombre}
                </span>
                <button
                  onClick={() => void cerrarSesion()}
                  title="Cerrar sesión"
                  className="shrink-0 rounded-md px-1.5 py-1 text-xs text-slate-400 transition hover:bg-slate-100 hover:text-red-600"
                >
                  Salir
                </button>
              </>
            )}
          </div>
        )}
        {!colapsada && <div className="px-2 text-xs text-slate-400">PedagoGraph · versión 0.1.0</div>}
      </div>
    </aside>
  )
}
