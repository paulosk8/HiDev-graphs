import Database from 'better-sqlite3'
import type { Asignatura } from '../domain/Asignatura'
import type { Concepto } from '../domain/Concepto'
import type { IGraphRepository } from '../domain/IGraphRepository'
import type {
  ResumenAsignatura,
  ResumenConcepto,
  UsoDeConcepto
} from '../domain/lecturas'
import { ESQUEMA_SQL } from './esquema'

/**
 * Implementación del repositorio del grafo sobre SQLite (better-sqlite3).
 *
 * Vive en el proceso main. El índice es reconstruible: `vaciar()` + `indexar*`
 * lo repueblan desde las entidades del vault.
 */
export class SqliteGraphRepository implements IGraphRepository {
  private readonly db: Database.Database

  constructor(rutaDb: string) {
    this.db = new Database(rutaDb)
    this.db.pragma('journal_mode = WAL')
    this.db.exec(ESQUEMA_SQL)
  }

  /** Cierra la conexión (usar al salir de la app). */
  cerrar(): void {
    this.db.close()
  }

  // --- Sincronización ---

  vaciar(): void {
    this.db.exec('DELETE FROM edges; DELETE FROM resources; DELETE FROM nodes;')
  }

  indexarConcepto(concepto: Concepto): void {
    const insertarNodo = this.db.prepare(
      `INSERT OR REPLACE INTO nodes (tipo, id, nombre, padre_tipo, padre_id, orden, periodo)
       VALUES ('concepto', @id, @nombre, NULL, NULL, NULL, NULL)`
    )
    const insertarRecurso = this.db.prepare(
      `INSERT OR REPLACE INTO resources (id, concepto_id, nombre, archivo, formato)
       VALUES (@id, @concepto_id, @nombre, @archivo, @formato)`
    )
    const insertarArista = this.db.prepare(
      `INSERT OR REPLACE INTO edges (origen_tipo, origen_id, destino_tipo, destino_id, tipo_relacion)
       VALUES ('concepto', @origen, 'concepto', @destino, @tipo)`
    )

    const tx = this.db.transaction((c: Concepto) => {
      insertarNodo.run({ id: c.id, nombre: c.nombre })
      for (const r of c.recursos) {
        insertarRecurso.run({
          id: r.id,
          concepto_id: c.id,
          nombre: r.nombre,
          archivo: r.archivo,
          formato: r.formato
        })
      }
      for (const rel of c.relaciones) {
        insertarArista.run({ origen: c.id, destino: rel.destino, tipo: rel.tipo })
      }
    })
    tx(concepto)
  }

  indexarAsignatura(asignatura: Asignatura): void {
    const insertarNodo = this.db.prepare(
      `INSERT OR REPLACE INTO nodes (tipo, id, nombre, padre_tipo, padre_id, orden, periodo)
       VALUES (@tipo, @id, @nombre, @padre_tipo, @padre_id, @orden, @periodo)`
    )
    const insertarArista = this.db.prepare(
      `INSERT OR REPLACE INTO edges (origen_tipo, origen_id, destino_tipo, destino_id, tipo_relacion)
       VALUES (@origen_tipo, @origen_id, @destino_tipo, @destino_id, @tipo)`
    )

    const tx = this.db.transaction((a: Asignatura) => {
      insertarNodo.run({
        tipo: 'asignatura',
        id: a.id,
        nombre: a.nombre,
        padre_tipo: null,
        padre_id: null,
        orden: null,
        periodo: a.periodo
      })

      for (const u of a.unidades) {
        insertarNodo.run({
          tipo: 'unidad',
          id: u.id,
          nombre: u.titulo,
          padre_tipo: 'asignatura',
          padre_id: a.id,
          orden: u.orden,
          periodo: null
        })
        insertarArista.run({
          origen_tipo: 'asignatura',
          origen_id: a.id,
          destino_tipo: 'unidad',
          destino_id: u.id,
          tipo: 'contiene'
        })

        for (const t of u.temas) {
          insertarNodo.run({
            tipo: 'tema',
            id: t.id,
            nombre: t.titulo,
            padre_tipo: 'unidad',
            padre_id: u.id,
            orden: t.orden,
            periodo: null
          })
          insertarArista.run({
            origen_tipo: 'unidad',
            origen_id: u.id,
            destino_tipo: 'tema',
            destino_id: t.id,
            tipo: 'contiene'
          })

          for (const s of t.subtemas) {
            insertarNodo.run({
              tipo: 'subtema',
              id: s.id,
              nombre: s.titulo,
              padre_tipo: 'tema',
              padre_id: t.id,
              orden: s.orden,
              periodo: null
            })
            insertarArista.run({
              origen_tipo: 'tema',
              origen_id: t.id,
              destino_tipo: 'subtema',
              destino_id: s.id,
              tipo: 'contiene'
            })
          }

          // Puente tema -> concepto.
          for (const conceptoId of t.conceptos) {
            insertarArista.run({
              origen_tipo: 'tema',
              origen_id: t.id,
              destino_tipo: 'concepto',
              destino_id: conceptoId,
              tipo: 'instancia'
            })
          }
        }
      }
    })
    tx(asignatura)
  }

  // --- Consultas ---

  listarConceptos(): ResumenConcepto[] {
    return this.db
      .prepare(
        `SELECT n.id AS id, n.nombre AS nombre, COUNT(r.id) AS totalRecursos
         FROM nodes n
         LEFT JOIN resources r ON r.concepto_id = n.id
         WHERE n.tipo = 'concepto'
         GROUP BY n.id, n.nombre
         ORDER BY n.nombre COLLATE NOCASE`
      )
      .all() as ResumenConcepto[]
  }

  buscarConceptos(texto: string): ResumenConcepto[] {
    const patron = `%${texto.trim()}%`
    return this.db
      .prepare(
        `SELECT n.id AS id, n.nombre AS nombre, COUNT(r.id) AS totalRecursos
         FROM nodes n
         LEFT JOIN resources r ON r.concepto_id = n.id
         WHERE n.tipo = 'concepto' AND n.nombre LIKE @patron COLLATE NOCASE
         GROUP BY n.id, n.nombre
         ORDER BY n.nombre COLLATE NOCASE`
      )
      .all({ patron }) as ResumenConcepto[]
  }

  listarAsignaturas(): ResumenAsignatura[] {
    return this.db
      .prepare(
        `SELECT a.id AS id, a.nombre AS nombre, a.periodo AS periodo,
                (SELECT COUNT(*) FROM nodes u
                   WHERE u.tipo = 'unidad' AND u.padre_id = a.id) AS totalUnidades,
                (SELECT COUNT(*) FROM nodes t
                   WHERE t.tipo = 'tema' AND t.padre_id IN
                     (SELECT id FROM nodes WHERE tipo = 'unidad' AND padre_id = a.id)) AS totalTemas
         FROM nodes a
         WHERE a.tipo = 'asignatura'
         ORDER BY a.nombre COLLATE NOCASE`
      )
      .all() as ResumenAsignatura[]
  }

  usosDeConcepto(conceptoId: string): UsoDeConcepto[] {
    return this.db
      .prepare(
        `SELECT a.id AS asignaturaId, a.nombre AS asignatura, a.periodo AS periodo,
                u.nombre AS unidad, t.id AS temaId, t.nombre AS tema
         FROM edges e
         JOIN nodes t ON t.tipo = 'tema' AND t.id = e.origen_id
         JOIN nodes u ON u.tipo = 'unidad' AND u.id = t.padre_id
         JOIN nodes a ON a.tipo = 'asignatura' AND a.id = u.padre_id
         WHERE e.origen_tipo = 'tema'
           AND e.destino_tipo = 'concepto'
           AND e.destino_id = @conceptoId
           AND e.tipo_relacion = 'instancia'
         ORDER BY a.nombre COLLATE NOCASE, u.orden, t.orden`
      )
      .all({ conceptoId }) as UsoDeConcepto[]
  }
}
