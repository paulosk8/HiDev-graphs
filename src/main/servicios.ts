import { reindexarVault } from './application/ReindexarVault'
import { resolverRutaVault, rutaIndicePorEquipo } from './infrastructure/configApp'
import { SqliteGraphRepository } from './infrastructure/SqliteGraphRepository'
import { VaultFileSystemService } from './infrastructure/VaultFileSystemService'

export interface Servicios {
  vault: VaultFileSystemService
  repositorio: SqliteGraphRepository
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

  const vault = new VaultFileSystemService(rutaVault, rutaIndice)
  vault.asegurarVault()

  const repositorio = new SqliteGraphRepository(vault.rutaBaseDatos)
  const resultado = reindexarVault(vault, repositorio)

  console.log(
    `[PedagoGraph] Vault en ${rutaVault} — indexados ${resultado.conceptos} conceptos y ${resultado.asignaturas} asignaturas.`
  )

  return { vault, repositorio }
}
