/**
 * Pone la marca de PedagoGraph al Electron de desarrollo.
 *
 * En macOS, el nombre que se ve en el dock, en el conmutador de apps y como
 * primer menú de la barra NO sale de `app.setName()`: sale del paquete que
 * ejecuta la app. Con `npm run dev` ese paquete es el Electron de node_modules,
 * así que el docente ve "Electron" por todas partes.
 *
 * No basta con reescribir `CFBundleName`/`CFBundleDisplayName`: para el tile del
 * Dock manda también el **nombre del propio paquete**, así que hay que renombrar
 * `Electron.app` a `PedagoGraph.app` y reapuntar `path.txt` (el archivo donde el
 * paquete npm `electron` guarda la ruta de su ejecutable).
 *
 * Solo afecta a esta copia de node_modules (se rehace con cada `npm install`,
 * por eso se ejecuta también en `postinstall`) y no toca nada del sistema. La
 * aplicación ya empaquetada no lo necesita: llevará su propio paquete.
 *
 * Uso: `npm run marca-dev` (o automáticamente tras `npm install`).
 */
import { execFileSync } from 'node:child_process'
import { copyFileSync, existsSync, renameSync, utimesSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

const NOMBRE = 'PedagoGraph'
const RAIZ = process.cwd()
const DIR_ELECTRON = join(RAIZ, 'node_modules', 'electron')
const DIST = join(DIR_ELECTRON, 'dist')
/** Donde el paquete npm `electron` guarda la ruta de su ejecutable. */
const PATH_TXT = join(DIR_ELECTRON, 'path.txt')
const APP_ORIGEN = join(DIST, 'Electron.app')
const APP = join(DIST, `${NOMBRE}.app`)
const ICONO_ORIGEN = join(RAIZ, 'resources', 'icon.icns')

/** Re-registra el paquete en LaunchServices para que el Dock relea nombre e icono. */
function reregistrar(ruta: string): void {
  const lsregister =
    '/System/Library/Frameworks/CoreServices.framework/Frameworks/LaunchServices.framework/Support/lsregister'
  if (existsSync(lsregister)) execFileSync(lsregister, ['-f', ruta])
}

function main(): void {
  // Solo macOS: en Windows y Linux el nombre visible sale del título de la
  // ventana y del identificador de aplicación, que ya son los correctos.
  if (process.platform !== 'darwin') return

  // Tras un `npm install` el paquete vuelve a llamarse Electron.app.
  if (existsSync(APP_ORIGEN) && !existsSync(APP)) renameSync(APP_ORIGEN, APP)

  const plist = join(APP, 'Contents', 'Info.plist')
  if (!existsSync(plist)) {
    console.log('No hay Electron en node_modules; nada que marcar.')
    return
  }

  // El ejecutable sigue llamándose Electron dentro del paquete renombrado.
  writeFileSync(PATH_TXT, `${NOMBRE}.app/Contents/MacOS/Electron`, 'utf-8')

  for (const clave of ['CFBundleName', 'CFBundleDisplayName']) {
    execFileSync('plutil', ['-replace', clave, '-string', NOMBRE, plist])
  }

  // El icono del paquete (el que ve Finder y el conmutador de apps).
  const icono = join(APP, 'Contents', 'Resources', 'electron.icns')
  if (existsSync(ICONO_ORIGEN)) copyFileSync(ICONO_ORIGEN, icono)

  // macOS cachea nombre e icono por fecha del paquete: al tocarlo, los relee.
  const ahora = new Date()
  utimesSync(APP, ahora, ahora)
  reregistrar(APP)

  console.log(`Electron de desarrollo marcado como "${NOMBRE}".`)
}

try {
  main()
} catch (error) {
  // Nunca debe romper un `npm install`: es solo cosmético.
  console.log('No se pudo marcar el Electron de desarrollo:', (error as Error).message)
}
