import { app } from 'electron'
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

/**
 * Preferencias de la app que viven FUERA del vault (por-equipo), en la carpeta
 * de datos de usuario de Electron. Aquí se guarda dónde quiere el docente que
 * viva su material: en este equipo o dentro de una carpeta de nube (Google
 * Drive / OneDrive) que su cliente de escritorio ya sincroniza.
 *
 * Se guarda aparte del vault a propósito: la ruta del vault no puede vivir
 * dentro del propio vault, y el índice/estado de sync debe ser por-equipo.
 */

export type ModoAlmacenamiento = 'local' | 'nube'

export interface ConfigApp {
  /**
   * true cuando el usuario ya completó la bienvenida (eligió dónde guardar su
   * material). Si es false/ausente, la app muestra la pantalla de bienvenida.
   */
  configurado?: boolean
  /** Modo elegido por el usuario. 'local' = carpeta Documentos (por defecto). */
  modoAlmacenamiento: ModoAlmacenamiento
  /**
   * Ruta absoluta y COMPLETA de la carpeta del vault cuando está en la nube
   * (p. ej. `…/Google Drive/Mi unidad/PedagoGraph`). El usuario elige tanto la
   * ubicación como el nombre de la carpeta. Undefined en modo 'local'.
   */
  rutaVaultNube?: string
  /**
   * (Heredado) Carpeta contenedora de versiones anteriores; el vault era
   * `<rutaContenedorNube>/PedagoGraph`. Solo se lee para migrar a `rutaVaultNube`.
   */
  rutaContenedorNube?: string
}

const CONFIG_POR_DEFECTO: ConfigApp = { modoAlmacenamiento: 'local' }

/** Ruta del archivo de configuración por-equipo (userData/config.json). */
function rutaConfig(): string {
  return join(app.getPath('userData'), 'config.json')
}

/** Lee la configuración; devuelve valores por defecto si no existe o está corrupta. */
export function leerConfigApp(): ConfigApp {
  try {
    const ruta = rutaConfig()
    if (!existsSync(ruta)) return { ...CONFIG_POR_DEFECTO }
    const o = JSON.parse(readFileSync(ruta, 'utf8')) as Partial<ConfigApp>
    const modo: ModoAlmacenamiento = o.modoAlmacenamiento === 'nube' ? 'nube' : 'local'
    // Compatibilidad: una config anterior con ruta de nube ya estaba configurada.
    const configurado =
      o.configurado === true ||
      typeof o.rutaVaultNube === 'string' ||
      typeof o.rutaContenedorNube === 'string'
    return {
      configurado,
      modoAlmacenamiento: modo,
      rutaVaultNube: typeof o.rutaVaultNube === 'string' ? o.rutaVaultNube : undefined,
      rutaContenedorNube:
        typeof o.rutaContenedorNube === 'string' ? o.rutaContenedorNube : undefined
    }
  } catch {
    return { ...CONFIG_POR_DEFECTO }
  }
}

/** Escribe la configuración (crea la carpeta userData si hiciera falta). */
export function guardarConfigApp(config: ConfigApp): void {
  const ruta = rutaConfig()
  mkdirSync(join(app.getPath('userData')), { recursive: true })
  writeFileSync(ruta, JSON.stringify(config, null, 2), 'utf8')
}

/** Carpeta por-equipo donde vive el índice SQLite y el estado de sincronización. */
export function rutaIndicePorEquipo(): string {
  return join(app.getPath('userData'), 'indice')
}

/** Ruta del vault en modo 'local' (carpeta Documentos del usuario). */
export function rutaVaultLocalPorDefecto(): string {
  return join(app.getPath('documents'), 'PedagoGraph')
}

/** Nombre de carpeta por defecto sugerido al crear el vault en la nube. */
export const NOMBRE_VAULT_POR_DEFECTO = 'PedagoGraph'

/**
 * Resuelve la ruta del vault a partir de la configuración guardada.
 * En modo 'nube': la ruta completa elegida (`rutaVaultNube`), o —para configs
 * heredadas— `<rutaContenedorNube>/PedagoGraph`. Si no, la local (Documentos).
 */
export function resolverRutaVault(config: ConfigApp = leerConfigApp()): string {
  if (config.modoAlmacenamiento === 'nube') {
    if (config.rutaVaultNube) return config.rutaVaultNube
    if (config.rutaContenedorNube) {
      return join(config.rutaContenedorNube, NOMBRE_VAULT_POR_DEFECTO)
    }
  }
  return rutaVaultLocalPorDefecto()
}
