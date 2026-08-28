import { useEffect, useState } from 'react'
import type { CarpetaNubeDTO, MaterialEnCarpetaDTO, ResumenCarpetaDTO } from '@shared/dtos'
import { Boton } from '../../components/Boton'
import { Modal } from '../../components/Modal'
import { api } from '../../lib/api'
import { useLecturaStore } from '../../stores/lecturaStore'
import { useUiStore } from '../../stores/uiStore'

/** Enlace de ayuda para instalar el cliente de nube (se abre en el navegador). */
export const AYUDA_DRIVE = 'https://support.google.com/drive/answer/10838124'
export const NOMBRE_POR_DEFECTO = 'PedagoGraph'

/** Último segmento de una ruta (nombre de la carpeta), para mostrarlo. */
function nombreDeRuta(ruta: string): string {
  const partes = ruta.split(/[\\/]/).filter(Boolean)
  return partes[partes.length - 1] ?? ruta
}

/** Separa una carpeta en (ubicación que la contiene, nombre de la carpeta). */
function separarRuta(ruta: string): { contenedor: string; nombre: string } | null {
  const m = /^(.*)[\\/]([^\\/]+)[\\/]*$/.exec(ruta)
  return m && m[2] ? { contenedor: m[1], nombre: m[2] } : null
}

/** Compara rutas ignorando mayúsculas (macOS y Windows no distinguen). */
function mismaRuta(a: string | null, b: string | null): boolean {
  return !!a && !!b && a.toLowerCase() === b.toLowerCase()
}

/** Una ubicación posible donde crear la carpeta del material. */
interface Ubicacion {
  etiqueta: string
  ruta: string
  /** Dónde está, en corto. Dos nubes pueden llamarse igual; la ruta no. */
  rutaVisible: string
  /** true si es una carpeta de nube detectada (Drive/OneDrive). */
  esNube: boolean
  /** true si el docente la quitó de la lista. */
  oculta: boolean
}

/** Acorta la carpeta personal a `~`, como hace el proceso principal. */
function acortar(ruta: string): string {
  const m = /^(\/Users\/[^/]+|\/home\/[^/]+|[A-Za-z]:\\Users\\[^\\]+)(.*)$/.exec(ruta)
  return m ? `~${m[2]}` : ruta
}

/** "15 conceptos · 3 asignaturas", o null si esa carpeta no tiene material. */
function resumenMaterial(m: ResumenCarpetaDTO | null | undefined): string | null {
  if (!m || !m.esMaterial) return null
  const partes: string[] = []
  if (m.conceptos > 0) partes.push(`${m.conceptos} ${m.conceptos === 1 ? 'concepto' : 'conceptos'}`)
  if (m.asignaturas > 0)
    partes.push(`${m.asignaturas} ${m.asignaturas === 1 ? 'asignatura' : 'asignaturas'}`)
  return partes.length > 0 ? partes.join(' · ') : null
}

/**
 * De las dos carpetas inspeccionadas, cuál es "el material" de esa fila.
 *
 * Si la carpeta señalada YA es material, es ella: señalar la carpeta del
 * material y que la app cree otra dentro (`PedagoGraph/PedagoGraph`) es una
 * trampa, y es exactamente la duda que le surge a cualquiera al elegir.
 */
function materialDe(info: MaterialEnCarpetaDTO | undefined): ResumenCarpetaDTO | null {
  if (!info) return null
  if (info.elegida.esMaterial) return info.elegida
  if (info.dentro.esMaterial) return info.dentro
  return null
}

/**
 * Diálogo tipo Obsidian: elegir ubicación (nube detectada o buscar carpeta) +
 * nombre de la carpeta, con vista previa. Crea `<ubicación>/<nombre>`.
 *
 * `carpetaActual` (opcional) es la carpeta donde vive hoy el material: sirve
 * para preseleccionarla y permitir CAMBIARLA (p. ej. pasar de Google Drive a
 * OneDrive) mostrando qué ocurre con la carpeta anterior.
 *
 * `onListo` (opcional) se llama cuando la elección no requiere recargar la
 * ventana (p. ej. ya estaba ahí): lo usa la bienvenida para entrar a la app.
 */
export function DialogoGuardarNube({
  carpetas,
  carpetaActual,
  onCerrar,
  onListo
}: {
  carpetas: CarpetaNubeDTO[]
  carpetaActual?: string
  onCerrar: () => void
  onListo?: () => void
}): JSX.Element {
  const notificar = useUiStore((s) => s.notificar)
  const notificarError = useUiStore((s) => s.notificarError)

  // Dónde vive hoy el material, partido en ubicación + nombre de carpeta.
  const actual = carpetaActual ? separarRuta(carpetaActual) : null
  const detectadas: Ubicacion[] = carpetas.map((c) => ({
    etiqueta: c.etiqueta,
    ruta: c.ruta,
    rutaVisible: c.rutaVisible,
    esNube: true,
    oculta: c.oculta
  }))
  // La ubicación actual puede no estar entre las detectadas (una carpeta elegida
  // a mano): se añade a la lista para poder verla y volver a ella.
  const coincidente = actual ? detectadas.find((u) => mismaRuta(u.ruta, actual.contenedor)) : undefined
  const rutaActual = coincidente?.ruta ?? actual?.contenedor ?? null

  const [ubicaciones, setUbicaciones] = useState<Ubicacion[]>(
    actual && !coincidente
      ? [
          ...detectadas,
          {
            etiqueta: nombreDeRuta(actual.contenedor),
            ruta: actual.contenedor,
            rutaVisible: acortar(actual.contenedor),
            esNube: false,
            oculta: false
          }
        ]
      : detectadas
  )
  const [seleccion, setSeleccion] = useState<string | null>(
    rutaActual ?? carpetas[0]?.ruta ?? null
  )
  const [nombre, setNombre] = useState(actual?.nombre ?? NOMBRE_POR_DEFECTO)
  const [guardando, setGuardando] = useState(false)
  /** Qué material hay ya en cada ubicación candidata, indexado por su ruta. */
  const [material, setMaterial] = useState<Record<string, MaterialEnCarpetaDTO>>({})
  /** El docente pidió ver también las ubicaciones que había quitado. */
  const [verOcultas, setVerOcultas] = useState(false)
  const [buscandoMaterial, setBuscandoMaterial] = useState(true)

  // Al abrir, la app busca sola carpetas de material dentro de las nubes del
  // equipo y las añade a la lista. Sin esto solo se ofrecen las RAÍCES de cada
  // nube, y el material del docente suele estar dos carpetas más adentro: le
  // tocaba recordar dónde y llegar con el explorador.
  useEffect(() => {
    let cancelado = false
    void api
      .buscarMaterialExistente()
      .then((encontrados) => {
        if (cancelado || encontrados.length === 0) return
        setUbicaciones((prev) => {
          const yaEsta = (r: string): boolean => prev.some((u) => mismaRuta(u.ruta, r))
          const nuevas = encontrados
            .filter((m) => !yaEsta(m.ruta))
            .map((m) => ({
              etiqueta: m.nombre,
              ruta: m.ruta,
              rutaVisible: m.rutaVisible,
              esNube: false,
              oculta: false
            }))
          return nuevas.length > 0 ? [...prev, ...nuevas] : prev
        })
      })
      .catch(() => undefined)
      .finally(() => {
        if (!cancelado) setBuscandoMaterial(false)
      })
    return () => {
      cancelado = true
    }
  }, [])

  // Las ubicaciones quitadas no se ofrecen, salvo que se pidan expresamente o
  // sea donde vive el material ahora mismo (esa nunca se esconde).
  const visibles = ubicaciones.filter(
    (u) => verOcultas || !u.oculta || mismaRuta(u.ruta, rutaActual)
  )
  const nOcultas = ubicaciones.filter(
    (u) => u.oculta && !mismaRuta(u.ruta, rutaActual)
  ).length

  const seleccionada = ubicaciones.find((u) => u.ruta === seleccion) ?? null
  const nombreLimpio = nombre.trim()

  // Mira en cada ubicación si ya hay material con ese nombre de carpeta. Es lo
  // que permite distinguir dos nubes que se llaman igual sin entender de rutas:
  // una dice "15 conceptos" y la otra no dice nada. Solo lista carpetas, así
  // que es barato; se reconsulta al cambiar el nombre, con un respiro para no
  // disparar una consulta por tecla pulsada.
  useEffect(() => {
    if (!nombreLimpio) return undefined
    let cancelado = false
    const temporizador = setTimeout(() => {
      void Promise.all(
        ubicaciones.map(async (u) => {
          try {
            return [u.ruta, await api.inspeccionarCarpetaMaterial(u.ruta, nombreLimpio)] as const
          } catch {
            return null
          }
        })
      ).then((pares) => {
        if (cancelado) return
        setMaterial(Object.fromEntries(pares.filter((p): p is NonNullable<typeof p> => p !== null)))
      })
    }, 250)
    return () => {
      cancelado = true
      clearTimeout(temporizador)
    }
  }, [ubicaciones, nombreLimpio])
  const infoSel = seleccionada ? material[seleccionada.ruta] : undefined
  // Si la carpeta señalada ya ES material, se usa tal cual: no se crea otra
  // carpeta dentro. Entonces el nombre no pinta nada y se oculta.
  const laElegidaEsMaterial = infoSel?.elegida.esMaterial === true
  const materialDestino = laElegidaEsMaterial ? infoSel.elegida : infoSel?.dentro

  // Lo que se hará al confirmar. "Abrir" cuando el destino ya trae material:
  // se trabaja con él tal cual. "Mover" cuando está vacío o es nuevo: se lleva
  // allí el material de ahora. Son cosas distintas y el botón lo dice.
  const accion: 'mover' | 'abrir' = materialDestino?.esMaterial ? 'abrir' : 'mover'

  // Qué se le manda al proceso principal: contenedor + nombre. Al señalar la
  // carpeta del material, el contenedor es su carpeta padre.
  const partesDestino = seleccionada
    ? laElegidaEsMaterial
      ? separarRuta(seleccionada.ruta)
      : { contenedor: seleccionada.ruta, nombre: nombreLimpio }
    : null

  const puedeGuardar =
    !!seleccionada && !!partesDestino && (laElegidaEsMaterial || nombreLimpio.length > 0) && !guardando
  // ¿El destino elegido es exactamente donde ya está el material?
  const esElMismoSitio =
    !!actual &&
    !!partesDestino &&
    mismaRuta(partesDestino.contenedor, actual.contenedor) &&
    partesDestino.nombre.toLowerCase() === actual.nombre.toLowerCase()

  /** Material que hay ahora mismo donde vive el vault, para poder decir que se queda. */
  const materialActual = actual ? material[actual.contenedor]?.dentro : undefined

  /** Quita una ubicación de la lista (o la devuelve). No toca el disco. */
  const alternarOculta = async (ruta: string, oculta: boolean): Promise<void> => {
    setUbicaciones((prev) => prev.map((u) => (u.ruta === ruta ? { ...u, oculta } : u)))
    if (oculta && seleccion === ruta) setSeleccion(rutaActual)
    try {
      await api.ocultarUbicacion(ruta, oculta)
    } catch (error) {
      notificarError(error)
    }
  }

  const buscar = async (): Promise<void> => {
    try {
      const ruta = await api.elegirCarpetaAlmacenamiento()
      if (!ruta) return
      setUbicaciones((prev) =>
        prev.some((u) => u.ruta === ruta)
          ? prev
          : [
              ...prev,
              {
                etiqueta: nombreDeRuta(ruta),
                ruta,
                rutaVisible: acortar(ruta),
                esNube: false,
                oculta: false
              }
            ]
      )
      setSeleccion(ruta)
    } catch (error) {
      notificarError(error)
    }
  }

  const guardar = async (): Promise<void> => {
    if (!partesDestino) return
    setGuardando(true)
    try {
      const r = await api.usarAlmacenamientoNube(
        partesDestino.contenedor,
        partesDestino.nombre,
        accion
      )
      if (r.sinCambios) {
        // Elegir la carpeta en la que ya estabas no cambiaba nada, y desde
        // fuera eso se ve como "no carga". Ahora se vuelve a leer el material:
        // si lo que fallaba era la nube, esta pasada lo recupera.
        notificar({
          tipo: 'info',
          mensaje: 'Tu material ya se guardaba en esa carpeta. Volvemos a leerla…'
        })
        await useLecturaStore.getState().reintentar()
        setGuardando(false)
        if (onListo) onListo()
        else onCerrar()
      } else {
        // El proceso principal aplica el cambio y recarga la ventana enseguida.
        notificar({
          tipo: 'exito',
          mensaje: r.abierto
            ? 'Abriendo tu material…'
            : r.adoptado
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
      titulo={actual ? 'Cambiar dónde se guarda mi material' : 'Guardar mi material en la nube'}
      descripcion={
        actual
          ? 'Elige otra ubicación (por ejemplo tu OneDrive) y copiaremos ahí todo tu material.'
          : 'Se copiará a la carpeta que elijas y tu nube lo sincronizará entre tus equipos.'
      }
      ancho="lg"
      onCerrar={() => !guardando && onCerrar()}
    >
      <div className="space-y-5">
        {/* Ubicación */}
        <div>
          <p className="mb-2 text-sm font-medium text-slate-700">Ubicación</p>
          <div className="space-y-1.5">
            {visibles.map((u) => (
              <div
                key={u.ruta}
                className={`group flex w-full items-center gap-3 rounded-lg border p-3 text-left transition ${
                  seleccion === u.ruta
                    ? 'border-marca-400 bg-marca-50'
                    : 'border-slate-200 hover:bg-slate-50'
                } ${u.oculta ? 'opacity-50' : ''}`}
              >
                <button
                  onClick={() => setSeleccion(u.ruta)}
                  className="flex min-w-0 flex-1 items-center gap-3 text-left"
                >
                  <span aria-hidden className="mt-0.5 self-start">
                    {u.esNube ? '☁️' : '📁'}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm text-slate-800">{u.etiqueta}</span>
                    {/* La ruta es la única forma de distinguir dos carpetas que
                        se llaman igual (p. ej. "Personal" y "Personal(2)"). */}
                    <span className="block truncate text-[11px] text-slate-400">
                      {u.rutaVisible}
                    </span>
                    {resumenMaterial(materialDe(material[u.ruta])) && (
                      <span className="mt-1 inline-block rounded-full bg-emerald-100 px-2 py-0.5 text-[11px] font-medium text-emerald-800">
                        Aquí está tu material · {resumenMaterial(materialDe(material[u.ruta]))}
                      </span>
                    )}
                  </span>
                </button>
                {mismaRuta(u.ruta, rutaActual) && (
                  <span className="shrink-0 self-start rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-medium text-slate-600">
                    Ahora aquí
                  </span>
                )}
                {/* Quitar de la lista. Nunca sobre la carpeta que se usa ahora:
                    esconderla dejaría al docente sin saber dónde está. */}
                {!mismaRuta(u.ruta, rutaActual) && (
                  <button
                    onClick={() => void alternarOculta(u.ruta, !u.oculta)}
                    title={u.oculta ? 'Volver a mostrar esta ubicación' : 'Quitar de la lista'}
                    aria-label={u.oculta ? 'Volver a mostrar esta ubicación' : 'Quitar de la lista'}
                    className="shrink-0 self-start rounded px-1.5 text-slate-400 opacity-0 transition hover:bg-slate-200 hover:text-slate-700 focus:opacity-100 group-hover:opacity-100"
                  >
                    {u.oculta ? '↩' : '✕'}
                  </button>
                )}
                <button
                  onClick={() => setSeleccion(u.ruta)}
                  aria-label={`Elegir ${u.etiqueta}`}
                  className={`mt-0.5 h-4 w-4 shrink-0 self-start rounded-full border-2 ${
                    seleccion === u.ruta ? 'border-marca-500 bg-marca-500' : 'border-slate-300'
                  }`}
                />
              </div>
            ))}

            {nOcultas > 0 && (
              <button
                onClick={() => setVerOcultas((v) => !v)}
                className="w-full px-3 py-1 text-left text-xs font-medium text-slate-500 hover:text-slate-800"
              >
                {verOcultas
                  ? 'Ocultar las que quité'
                  : `Mostrar ${nOcultas} ${nOcultas === 1 ? 'ubicación quitada' : 'ubicaciones quitadas'}`}
              </button>
            )}

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

            {buscandoMaterial && (
              <p className="px-3 py-1 text-xs text-slate-500">Buscando tu material…</p>
            )}
          </div>
        </div>

        {/* Nombre de la carpeta. Al señalar una carpeta que YA es material no
            se pregunta: se usa esa, no se crea otra dentro. */}
        <div className={laElegidaEsMaterial ? 'hidden' : undefined}>
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
        {partesDestino && (
          <div className="flex items-center gap-2 rounded-lg bg-slate-50 px-3 py-2.5 text-xs text-slate-600">
            <span aria-hidden>📁</span>
            <span className="min-w-0 truncate">
              {accion === 'abrir' ? 'Se abrirá ' : 'Se guardará en '}
              <span className="font-medium text-slate-800">
                {nombreDeRuta(partesDestino.contenedor)}
              </span>{' '}
              › <span className="font-medium text-slate-800">{partesDestino.nombre}</span>
            </span>
          </div>
        )}

        {/* Abrir material que ya existe: no se copia NADA. Decirlo importa,
            porque el aviso de "copiaremos todo" asusta justo cuando lo que se
            quiere es recuperar el material de siempre. */}
        {accion === 'abrir' && !esElMismoSitio && (
          <p className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2.5 text-xs text-emerald-900">
            Se abrirá el material que ya hay en esa carpeta
            {resumenMaterial(materialDestino) ? ` (${resumenMaterial(materialDestino)})` : ''}. No se
            copia ni se mezcla nada.
            {resumenMaterial(materialActual)
              ? ` Lo que tienes ahora (${resumenMaterial(materialActual)}) se queda intacto en su carpeta.`
              : ''}
          </p>
        )}

        {/* Mover: nada se borra, la carpeta anterior queda de respaldo. */}
        {accion === 'mover' && actual && !esElMismoSitio && (
          <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2.5 text-xs text-amber-800">
            Esa carpeta está vacía, así que copiaremos allí todo tu material. La carpeta anterior (
            <span className="font-medium">{actual.nombre}</span>) se conservará como respaldo: cuando
            compruebes que todo está bien, puedes borrarla desde tu nube.
          </p>
        )}

        <div className="flex justify-end gap-2">
          <Boton variante="secundario" onClick={onCerrar} disabled={guardando}>
            Cancelar
          </Boton>
          <Boton variante="primario" onClick={() => void guardar()} disabled={!puedeGuardar}>
            {guardando
              ? 'Guardando…'
              : esElMismoSitio
                ? 'Volver a leer'
                : accion === 'abrir'
                  ? 'Abrir este material'
                  : actual
                    ? 'Mover aquí'
                    : 'Guardar aquí'}
          </Boton>
        </div>
      </div>
    </Modal>
  )
}
