/**
 * Genera los iconos de la aplicación a partir de `resources/icon.svg`.
 *
 * No añade dependencias: rasteriza el SVG con el propio Chromium de Electron
 * (canvas) y empaqueta los resultados en los formatos que espera cada sistema:
 *
 *   resources/icon.png     1024×1024 — origen genérico (Linux, empaquetado)
 *   resources/icon.icns    macOS (dock, Finder, instalador)
 *   resources/icon.ico     Windows (ejecutable, accesos directos)
 *   resources/icons/*.png  tamaños sueltos (el de 512 lo usa la ventana)
 *
 * Van en `resources/` y no en `build/` porque esa carpeta sí se versiona: al
 * empaquetar basta apuntar ahí (`directories.buildResources`).
 *
 * Uso: `npm run iconos` (tras editar el SVG).
 */
import { app, BrowserWindow } from 'electron'
import { execFileSync } from 'node:child_process'
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

// El script se empaqueta a node_modules/.cache, así que la raíz del proyecto es
// el directorio desde el que npm lo ejecuta, no la del archivo.
const RAIZ = process.cwd()
const DIR_RECURSOS = join(RAIZ, 'resources')
const SVG = join(DIR_RECURSOS, 'icon.svg')
const DIR_PNG = join(DIR_RECURSOS, 'icons')

/** Tamaños que necesitamos rasterizar (unión de los que piden macOS y Windows). */
const TAMANOS = [16, 32, 48, 64, 128, 256, 512, 1024]

/** Rasteriza el SVG al tamaño pedido usando canvas dentro de la ventana. */
async function rasterizar(ventana: BrowserWindow, svgBase64: string, tamano: number): Promise<Buffer> {
  const dataUrl = (await ventana.webContents.executeJavaScript(`
    (async () => {
      const img = new Image()
      img.src = 'data:image/svg+xml;base64,${svgBase64}'
      await img.decode()
      const lienzo = document.createElement('canvas')
      lienzo.width = ${tamano}
      lienzo.height = ${tamano}
      const ctx = lienzo.getContext('2d')
      ctx.clearRect(0, 0, ${tamano}, ${tamano})
      ctx.drawImage(img, 0, 0, ${tamano}, ${tamano})
      return lienzo.toDataURL('image/png')
    })()
  `)) as string
  return Buffer.from(dataUrl.slice(dataUrl.indexOf(',') + 1), 'base64')
}

/**
 * Empaqueta varios PNG en un .ico. El formato es una cabecera de 6 bytes, una
 * entrada de 16 bytes por imagen y los PNG concatenados (Windows Vista+ admite
 * PNG dentro de ICO, así que no hace falta convertir a BMP).
 */
function construirIco(imagenes: { tamano: number; png: Buffer }[]): Buffer {
  const cabecera = Buffer.alloc(6)
  cabecera.writeUInt16LE(0, 0) // reservado
  cabecera.writeUInt16LE(1, 2) // 1 = icono
  cabecera.writeUInt16LE(imagenes.length, 4)

  const entradas: Buffer[] = []
  let desplazamiento = 6 + imagenes.length * 16
  for (const { tamano, png } of imagenes) {
    const entrada = Buffer.alloc(16)
    // 256 se codifica como 0 (el campo es de un solo byte).
    entrada.writeUInt8(tamano >= 256 ? 0 : tamano, 0)
    entrada.writeUInt8(tamano >= 256 ? 0 : tamano, 1)
    entrada.writeUInt8(0, 2) // colores de la paleta
    entrada.writeUInt8(0, 3) // reservado
    entrada.writeUInt16LE(1, 4) // planos
    entrada.writeUInt16LE(32, 6) // bits por píxel
    entrada.writeUInt32LE(png.length, 8)
    entrada.writeUInt32LE(desplazamiento, 12)
    entradas.push(entrada)
    desplazamiento += png.length
  }

  return Buffer.concat([cabecera, ...entradas, ...imagenes.map((i) => i.png)])
}

/** Construye el .icns con `iconutil` (solo disponible en macOS). */
function construirIcns(porTamano: Map<number, Buffer>): boolean {
  if (process.platform !== 'darwin') return false
  const iconset = join(DIR_RECURSOS, 'icon.iconset')
  rmSync(iconset, { recursive: true, force: true })
  mkdirSync(iconset, { recursive: true })
  // Nombres exigidos por iconutil: base y su versión @2x (el doble de píxeles).
  const nombres: [string, number][] = [
    ['icon_16x16.png', 16],
    ['icon_16x16@2x.png', 32],
    ['icon_32x32.png', 32],
    ['icon_32x32@2x.png', 64],
    ['icon_128x128.png', 128],
    ['icon_128x128@2x.png', 256],
    ['icon_256x256.png', 256],
    ['icon_256x256@2x.png', 512],
    ['icon_512x512.png', 512],
    ['icon_512x512@2x.png', 1024]
  ]
  for (const [nombre, tamano] of nombres) {
    writeFileSync(join(iconset, nombre), porTamano.get(tamano)!)
  }
  execFileSync('iconutil', ['-c', 'icns', iconset, '-o', join(DIR_RECURSOS, 'icon.icns')])
  rmSync(iconset, { recursive: true, force: true })
  return true
}

async function main(): Promise<void> {
  if (!existsSync(SVG)) {
    console.error(`No encuentro ${SVG}`)
    app.exit(1)
    return
  }
  mkdirSync(DIR_PNG, { recursive: true })

  const svgBase64 = readFileSync(SVG).toString('base64')
  const ventana = new BrowserWindow({ show: false, width: 64, height: 64 })
  await ventana.loadURL('data:text/html,<html><body></body></html>')

  const porTamano = new Map<number, Buffer>()
  for (const tamano of TAMANOS) {
    const png = await rasterizar(ventana, svgBase64, tamano)
    porTamano.set(tamano, png)
    writeFileSync(join(DIR_PNG, `icon-${tamano}.png`), png)
  }

  writeFileSync(join(DIR_RECURSOS, 'icon.png'), porTamano.get(1024)!)
  writeFileSync(
    join(DIR_RECURSOS, 'icon.ico'),
    construirIco([16, 32, 48, 64, 128, 256].map((t) => ({ tamano: t, png: porTamano.get(t)! })))
  )
  const conIcns = construirIcns(porTamano)

  console.log(
    `Iconos generados en resources/: icon.png (1024), icon.ico${conIcns ? ', icon.icns' : ' — icon.icns solo se genera en macOS'} y icons/ (${TAMANOS.join(', ')}).`
  )
  ventana.destroy()
  app.exit(0)
}

void app.whenReady().then(main)
