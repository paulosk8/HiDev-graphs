import { existsSync } from 'node:fs'

import { reindexarVault } from './application/ReindexarVault'
import { leerConfigApp, resolverRutaVault, rutaIndicePorEquipo } from './infrastructure/configApp'
import { lecturasFallidas } from './infrastructure/IncidenciasLectura'
import { SqliteGraphRepository } from './infrastructure/SqliteGraphRepository'
import { VaultFileSystemService } from './infrastructure/VaultFileSystemService'

export interface Servicios {
  vault: VaultFileSystemService
  repositorio: SqliteGraphRepository
}

/**
 * ¿Sigue estando la carpeta de material que el docente eligió?
 *
 * Solo se comprueba cuando ya terminó la bienvenida Y el material vive en una
 * nube: es el único caso en el que la carpeta puede desaparecer sin que él haya
 * hecho nada. En macOS, `~/Library/CloudStorage/OneDrive-Personal(2)` deja de
 * existir en cuanto OneDrive re-vincula la cuenta; en Windows pasa igual si se
 * desconecta la unidad.
 *
 * Devuelve false y anota la incidencia si la carpeta ya no está. Quien llama
 * NO debe crear el vault en ese caso: crearlo es empezar de cero encima de
 * material que sigue existiendo en otro sitio, y el docente lo ve como
 * "se borró todo".
 */
export function comprobarUbicacionMaterial(rutaVault: string): boolean {
  const config = leerConfigApp()
  if (config.configurado !== true || config.modoAlmacenamiento !== 'nube') return true
  if (existsSync(rutaVault)) return true
  lecturasFallidas.registrarUbicacionPerdida(rutaVault)
  return false
}

/**
 * Inicializa los servicios del núcleo (backend) al arrancar la app:
 *  1. Resuelve la ruta del vault: la preferencia del usuario (local o una
 *     carpeta de nube) o, por defecto, la carpeta Documentos.
 *  2. Crea el vault si no existe (cero configuración, sin preguntar nada).
 *  3. Abre el índice SQLite (crea el esquema si hace falta).
 *  4. Reconstruye el índice desde los YAML para dejarlo consistente.
 *
 * El índice vive SIEMPRE por-equipo (userData), fuera del vault, para no
 * viajar por la nube cuando el vault está en Google Drive / OneDrive.
 */
export function inicializarServicios(rutaVaultForzada?: string): Servicios {
  // Con ruta forzada (tests/MCP) el índice queda dentro de ese vault, aislado.
  // En el arranque real, el índice vive por-equipo (userData), fuera del vault,
  // para no viajar por la nube cuando el material está en Google Drive/OneDrive.
  const rutaVault = rutaVaultForzada ?? resolverRutaVault()
  const rutaIndice = rutaVaultForzada ? undefined : rutaIndicePorEquipo()

  // La preferencia se lee en cada borrado (no se captura ahora) para que
  // cambiarla surta efecto sin reiniciar la app.
  const vault = new VaultFileSystemService(
    rutaVault,
    rutaIndice,
    () => leerConfigApp().modoEliminacion
  )
  // Si la carpeta de nube configurada ya no está, la app abre vacía y lo
  // explica, pero no fabrica un vault nuevo en su sitio. El índice sí se crea
  // siempre: vive fuera del material y sin él no arranca SQLite.
  if (rutaVaultForzada || comprobarUbicacionMaterial(rutaVault)) vault.asegurarVault()
  else vault.asegurarIndice()

  const repositorio = new SqliteGraphRepository(vault.rutaBaseDatos)
  const resultado = reindexarVault(vault, repositorio)

  console.log(
    `[PedagoGraph] Vault en ${rutaVault} — indexados ${resultado.conceptos} conceptos y ${resultado.asignaturas} asignaturas.`
  )

  return { vault, repositorio }
}
