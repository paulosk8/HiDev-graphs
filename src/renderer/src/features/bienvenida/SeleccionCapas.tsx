import { useLayoutStore } from '../../stores/layoutStore'
import { useUiStore } from '../../stores/uiStore'

/**
 * Segundo paso de la bienvenida: el docente elige qué capas quiere ver en la
 * interfaz — Docencia, Aprendizaje o ambas. Habilita/oculta los grupos del menú.
 * Se puede cambiar luego en Configuración → Apariencia.
 */
export function SeleccionCapas(): JSX.Element {
  const elegirCapas = useLayoutStore((s) => s.elegirCapas)
  const irASeccion = useUiStore((s) => s.irASeccion)

  const elegir = (docencia: boolean, aprendizaje: boolean): void => {
    elegirCapas(docencia, aprendizaje)
    // Aterriza en la primera capa habilitada para no mostrar una sección oculta.
    irASeccion('asignaturas', docencia ? 'docencia' : 'aprendizaje')
  }

  return (
    <div className="flex h-full items-center justify-center bg-slate-50 p-6">
      <div className="w-full max-w-lg rounded-2xl border border-slate-200 bg-white p-8 shadow-sm">
        <div className="mb-6 text-center">
          <h1 className="text-xl font-semibold text-slate-900">¿Cómo vas a usar PedagoGraph?</h1>
          <p className="mt-1.5 text-sm text-slate-500">
            Elige qué quieres ver en el menú. Podrás cambiarlo cuando quieras en Configuración.
          </p>
        </div>

        <div className="space-y-3">
          <OpcionCapa
            icono="🎓"
            titulo="Docencia"
            descripcion="Planifica tus asignaturas (unidades, temas, semanas) y organiza su material."
            onElegir={() => elegir(true, false)}
          />
          <OpcionCapa
            icono="📘"
            titulo="Aprendizaje"
            descripcion="Organiza tu propio estudio: espacios de aprendizaje y repaso espaciado."
            onElegir={() => elegir(false, true)}
          />
          <OpcionCapa
            icono="🎓📘"
            titulo="Docencia y Aprendizaje"
            descripcion="Las dos capas. Ideal si preparas clases y además estudias por tu cuenta."
            onElegir={() => elegir(true, true)}
          />
        </div>
      </div>
    </div>
  )
}

function OpcionCapa({
  icono,
  titulo,
  descripcion,
  onElegir
}: {
  icono: string
  titulo: string
  descripcion: string
  onElegir: () => void
}): JSX.Element {
  return (
    <button
      onClick={onElegir}
      className="flex w-full items-center gap-4 rounded-xl border border-slate-200 p-4 text-left transition hover:border-marca-300 hover:bg-marca-50"
    >
      <span aria-hidden className="text-2xl">
        {icono}
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium text-slate-800">{titulo}</p>
        <p className="mt-0.5 text-xs text-slate-500">{descripcion}</p>
      </div>
      <span aria-hidden className="text-slate-300">
        ›
      </span>
    </button>
  )
}
