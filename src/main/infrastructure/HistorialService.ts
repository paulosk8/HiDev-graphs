import { createHash } from 'node:crypto'
import { existsSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

import type { Asignatura } from '../domain/Asignatura'
import type { Concepto } from '../domain/Concepto'
import type { Tarea } from '../domain/Tarea'
import type { VaultFileSystemService } from './VaultFileSystemService'

/**
 * Historial de versiones del material (opción "snapshots gestionados por la app").
 *
 * Cada vez que un concepto, asignatura o tarea cambia, se guarda una copia
 * (snapshot JSON) en una carpeta POR-EQUIPO dentro de userData —fuera del vault—,
 * para no viajar por la nube y no ensuciar la carpeta del docente. Permite ver el
 * historial de modificaciones y restaurar una versión anterior.
 *
 * Es local por equipo a propósito: es un "deshacer histórico" del propio equipo,
 * simple y seguro. Solo versiona el contenido (los agregados), no los archivos
 * de material binarios (pdf/pptx), que son grandes y no cambian tras subirse.
 */

export type TablaHistorial = 'conceptos' | 'asignaturas' | 'tareas'

const TABLAS: readonly TablaHistorial[] = ['conceptos', 'asignaturas', 'tareas']
/** Máximo de versiones que se conservan por elemento (se podan las más antiguas). */
const MAX_VERSIONES = 40

interface Snapshot {
  hash: string
  nombre: string
  capturadoEnMs: number
  /** Resumen legible de la versión (para la interfaz). */
  resumen: string
  /** El agregado de dominio serializado. */
  datos: unknown
}

export interface ItemHistorial {
  tabla: TablaHistorial
  id: string
  nombre: string
  versiones: number
  ultimaMs: number
}

export interface VersionHistorial {
  versionId: string
  capturadoEnMs: number
  resumen: string
}

export class HistorialService {
  constructor(
    private readonly vault: VaultFileSystemService,
    private readonly rutaHistorial: string
  ) {}

  // ---------------------------------------------------------------------------
  // Captura
  // ---------------------------------------------------------------------------

  /** Recorre todos los agregados y guarda una versión de los que hayan cambiado. */
  capturar(): void {
    try {
      for (const c of this.vault.leerTodosConceptos()) {
        this.capturarUno('conceptos', c.id, c.nombre, c)
      }
      for (const a of this.vault.leerTodasAsignaturas()) {
        this.capturarUno('asignaturas', a.id, a.nombre, a)
      }
      for (const t of this.vault.leerTodasTareas()) {
        this.capturarUno('tareas', t.id, t.titulo, t)
      }
    } catch {
      /* El historial es auxiliar: si falla una captura, la app sigue igual. */
    }
  }

  private capturarUno(tabla: TablaHistorial, id: string, nombre: string, datos: unknown): void {
    const json = JSON.stringify(datos)
    const hash = createHash('sha1').update(json).digest('hex')
    if (this.ultimoHash(tabla, id) === hash) return

    const dir = this.dir(tabla, id)
    mkdirSync(dir, { recursive: true })
    const capturadoEnMs = Date.now()
    const snapshot: Snapshot = {
      hash,
      nombre,
      capturadoEnMs,
      resumen: this.resumen(tabla, datos as Record<string, unknown>),
      datos
    }
    writeFileSync(join(dir, `${capturadoEnMs}.json`), JSON.stringify(snapshot), 'utf8')
    this.podar(dir)
  }

  // ---------------------------------------------------------------------------
  // Lectura
  // ---------------------------------------------------------------------------

  /** Elementos con historial (2+ versiones = han cambiado al menos una vez). */
  listarItems(): ItemHistorial[] {
    const items: ItemHistorial[] = []
    for (const tabla of TABLAS) {
      const base = join(this.rutaHistorial, tabla)
      if (!existsSync(base)) continue
      for (const id of readdirSync(base)) {
        const archivos = this.archivosOrdenados(join(base, id))
        if (archivos.length < 2) continue
        const ultimo = this.leerSnapshot(tabla, id, archivos[archivos.length - 1])
        if (!ultimo) continue
        items.push({
          tabla,
          id,
          nombre: ultimo.nombre,
          versiones: archivos.length,
          ultimaMs: ultimo.capturadoEnMs
        })
      }
    }
    return items.sort((a, b) => b.ultimaMs - a.ultimaMs)
  }

  /** Versiones de un elemento, de la más reciente a la más antigua. */
  listarVersiones(tabla: TablaHistorial, id: string): VersionHistorial[] {
    return this.archivosOrdenados(this.dir(tabla, id))
      .reverse()
      .map((archivo) => {
        const s = this.leerSnapshot(tabla, id, archivo)
        return s
          ? {
              versionId: archivo.replace('.json', ''),
              capturadoEnMs: s.capturadoEnMs,
              resumen: s.resumen
            }
          : null
      })
      .filter((v): v is VersionHistorial => v !== null)
  }

  /** Restaura una versión anterior escribiéndola de vuelta en el vault. */
  restaurar(tabla: TablaHistorial, id: string, versionId: string): void {
    const snapshot = this.leerSnapshot(tabla, id, `${versionId}.json`)
    if (!snapshot) return
    if (tabla === 'conceptos') this.vault.guardarConcepto(snapshot.datos as Concepto)
    else if (tabla === 'asignaturas') this.vault.guardarAsignatura(snapshot.datos as Asignatura)
    else this.vault.guardarTarea(snapshot.datos as Tarea)
    // El observador reindexa y captura la versión restaurada como la más reciente.
  }

  // ---------------------------------------------------------------------------
  // Utilidades
  // ---------------------------------------------------------------------------

  private dir(tabla: TablaHistorial, id: string): string {
    return join(this.rutaHistorial, tabla, id)
  }

  /** Nombres de archivo de versión, ascendente por marca de tiempo. */
  private archivosOrdenados(dir: string): string[] {
    if (!existsSync(dir)) return []
    return readdirSync(dir)
      .filter((f) => f.endsWith('.json'))
      .sort((a, b) => parseInt(a, 10) - parseInt(b, 10))
  }

  private leerSnapshot(tabla: TablaHistorial, id: string, archivo: string): Snapshot | null {
    try {
      return JSON.parse(readFileSync(join(this.dir(tabla, id), archivo), 'utf8')) as Snapshot
    } catch {
      return null
    }
  }

  private ultimoHash(tabla: TablaHistorial, id: string): string | null {
    const archivos = this.archivosOrdenados(this.dir(tabla, id))
    if (archivos.length === 0) return null
    return this.leerSnapshot(tabla, id, archivos[archivos.length - 1])?.hash ?? null
  }

  private podar(dir: string): void {
    const archivos = this.archivosOrdenados(dir)
    for (let i = 0; i < archivos.length - MAX_VERSIONES; i++) {
      rmSync(join(dir, archivos[i]), { force: true })
    }
  }

  /** Resumen legible de una versión, según su tipo. */
  private resumen(tabla: TablaHistorial, datos: Record<string, unknown>): string {
    const texto = (k: string): string => (typeof datos[k] === 'string' ? (datos[k] as string) : '')
    const cuantos = (k: string): number => (Array.isArray(datos[k]) ? (datos[k] as unknown[]).length : 0)

    if (tabla === 'tareas') {
      const instr = texto('instrucciones').replace(/\s+/g, ' ').trim().slice(0, 80)
      return [texto('titulo') || 'Tarea', instr].filter(Boolean).join(' — ')
    }
    if (tabla === 'asignaturas') {
      const unidades = cuantos('unidades')
      return [texto('nombre') || 'Asignatura', unidades ? `${unidades} unidades` : '']
        .filter(Boolean)
        .join(' · ')
    }
    // conceptos
    const extras = [
      cuantos('recursos') ? `${cuantos('recursos')} materiales` : '',
      cuantos('notas') ? `${cuantos('notas')} notas` : '',
      cuantos('relaciones') ? `${cuantos('relaciones')} relaciones` : ''
    ].filter(Boolean)
    return [texto('nombre') || 'Concepto', texto('descripcion'), extras.join(' · ')]
      .filter(Boolean)
      .join(' — ')
  }
}
