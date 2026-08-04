import { existsSync, readdirSync, statSync } from 'node:fs'
import { homedir } from 'node:os'
import { join } from 'node:path'

/**
 * Detección de carpetas de nube ya instaladas en el equipo (Opción A).
 *
 * NO usamos APIs ni OAuth de los proveedores: aprovechamos que el cliente de
 * escritorio de Google Drive / OneDrive ya mantiene una carpeta local
 * sincronizada. Aquí solo BUSCAMOS esa carpeta con `existsSync` para ofrecerla
 * al docente; poner el vault dentro basta para que la nube lo sincronice sola.
 *
 * `ruta` es la carpeta contenedora: la app creará dentro un subdirectorio
 * "PedagoGraph". Soporta macOS y Windows.
 */

export type ProveedorNube = 'google' | 'onedrive'

export interface CarpetaNube {
  proveedor: ProveedorNube
  /** Nombre amigable para la UI ("Google Drive", "OneDrive · Trabajo"). */
  etiqueta: string
  /** Carpeta contenedora donde vivirá "PedagoGraph". */
  ruta: string
}

/** ¿Es una carpeta existente y accesible? */
function esCarpeta(ruta: string): boolean {
  try {
    return existsSync(ruta) && statSync(ruta).isDirectory()
  } catch {
    return false
  }
}

/**
 * Carpeta "Mi unidad" / "My Drive" dentro de un Google Drive, o null si no
 * existe. El material debe ir ahí (área sincronizada), nunca en la raíz de la
 * cuenta (que también contiene "Ordenadores" y "Unidades compartidas").
 */
function unidadGoogleDrive(base: string): string | null {
  for (const sub of ['Mi unidad', 'My Drive']) {
    const ruta = join(base, sub)
    if (esCarpeta(ruta)) return ruta
  }
  return null
}

/** Convierte "GoogleDrive-user@gmail.com" → "user@gmail.com" (detalle de cuenta). */
function detalleCuenta(nombreCarpeta: string): string {
  const guion = nombreCarpeta.indexOf('-')
  return guion >= 0 ? nombreCarpeta.slice(guion + 1).trim() : ''
}

/** Detección específica de macOS (~/Library/CloudStorage y rutas heredadas). */
function detectarMac(hogar: string): CarpetaNube[] {
  const encontradas: CarpetaNube[] = []
  const cloudStorage = join(hogar, 'Library', 'CloudStorage')

  if (esCarpeta(cloudStorage)) {
    let entradas: string[] = []
    try {
      entradas = readdirSync(cloudStorage)
    } catch {
      entradas = []
    }
    for (const entrada of entradas) {
      const base = join(cloudStorage, entrada)
      if (!esCarpeta(base)) continue

      if (entrada.startsWith('GoogleDrive')) {
        const ruta = unidadGoogleDrive(base)
        if (ruta) {
          const cuenta = detalleCuenta(entrada)
          encontradas.push({
            proveedor: 'google',
            etiqueta: cuenta ? `Google Drive · ${cuenta}` : 'Google Drive',
            ruta
          })
        }
      } else if (entrada.startsWith('OneDrive')) {
        const cuenta = detalleCuenta(entrada)
        encontradas.push({
          proveedor: 'onedrive',
          etiqueta: cuenta ? `OneDrive · ${cuenta}` : 'OneDrive',
          ruta: base
        })
      }
    }
  }

  // Rutas heredadas (clientes antiguos) por si CloudStorage no aplica.
  const legadoGoogle = join(hogar, 'Google Drive')
  if (esCarpeta(legadoGoogle)) {
    encontradas.push({ proveedor: 'google', etiqueta: 'Google Drive', ruta: legadoGoogle })
  }
  const legadoOneDrive = join(hogar, 'OneDrive')
  if (esCarpeta(legadoOneDrive)) {
    encontradas.push({ proveedor: 'onedrive', etiqueta: 'OneDrive', ruta: legadoOneDrive })
  }

  return encontradas
}

/** Detección específica de Windows (variables de entorno + unidades montadas). */
function detectarWindows(hogar: string): CarpetaNube[] {
  const encontradas: CarpetaNube[] = []

  // OneDrive expone su ruta en variables de entorno cuando está activo.
  const varsOneDrive = [
    process.env.OneDrive,
    process.env.OneDriveConsumer,
    process.env.OneDriveCommercial
  ]
  for (const v of varsOneDrive) {
    if (v && esCarpeta(v)) {
      encontradas.push({ proveedor: 'onedrive', etiqueta: 'OneDrive', ruta: v })
    }
  }
  const oneDrivePerfil = join(hogar, 'OneDrive')
  if (esCarpeta(oneDrivePerfil)) {
    encontradas.push({ proveedor: 'onedrive', etiqueta: 'OneDrive', ruta: oneDrivePerfil })
  }

  // Google Drive: cliente antiguo (carpeta en el perfil) o unidad virtual (G:, H:…).
  const googlePerfil = join(hogar, 'Google Drive')
  if (esCarpeta(googlePerfil)) {
    encontradas.push({ proveedor: 'google', etiqueta: 'Google Drive', ruta: googlePerfil })
  }
  const LETRAS = 'DEFGHIJKLMNOPQRSTUVWXYZ'.split('')
  for (const letra of LETRAS) {
    const ruta = unidadGoogleDrive(`${letra}:\\`)
    if (ruta) {
      encontradas.push({ proveedor: 'google', etiqueta: `Google Drive (${letra}:)`, ruta })
    }
  }

  return encontradas
}

/**
 * Devuelve las carpetas de nube detectadas en el equipo, sin duplicados.
 * Lista vacía = no hay Google Drive ni OneDrive instalados (la UI lo indica).
 */
export function detectarCarpetasNube(): CarpetaNube[] {
  const hogar = homedir()
  const brutas =
    process.platform === 'win32' ? detectarWindows(hogar) : detectarMac(hogar)

  // Dedup por ruta, conservando la primera etiqueta encontrada.
  const vistas = new Set<string>()
  const unicas: CarpetaNube[] = []
  for (const c of brutas) {
    const clave = c.ruta.toLowerCase()
    if (vistas.has(clave)) continue
    vistas.add(clave)
    unicas.push(c)
  }
  return unicas
}
