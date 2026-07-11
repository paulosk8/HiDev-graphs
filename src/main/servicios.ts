import { app } from 'electron'
import { join } from 'node:path'

import { reindexarVault } from './application/ReindexarVault'
import { SqliteGraphRepository } from './infrastructure/SqliteGraphRepository'
import { VaultFileSystemService } from './infrastructure/VaultFileSystemService'

export interface Servicios {
  vault: VaultFileSystemService
  repositorio: SqliteGraphRepository
}

/**
 * Inicializa los servicios del núcleo (backend) al arrancar la app:
 *  1. Resuelve la ruta del vault en la carpeta Documentos del usuario.
 *  2. Crea el vault si no existe (cero configuración, sin preguntar nada).
 *  3. Abre el índice SQLite (crea el esquema si hace falta).
 *  4. Reconstruye el índice desde los YAML para dejarlo consistente.
 */
export function inicializarServicios(rutaVaultForzada?: string): Servicios {
  const rutaVault = rutaVaultForzada ?? join(app.getPath('documents'), 'PedagoGraph')

  const vault = new VaultFileSystemService(rutaVault)
  vault.asegurarVault()

  const repositorio = new SqliteGraphRepository(vault.rutaBaseDatos)
  const resultado = reindexarVault(vault, repositorio)

  console.log(
    `[PedagoGraph] Vault en ${rutaVault} — indexados ${resultado.conceptos} conceptos y ${resultado.asignaturas} asignaturas.`
  )

  return { vault, repositorio }
}
