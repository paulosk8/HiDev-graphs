import { useAuthStore } from '../../stores/authStore'
import { useUiStore } from '../../stores/uiStore'

/**
 * Compuerta de acceso: se muestra cuando no hay sesión iniciada. El inicio de
 * sesión es obligatorio para usar la app.
 */
export function PantallaLogin(): JSX.Element {
  const iniciar = useAuthStore((s) => s.iniciar)
  const iniciando = useAuthStore((s) => s.iniciando)
  const notificarError = useUiStore((s) => s.notificarError)

  const entrar = async (): Promise<void> => {
    try {
      await iniciar()
    } catch (error) {
      notificarError(error)
    }
  }

  return (
    <div className="flex h-full items-center justify-center bg-slate-50 px-6">
      <div className="w-full max-w-sm rounded-2xl border border-slate-200 bg-white p-8 text-center shadow-sm">
        <div className="mx-auto mb-5 flex h-14 w-14 items-center justify-center rounded-2xl bg-marca-600 text-2xl font-bold text-white">
          P
        </div>
        <h1 className="text-xl font-semibold text-slate-900">PedagoGraph</h1>
        <p className="mt-2 text-sm text-slate-500">
          Inicia sesión para acceder a tus conceptos, asignaturas y material.
        </p>

        <button
          onClick={() => void entrar()}
          disabled={iniciando}
          className="mt-6 flex w-full items-center justify-center gap-3 rounded-lg border border-slate-300 bg-white px-4 py-2.5 text-sm font-medium text-slate-700 transition hover:bg-slate-50 disabled:opacity-60"
        >
          <span aria-hidden className="text-base">
            {iniciando ? '⏳' : 'G'}
          </span>
          {iniciando ? 'Abriendo el navegador…' : 'Iniciar sesión con Google'}
        </button>

        {iniciando && (
          <p className="mt-4 text-xs text-slate-400">
            Completa el inicio de sesión en la ventana del navegador que se abrió.
            Al terminar, vuelve a esta ventana.
          </p>
        )}
      </div>
    </div>
  )
}
