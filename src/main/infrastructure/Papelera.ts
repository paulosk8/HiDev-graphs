import { cpSync, existsSync, mkdirSync, readdirSync, renameSync, rmSync, statSync } from 'node:fs'
import { extname, join } from 'node:path'

/**
 * Qué hace la app cuando el docente elimina algo (concepto, asignatura, tarea,
 * material o adjunto). Al estilo Obsidian:
 *
 *  - `papelera`    → se mueve a una carpeta "Eliminados" DENTRO de la carpeta del
 *                    material, así se puede recuperar (y viaja por la nube junto
 *                    al resto, de modo que se recupera desde cualquier equipo).
 *  - `permanente`  → se borra del disco y no hay vuelta atrás.
 *
 * No se ofrece la papelera del sistema operativo a propósito: cuando el material
 * vive en Google Drive / OneDrive, mandar algo a la papelera del equipo hace que
 * el cliente de nube lo interprete como un borrado y lo propague a los demás
 * equipos, que es justo lo contrario de "por si acaso".
 */
export type ModoEliminacion = 'papelera' | 'permanente'

/** Nombre —visible y en español— de la carpeta de eliminados dentro del vault. */
export const NOMBRE_CARPETA_ELIMINADOS = 'Eliminados'

/** Normaliza un valor cualquiera al modo de eliminación (papelera por defecto). */
export function modoEliminacionDesde(valor: unknown): ModoEliminacion {
  return valor === 'permanente' ? 'permanente' : 'papelera'
}

/**
 * Nombre libre dentro de `carpeta`: si `deseado` ya existe (se eliminó algo con
 * el mismo nombre antes), añade un sufijo numérico en vez de pisarlo. Conserva
 * la extensión, para que un archivo recuperado siga abriéndose con su programa.
 */
function nombreLibre(carpeta: string, deseado: string): string {
  if (!existsSync(join(carpeta, deseado))) return deseado

  const ext = extname(deseado)
  const base = deseado.slice(0, deseado.length - ext.length)
  let n = 2
  while (existsSync(join(carpeta, `${base}-${n}${ext}`))) n += 1
  return `${base}-${n}${ext}`
}

/**
 * Mueve `ruta` (archivo o carpeta) a `<dirEliminados>/<subcarpeta>/`.
 * Devuelve la ruta resultante dentro de la carpeta de eliminados.
 *
 * `subcarpeta` reproduce la estructura del vault ("conceptos", "asignaturas",
 * "tareas", "material/<concepto>") para que el docente reconozca qué era cada
 * cosa y pueda devolverla a su sitio arrastrándola.
 */
export function moverAEliminados(ruta: string, dirEliminados: string, subcarpeta: string): string {
  const destinoDir = join(dirEliminados, subcarpeta)
  mkdirSync(destinoDir, { recursive: true })

  const nombre = nombreLibre(destinoDir, basenameDe(ruta))
  const destino = join(destinoDir, nombre)

  try {
    renameSync(ruta, destino)
  } catch {
    // `rename` falla entre volúmenes distintos (p. ej. una carpeta de nube
    // montada aparte): copiar y borrar el original es el plan B.
    cpSync(ruta, destino, { recursive: true })
    rmSync(ruta, { recursive: true, force: true })
  }
  return destino
}

/** Último segmento de una ruta, sin depender del separador del sistema. */
function basenameDe(ruta: string): string {
  const limpia = ruta.replace(/[\\/]+$/, '')
  const corte = Math.max(limpia.lastIndexOf('/'), limpia.lastIndexOf('\\'))
  return corte === -1 ? limpia : limpia.slice(corte + 1)
}

/**
 * Elimina `ruta` según el modo elegido. Si no existe, no hace nada (eliminar
 * dos veces lo mismo no debe reventar). Es la ÚNICA puerta de salida de datos
 * del vault: todo borrado del material pasa por aquí.
 */
export function eliminarRuta(
  ruta: string,
  opciones: { modo: ModoEliminacion; dirEliminados: string; subcarpeta: string }
): void {
  if (!existsSync(ruta)) return

  if (opciones.modo === 'permanente') {
    rmSync(ruta, { recursive: true, force: true })
    return
  }
  moverAEliminados(ruta, opciones.dirEliminados, opciones.subcarpeta)
}

/** ¿Hay algo en la carpeta de eliminados? (para ofrecer "Vaciar" solo si toca). */
export function hayEliminados(dirEliminados: string): boolean {
  try {
    if (!existsSync(dirEliminados) || !statSync(dirEliminados).isDirectory()) return false
    return readdirSync(dirEliminados).length > 0
  } catch {
    return false
  }
}

/** Vacía la carpeta de eliminados (borrado definitivo, sin vuelta atrás). */
export function vaciarEliminados(dirEliminados: string): void {
  rmSync(dirEliminados, { recursive: true, force: true })
}
