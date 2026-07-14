import type { IGraphRepository } from '../domain/IGraphRepository'
import { reindexarVault } from '../application/ReindexarVault'
import type { SupabaseDataService } from './SupabaseDataService'
import type { VaultFileSystemService } from './VaultFileSystemService'
import { ErrorDeDominio } from '../domain/errores'
import {
  canonizar,
  planificarSincronizacion,
  type BaseItem,
  type ConflictoGuardado,
  type ItemRemoto,
  type TablaAgregado
} from './sincronizacion'

/** Con qué versión quedarse al resolver un conflicto: la de este equipo o la de la nube. */
export type EleccionConflicto = 'local' | 'nube'

/** Resultado de una sincronización: qué se subió, bajó y borró en cada lado. */
export interface ResultadoSync {
  subidos: number
  bajados: number
  borradosNube: number
  /** Borrados en local (propagados desde la nube). */
  borradosLocal: number
  /** Conflictos reales pendientes de resolución manual. */
  conflictos: number
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
      return { subidos: 0, bajados: 0, borradosNube: 0, borradosLocal: 0, conflictos: 0 }
    }
    this.enCurso = true
    let resultado: ResultadoSync = {
      subidos: 0,
      bajados: 0,
      borradosNube: 0,
      borradosLocal: 0,
      conflictos: 0
    }
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

  /**
   * Resuelve un conflicto quedándose con la versión elegida (local o nube).
   * Aplica esa versión a AMBOS lados y marca el ítem como sincronizado, de modo
   * que la próxima sync ya no lo vea en conflicto. Requiere conexión (sube la
   * versión elegida primero: si falla, no se toca nada y el conflicto sigue).
   */
  async resolverConflicto(tabla: TablaAgregado, id: string, eleccion: EleccionConflicto): Promise<void> {
    const conflictos = this.vault.leerConflictos()
    const conflicto = conflictos.find((c) => c.tabla === tabla && c.id === id)
    if (!conflicto) {
      throw new ErrorDeDominio(
        'Ese conflicto ya no está pendiente.',
        'Puede que ya se resolviera o sincronizara. Actualiza la lista.'
      )
    }
    const elegido = eleccion === 'local' ? conflicto.local : conflicto.remoto

    // 1) Sube la versión elegida a la nube primero: si no hay red, aquí falla y
    //    no se modifica nada más (el conflicto sigue pendiente).
    await this.datos.guardar(tabla, id, elegido)
    // 2) Aplica esa versión en local.
    this.vault.escribirAgregadoLocal(tabla, id, elegido)
    // 3) Marca el ítem como sincronizado (base = contenido elegido).
    const base = this.vault.leerBaseSync()
    base[tabla] = base[tabla].filter((b) => b.id !== id)
    base[tabla].push({ id, hash: canonizar(elegido) })
    this.vault.guardarBaseSync(base)
    // 4) Quita el conflicto de la lista pendiente.
    this.vault.guardarConflictos(conflictos.filter((c) => !(c.tabla === tabla && c.id === id)))
    // 5) El vault local cambió → reindexa.
    reindexarVault(this.vault, this.repositorio)
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
    const conflictos: ConflictoGuardado[] = []

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
      for (const c of plan.conflictos) conflictos.push({ ...c, tabla })
      baseNueva[tabla] = plan.baseFinal
    }

    // Guarda la nueva base (qué queda sincronizado) para detectar futuros borrados.
    this.vault.guardarBaseSync(baseNueva)
    // Reemplaza la lista de conflictos pendientes por la recién detectada (los
    // resueltos ya no aparecen; los nuevos sí).
    this.vault.guardarConflictos(conflictos)

    // Si cambió el vault local (bajó o se borró algo), el índice debe reflejarlo.
    if (bajados > 0 || borradosLocal > 0) reindexarVault(this.vault, this.repositorio)

    return { subidos, bajados, borradosNube, borradosLocal, conflictos: conflictos.length }
  }
}
