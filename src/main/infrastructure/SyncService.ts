import type { IGraphRepository } from '../domain/IGraphRepository'
import { reindexarVault } from '../application/ReindexarVault'
import type { SupabaseDataService } from './SupabaseDataService'
import type { VaultFileSystemService } from './VaultFileSystemService'
import {
  planificarSincronizacion,
  type BaseItem,
  type ItemRemoto,
  type TablaAgregado
} from './sincronizacion'

/** Resultado de una sincronización: qué se subió, bajó y borró en cada lado. */
export interface ResultadoSync {
  subidos: number
  bajados: number
  borradosNube: number
  /** Borrados en local (propagados desde la nube). */
  borradosLocal: number
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
  private enCurso = false
  /** Si llega una petición de sync mientras hay una en curso, se repite al terminar. */
  private repetir = false

  constructor(
    private readonly vault: VaultFileSystemService,
    private readonly repositorio: IGraphRepository,
    private readonly datos: SupabaseDataService
  ) {}

  /**
   * Sincroniza, serializando llamadas concurrentes: si ya hay una en curso,
   * marca que debe repetirse al terminar (así los cambios que llegan mientras
   * sincroniza no se pierden) y devuelve un resultado vacío.
   */
  async sincronizar(): Promise<ResultadoSync> {
    if (this.enCurso) {
      this.repetir = true
      return { subidos: 0, bajados: 0, borradosNube: 0, borradosLocal: 0 }
    }
    this.enCurso = true
    let resultado: ResultadoSync = { subidos: 0, bajados: 0, borradosNube: 0, borradosLocal: 0 }
    try {
      do {
        this.repetir = false
        resultado = await this.ejecutar()
      } while (this.repetir)
    } finally {
      this.enCurso = false
    }
    return resultado
  }

  private async ejecutar(): Promise<ResultadoSync> {
    let subidos = 0
    let bajados = 0
    let borradosNube = 0
    let borradosLocal = 0

    const base = this.vault.leerBaseSync()
    const baseNueva: Record<TablaAgregado, BaseItem[]> = {
      conceptos: [],
      asignaturas: [],
      tareas: []
    }

    for (const tabla of TABLAS) {
      const locales = this.vault.leerAgregadosLocales(tabla)
      const remotos: ItemRemoto[] = (await this.datos.listar(tabla)).map((r) => ({
        id: r.id,
        datos: r.datos,
        actualizadoEnMs: r.actualizadoEnMs
      }))

      const plan = planificarSincronizacion(locales, remotos, base[tabla])
      for (const item of plan.subir) {
        await this.datos.guardar(tabla, item.id, item.datos)
        subidos++
      }
      for (const item of plan.bajar) {
        this.vault.escribirAgregadoLocal(tabla, item.id, item.datos)
        bajados++
      }
      for (const id of plan.borrarRemoto) {
        await this.datos.eliminar(tabla, id)
        borradosNube++
      }
      for (const id of plan.borrarLocal) {
        this.vault.eliminarAgregadoLocal(tabla, id)
        borradosLocal++
      }
      baseNueva[tabla] = plan.baseFinal
    }

    // Guarda la nueva base (qué queda sincronizado) para detectar futuros borrados.
    this.vault.guardarBaseSync(baseNueva)

    // Si cambió el vault local (bajó o se borró algo), el índice debe reflejarlo.
    if (bajados > 0 || borradosLocal > 0) reindexarVault(this.vault, this.repositorio)

    return { subidos, bajados, borradosNube, borradosLocal }
  }
}
