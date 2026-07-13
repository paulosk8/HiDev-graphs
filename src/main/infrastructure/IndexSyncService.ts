import chokidar, { type FSWatcher } from 'chokidar'

import { reindexarVault } from '../application/ReindexarVault'
import type { IGraphRepository } from '../domain/IGraphRepository'
import type { VaultFileSystemService } from './VaultFileSystemService'

/**
 * Mantiene el índice sincronizado con el vault (archivos -> índice) observando
 * los cambios con chokidar. Ante cualquier cambio reconstruye el índice de forma
 * debounced y avisa (para que el renderer refresque sus vistas).
 *
 * Observa conceptos/, asignaturas/ y tareas/ (NO .index/), evitando reaccionar a
 * las escrituras del propio SQLite. Vigilar tareas/ permite que su auto-sync con
 * la nube también se dispare.
 */
export class IndexSyncService {
  private observador?: FSWatcher
  private temporizador?: ReturnType<typeof setTimeout>

  constructor(
    private readonly vault: VaultFileSystemService,
    private readonly repositorio: IGraphRepository,
    private readonly alSincronizar: () => void
  ) {}

  iniciar(): void {
    this.observador = chokidar.watch(
      [this.vault.dirConceptos, this.vault.dirAsignaturas, this.vault.dirTareas],
      {
        ignoreInitial: true,
        awaitWriteFinish: { stabilityThreshold: 300, pollInterval: 100 }
      }
    )

    const alCambiar = (): void => this.programarSincronizacion()
    this.observador
      .on('add', alCambiar)
      .on('change', alCambiar)
      .on('unlink', alCambiar)
      .on('addDir', alCambiar)
      .on('unlinkDir', alCambiar)
  }

  private programarSincronizacion(): void {
    if (this.temporizador) clearTimeout(this.temporizador)
    this.temporizador = setTimeout(() => {
      reindexarVault(this.vault, this.repositorio)
      this.alSincronizar()
    }, 400)
  }

  async detener(): Promise<void> {
    if (this.temporizador) clearTimeout(this.temporizador)
    await this.observador?.close()
  }
}
