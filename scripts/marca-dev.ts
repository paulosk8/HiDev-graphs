/**
 * Pone la marca de PedagoGraph al Electron de desarrollo.
 *
 * En macOS, el nombre que se ve en el dock, en el conmutador de apps y como
 * primer menú de la barra NO sale de `app.setName()`: sale del paquete que
 * ejecuta la app. Con `npm run dev` ese paquete es `Electron.app` (dentro de
 * node_modules), así que el docente ve "Electron" por todas partes.
 *
 * Este script reescribe el nombre y el icono de ese paquete local. Solo afecta
 * a esta copia de node_modules (se rehace con cada `npm install`, por eso se
 * ejecuta también en `postinstall`) y no toca nada del sistema. La aplicación
 * ya empaquetada no lo necesita: llevará su propio paquete.
 *
 * Uso: `npm run marca-dev` (o automáticamente tras `npm install`).
 */
import { execFileSync } from 'node:child_process'
import { copyFileSync, existsSync, utimesSync } from 'node:fs'
import { join } from 'node:path'

const NOMBRE = 'PedagoGraph'
const RAIZ = process.cwd()
const APP = join(RAIZ, 'node_modules', 'electron', 'dist', 'Electron.app')
const PLIST = join(APP, 'Contents', 'Info.plist')
const ICONO_ORIGEN = join(RAIZ, 'resources', 'icon.icns')
const ICONO_DESTINO = join(APP, 'Contents', 'Resources', 'electron.icns')

function main(): void {
  // Solo macOS: en Windows y Linux el nombre visible sale del título de la
  // ventana y del identificador de aplicación, que ya son los correctos.
  if (process.platform !== 'darwin') return
  if (!existsSync(PLIST)) {
    console.log('No hay Electron.app en node_modules; nada que marcar.')
    return
  }

  for (const clave of ['CFBundleName', 'CFBundleDisplayName']) {
    execFileSync('plutil', ['-replace', clave, '-string', NOMBRE, PLIST])
  }

  // El icono del paquete (el que ve Finder y el conmutador de apps).
  if (existsSync(ICONO_ORIGEN)) copyFileSync(ICONO_ORIGEN, ICONO_DESTINO)

  // macOS cachea nombre e icono por fecha del paquete: al tocarlo, los relee.
  const ahora = new Date()
  utimesSync(APP, ahora, ahora)

  console.log(`Electron de desarrollo marcado como "${NOMBRE}".`)
}

try {
  main()
} catch (error) {
  // Nunca debe romper un `npm install`: es solo cosmético.
  console.log('No se pudo marcar el Electron de desarrollo:', (error as Error).message)
}
