import { useState } from 'react'
import type { CarpetaNubeDTO } from '@shared/dtos'
import { Boton } from '../../components/Boton'
import { Modal } from '../../components/Modal'
import { api } from '../../lib/api'
import { useUiStore } from '../../stores/uiStore'

/** Enlace de ayuda para instalar el cliente de nube (se abre en el navegador). */
export const AYUDA_DRIVE = 'https://support.google.com/drive/answer/10838124'
export const NOMBRE_POR_DEFECTO = 'PedagoGraph'

/** Último segmento de una ruta (nombre de la carpeta), para mostrarlo. */
function nombreDeRuta(ruta: string): string {
  const partes = ruta.split(/[\\/]/).filter(Boolean)
  return partes[partes.length - 1] ?? ruta
}

/** Una ubicación posible donde crear la carpeta del material. */
interface Ubicacion {
  etiqueta: string
  ruta: string
  /** true si es una carpeta de nube detectada (Drive/OneDrive). */
  esNube: boolean
}

/**
 * Diálogo tipo Obsidian: elegir ubicación (nube detectada o buscar carpeta) +
 * nombre de la carpeta, con vista previa. Crea `<ubicación>/<nombre>`.
 *
 * `onListo` (opcional) se llama cuando la elección no requiere recargar la
 * ventana (p. ej. ya estaba ahí): lo usa la bienvenida para entrar a la app.
 */
export function DialogoGuardarNube({
  carpetas,
  onCerrar,
  onListo
}: {
  carpetas: CarpetaNubeDTO[]
  onCerrar: () => void
  onListo?: () => void
}): JSX.Element {
  const notificar = useUiStore((s) => s.notificar)
  const notificarError = useUiStore((s) => s.notificarError)

  const [ubicaciones, setUbicaciones] = useState<Ubicacion[]>(
    carpetas.map((c) => ({ etiqueta: c.etiqueta, ruta: c.ruta, esNube: true }))
  )
  const [seleccion, setSeleccion] = useState<string | null>(carpetas[0]?.ruta ?? null)
  const [nombre, setNombre] = useState(NOMBRE_POR_DEFECTO)
  const [guardando, setGuardando] = useState(false)

  const seleccionada = ubicaciones.find((u) => u.ruta === seleccion) ?? null
  const nombreLimpio = nombre.trim()
  const puedeGuardar = !!seleccionada && nombreLimpio.length > 0 && !guardando

  const buscar = async (): Promise<void> => {
    try {
      const ruta = await api.elegirCarpetaAlmacenamiento()
      if (!ruta) return
      setUbicaciones((prev) =>
        prev.some((u) => u.ruta === ruta)
          ? prev
          : [...prev, { etiqueta: nombreDeRuta(ruta), ruta, esNube: false }]
      )
      setSeleccion(ruta)
    } catch (error) {
      notificarError(error)
    }
  }

  const guardar = async (): Promise<void> => {
    if (!seleccionada || !nombreLimpio) return
    setGuardando(true)
    try {
      const r = await api.usarAlmacenamientoNube(seleccionada.ruta, nombreLimpio)
      if (r.sinCambios) {
        notificar({ tipo: 'info', mensaje: 'Tu material ya se guardaba en esa carpeta.' })
        setGuardando(false)
        if (onListo) onListo()
        else onCerrar()
      } else {
        // El proceso principal aplica el cambio y recarga la ventana enseguida.
        notificar({
          tipo: 'exito',
          mensaje: r.adoptado
            ? 'Encontramos tu material en esa carpeta. Actualizando…'
            : 'Listo. Aplicando el cambio…'
        })
      }
    } catch (error) {
      notificarError(error)
      setGuardando(false)
    }
  }

  return (
    <Modal
      titulo="Guardar mi material en la nube"
      descripcion="Se copiará a la carpeta que elijas y tu nube lo sincronizará entre tus equipos."
      ancho="lg"
      onCerrar={() => !guardando && onCerrar()}
    >
      <div className="space-y-5">
        {/* Ubicación */}
        <div>
          <p className="mb-2 text-sm font-medium text-slate-700">Ubicación</p>
          <div className="space-y-1.5">
            {ubicaciones.map((u) => (
              <button
                key={u.ruta}
                onClick={() => setSeleccion(u.ruta)}
                className={`flex w-full items-center gap-3 rounded-lg border p-3 text-left transition ${
                  seleccion === u.ruta
                    ? 'border-marca-400 bg-marca-50'
                    : 'border-slate-200 hover:bg-slate-50'
                }`}
              >
                <span aria-hidden>{u.esNube ? '☁️' : '📁'}</span>
                <span className="min-w-0 flex-1 truncate text-sm text-slate-800">{u.etiqueta}</span>
                <span
                  aria-hidden
                  className={`h-4 w-4 shrink-0 rounded-full border-2 ${
                    seleccion === u.ruta ? 'border-marca-500 bg-marca-500' : 'border-slate-300'
                  }`}
                />
              </button>
            ))}

            {ubicaciones.length === 0 && (
              <p className="rounded-lg border border-dashed border-slate-300 bg-slate-50 p-3 text-xs text-slate-500">
                No detectamos Google Drive ni OneDrive. Usa “Buscar otra carpeta…” para elegir dónde
                guardar.{' '}
                <a
                  href={AYUDA_DRIVE}
                  target="_blank"
                  rel="noreferrer"
                  className="font-medium text-marca-700 hover:underline"
                >
                  ¿Cómo activar Google Drive?
                </a>
              </p>
            )}

            <button
              onClick={() => void buscar()}
              className="flex w-full items-center gap-2 rounded-lg border border-dashed border-slate-300 p-3 text-left text-sm font-medium text-marca-700 transition hover:bg-marca-50"
            >
              <span aria-hidden>＋</span> Buscar otra carpeta…
            </button>
          </div>
        </div>

        {/* Nombre de la carpeta */}
        <div>
          <label htmlFor="nombre-carpeta" className="mb-1 block text-sm font-medium text-slate-700">
            Nombre de la carpeta
          </label>
          <input
            id="nombre-carpeta"
            value={nombre}
            onChange={(e) => setNombre(e.target.value)}
            placeholder={NOMBRE_POR_DEFECTO}
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-800 focus:border-marca-400 focus:outline-none focus:ring-1 focus:ring-marca-400"
          />
        </div>

        {/* Vista previa */}
        {seleccionada && nombreLimpio && (
          <div className="flex items-center gap-2 rounded-lg bg-slate-50 px-3 py-2.5 text-xs text-slate-600">
            <span aria-hidden>📁</span>
            <span className="min-w-0 truncate">
              Se guardará en{' '}
              <span className="font-medium text-slate-800">{seleccionada.etiqueta}</span> ›{' '}
              <span className="font-medium text-slate-800">{nombreLimpio}</span>
            </span>
          </div>
        )}

        <div className="flex justify-end gap-2">
          <Boton variante="secundario" onClick={onCerrar} disabled={guardando}>
            Cancelar
          </Boton>
          <Boton variante="primario" onClick={() => void guardar()} disabled={!puedeGuardar}>
            {guardando ? 'Guardando…' : 'Guardar aquí'}
          </Boton>
        </div>
      </div>
    </Modal>
  )
}
