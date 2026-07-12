import { useAsignaturasStore } from '../stores/asignaturasStore'
import { useConceptosStore } from '../stores/conceptosStore'
import { useUiStore, type Seccion } from '../stores/uiStore'

interface ItemProps {
  seccion: Seccion
  etiqueta: string
  cuenta: number
  icono: string
}

function Item({ seccion, etiqueta, cuenta, icono }: ItemProps): JSX.Element {
  const activo = useUiStore((s) => s.seccion === seccion)
  const irASeccion = useUiStore((s) => s.irASeccion)

  return (
    <button
      onClick={() => irASeccion(seccion)}
      className={`flex w-full items-center gap-2.5 rounded-md px-3 py-2 text-sm font-medium transition ${
        activo ? 'bg-marca-50 text-marca-700' : 'text-slate-600 hover:bg-slate-100'
      }`}
    >
      <span aria-hidden className="text-base">
        {icono}
      </span>
      <span className="flex-1 text-left">{etiqueta}</span>
      <span className={`text-xs ${activo ? 'text-marca-500' : 'text-slate-400'}`}>{cuenta}</span>
    </button>
  )
}

export function Sidebar(): JSX.Element {
  const totalConceptos = useConceptosStore((s) => s.lista.length)
  const totalAsignaturas = useAsignaturasStore((s) => s.lista.length)

  return (
    <aside className="flex w-64 shrink-0 flex-col border-r border-slate-200 bg-slate-50 p-4">
      <div className="mb-8 flex items-center gap-2 px-2">
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-marca-600 text-sm font-bold text-white">
          P
        </div>
        <span className="text-lg font-semibold text-slate-800">PedagoGraph</span>
      </div>

      <nav className="space-y-1">
        <Item seccion="asignaturas" etiqueta="Mis asignaturas" cuenta={totalAsignaturas} icono="🎓" />
        <Item seccion="conceptos" etiqueta="Conceptos" cuenta={totalConceptos} icono="💡" />
      </nav>

      <div className="mt-auto px-2 text-xs text-slate-400">PedagoGraph · versión 0.1.0</div>
    </aside>
  )
}
