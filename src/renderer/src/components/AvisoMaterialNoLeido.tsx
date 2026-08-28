import type { CausaLectura, ElementoNoLeidoDTO, EstadoLecturaDTO } from '@shared/dtos'
import { Boton } from './Boton'
import { hayMaterialSinLeer, useLecturaStore } from '../stores/lecturaStore'
import { useUiStore } from '../stores/uiStore'

/** Cómo se llama cada cosa en la interfaz (nunca "nodo", "YAML" ni carpetas). */
const ETIQUETA_TIPO: Record<ElementoNoLeidoDTO['tipo'], string> = {
  concepto: 'Concepto',
  asignatura: 'Asignatura',
  tarea: 'Tarea',
  lienzo: 'Lienzo'
}

function nombreDe(elemento: ElementoNoLeidoDTO): string {
  const etiqueta = ETIQUETA_TIPO[elemento.tipo]
  return elemento.nombre ? `${etiqueta}: ${elemento.nombre}` : `${etiqueta} sin nombre`
}

/**
 * Explicación en lenguaje humano de por qué falta material, con la acción que
 * le toca al docente. El caso frecuente es el primero: el material vive en una
 * carpeta de nube que no ha iniciado sesión o que no tiene internet detrás.
 */
function explicacion(estado: EstadoLecturaDTO): string {
  const donde = estado.enNube ? estado.nombreAlmacenamiento : 'la carpeta donde guardas tu material'

  const porCausa: Record<CausaLectura, string> = {
    nube: estado.hayConexion
      ? `Tu material se guarda en ${donde} y ahora mismo no responde. Comprueba que has iniciado sesión y que la sincronización está activa.`
      : `Tu material se guarda en ${donde} y este equipo no tiene conexión a internet, así que no se puede descargar.`,
    ubicacion: `La carpeta de ${donde} donde guardas tu material ya no está en este equipo. Suele pasar cuando la nube vuelve a conectar la cuenta y cambia la carpeta de sitio. No se ha borrado nada: elige de nuevo dónde está tu material y volverá a aparecer.`,
    permisos: `Este equipo no tiene permiso para abrir algunos archivos de ${donde}.`,
    dañado:
      'Algunos archivos se abrieron, pero su contenido no se entiende. Puedes recuperarlos desde Configuración, en el historial de versiones o en una copia de seguridad.',
    desconocida: `No se pudo abrir parte de lo que hay en ${donde}.`
  }

  return porCausa[estado.causa]
}

/**
 * Aviso fijo mientras haya material ilegible.
 *
 * No es un toast: mientras falte material, el listado que el docente está
 * mirando está incompleto, y eso tiene que verse todo el tiempo, no cuatro
 * segundos. Se cierra a mano y reaparece si el problema cambia.
 */
export function AvisoMaterialNoLeido(): JSX.Element | null {
  const estado = useLecturaStore((s) => s.estado)
  const oculto = useLecturaStore((s) => s.oculto)
  const reintentando = useLecturaStore((s) => s.reintentando)
  const reintentar = useLecturaStore((s) => s.reintentar)
  const ocultar = useLecturaStore((s) => s.ocultar)
  const irAConfiguracion = useUiStore((s) => s.alternarConfiguracion)

  if (!estado || !hayMaterialSinLeer(estado) || oculto) return null

  // Perder la ubicación no es "no se pudo abrir": no hay nada que abrir, y lo
  // que toca no es reintentar sino volver a decir dónde está el material.
  const ubicacionPerdida = estado.causa === 'ubicacion'

  const titulo = ubicacionPerdida
    ? 'No encontramos la carpeta de tu material'
    : estado.carpetaCompleta
    ? 'No se pudo abrir tu material'
    : estado.total === 1
      ? 'Falta 1 elemento de tu material'
      : `Faltan ${estado.total} elementos de tu material`

  const noListados = estado.total - estado.elementos.length

  return (
    <div
      role="alert"
      className="border-b border-amber-200 bg-amber-50 px-6 py-3 text-amber-900"
    >
      <div className="flex items-start gap-3">
        <span aria-hidden className="mt-0.5 text-base leading-none">
          ⚠
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold">{titulo}</p>
          <p className="mt-0.5 text-sm">
            {explicacion(estado)}
            {!ubicacionPerdida && ' No se ha borrado nada: vuelve a aparecer en cuanto se pueda leer.'}
          </p>

          {!ubicacionPerdida && estado.elementos.length > 0 && (
            <ul className="mt-2 flex flex-wrap gap-1.5">
              {estado.elementos.map((e) => (
                <li
                  key={`${e.tipo}-${e.nombre}`}
                  className="rounded-full bg-amber-100 px-2.5 py-0.5 text-xs"
                >
                  {nombreDe(e)}
                </li>
              ))}
              {noListados > 0 && (
                <li className="px-1 py-0.5 text-xs opacity-80">y {noListados} más</li>
              )}
            </ul>
          )}

          <div className="mt-2.5 flex items-center gap-2">
            {ubicacionPerdida && (
              <Boton
                variante="secundario"
                onClick={irAConfiguracion}
                className="border-amber-300 bg-white/70 text-amber-900 hover:bg-white"
              >
                Elegir dónde está mi material
              </Boton>
            )}
            <Boton
              variante="secundario"
              onClick={() => void reintentar()}
              disabled={reintentando}
              className="border-amber-300 bg-white/70 text-amber-900 hover:bg-white"
            >
              {reintentando ? 'Buscando tu material…' : ubicacionPerdida ? 'Volver a buscar' : 'Reintentar'}
            </Boton>
          </div>
        </div>
        <button
          onClick={ocultar}
          className="text-sm opacity-60 transition hover:opacity-100"
          aria-label="Cerrar aviso"
        >
          ✕
        </button>
      </div>
    </div>
  )
}
