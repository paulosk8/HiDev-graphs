import type { IGraphRepository } from '../domain/IGraphRepository'
import { reindexarVault } from '../application/ReindexarVault'
import type { SupabaseDataService } from './SupabaseDataService'
import type { VaultFileSystemService } from './VaultFileSystemService'
import { planificarSincronizacion, type ItemRemoto, type TablaAgregado } from './sincronizacion'

/** Resultado de una sincronización: cuántos agregados se subieron y bajaron. */
export interface ResultadoSync {
  subidos: number
  bajados: number
}

const TABLAS: readonly TablaAgregado[] = ['conceptos', 'asignaturas', 'tareas']

/**
 * Sincroniza el vault local con la nube (local-first): para cada tabla decide
 * qué subir y qué bajar (ver `sincronizacion.ts`), aplica los cambios y, si bajó
 * algo, reconstruye el índice local. Los archivos de material NO viajan: solo
 * su metadato dentro del JSON.
 *
 * Es de dos vías y bajo demanda (al iniciar sesión, al arrancar con sesión, o con
 * el botón "Sincronizar"). Si no hay red, la operación falla y la app sigue
 * funcionando con la copia local.
 */
export class SyncService {
  constructor(
    private readonly vault: VaultFileSystemService,
    private readonly repositorio: IGraphRepository,
    private readonly datos: SupabaseDataService
  ) {}

  async sincronizar(): Promise<ResultadoSync> {
    let subidos = 0
    let bajados = 0

    for (const tabla of TABLAS) {
      const locales = this.vault.leerAgregadosLocales(tabla)
      const remotos: ItemRemoto[] = (await this.datos.listar(tabla)).map((r) => ({
        id: r.id,
        datos: r.datos,
        actualizadoEnMs: r.actualizadoEnMs
      }))

      const plan = planificarSincronizacion(locales, remotos)
      for (const item of plan.subir) {
        await this.datos.guardar(tabla, item.id, item.datos)
        subidos++
      }
      for (const item of plan.bajar) {
        this.vault.escribirAgregadoLocal(tabla, item.id, item.datos)
        bajados++
      }
    }

    // Si bajaron datos de la nube, el índice local debe reflejarlos.
    if (bajados > 0) reindexarVault(this.vault, this.repositorio)

    return { subidos, bajados }
  }
}
