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

/** Separa los períodos guardados unidos por comas en la columna del índice. */
function dividirPeriodos(valor: string): string[] {
  return valor ? valor.split(',').filter((p) => p.length > 0) : []
}

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
    this.migrar()
  }

  /**
   * Migraciones ligeras para índices ya existentes (el DDL usa IF NOT EXISTS y no
   * añade columnas a tablas creadas por versiones anteriores). El índice es
   * derivado: el siguiente reindexado repuebla los valores nuevos.
   */
  private migrar(): void {
    const columnas = this.db.prepare('PRAGMA table_info(nodes)').all() as { name: string }[]
    if (!columnas.some((c) => c.name === 'descripcion')) {
      this.db.exec('ALTER TABLE nodes ADD COLUMN descripcion TEXT')
    }
    // Estado de repaso espaciado del concepto (dominio 0..5 y fecha del próximo repaso).
    if (!columnas.some((c) => c.name === 'dominio')) {
      this.db.exec('ALTER TABLE nodes ADD COLUMN dominio INTEGER')
    }
    if (!columnas.some((c) => c.name === 'proxima_revision')) {
      this.db.exec('ALTER TABLE nodes ADD COLUMN proxima_revision TEXT')
    }
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
      `INSERT OR REPLACE INTO nodes (tipo, id, nombre, descripcion, dominio, proxima_revision, padre_tipo, padre_id, orden, periodo)
       VALUES ('concepto', @id, @nombre, @descripcion, @dominio, @proximaRevision, NULL, NULL, NULL, NULL)`
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
      // Idempotente: limpia lo que posee el concepto antes de reinsertar. No
      // toca las aristas 'instancia' entrantes (tema -> concepto), que pertenecen
      // a las asignaturas.
      this.db.prepare('DELETE FROM resources WHERE concepto_id = ?').run(c.id)
      this.db
        .prepare("DELETE FROM edges WHERE origen_tipo = 'concepto' AND origen_id = ?")
        .run(c.id)

      insertarNodo.run({
        id: c.id,
        nombre: c.nombre,
        descripcion: c.descripcion,
        dominio: c.repaso ? c.repaso.dominio : null,
        proximaRevision: c.repaso ? c.repaso.proximaRevision : null
      })
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
      // Idempotente: borra la jerarquía previa (incluidas aristas 'instancia'
      // obsoletas al desvincular) antes de reinsertar la estructura actual.
      this.borrarSubarbolAsignatura(a.id)

      insertarNodo.run({
        tipo: 'asignatura',
        id: a.id,
        nombre: a.nombre,
        padre_tipo: null,
        padre_id: null,
        orden: null,
        periodo: a.periodos.join(',') // los períodos se guardan unidos en la columna
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

  eliminarConcepto(conceptoId: string): void {
    const tx = this.db.transaction((id: string) => {
      this.db.prepare('DELETE FROM resources WHERE concepto_id = ?').run(id)
      // Aristas donde el concepto es origen o destino (relaciones y 'instancia').
      this.db
        .prepare(
          `DELETE FROM edges
           WHERE (origen_tipo = 'concepto' AND origen_id = @id)
              OR (destino_tipo = 'concepto' AND destino_id = @id)`
        )
        .run({ id })
      this.db.prepare("DELETE FROM nodes WHERE tipo = 'concepto' AND id = ?").run(id)
    })
    tx(conceptoId)
  }

  eliminarAsignatura(asignaturaId: string): void {
    const tx = this.db.transaction((aid: string) => this.borrarSubarbolAsignatura(aid))
    tx(asignaturaId)
  }

  /**
   * Borra del índice una asignatura y toda su jerarquía (unidades/temas/subtemas)
   * con sus aristas ('contiene' e 'instancia' salientes de sus temas). No abre
   * transacción propia: se invoca dentro de una.
   */
  private borrarSubarbolAsignatura(asignaturaId: string): void {
    const hijosDe = this.db.prepare('SELECT id FROM nodes WHERE padre_id = ? AND tipo = ?')
    const borrarAristas = this.db.prepare(
      'DELETE FROM edges WHERE origen_id = @id OR destino_id = @id'
    )
    const borrarNodo = this.db.prepare('DELETE FROM nodes WHERE tipo = @tipo AND id = @id')
    const idsHijos = (padreId: string, tipo: string): string[] =>
      hijosDe.all(padreId, tipo).map((f) => (f as { id: string }).id)

    const unidades = idsHijos(asignaturaId, 'unidad')
    const temas = unidades.flatMap((u) => idsHijos(u, 'tema'))
    const subtemas = temas.flatMap((t) => idsHijos(t, 'subtema'))

    for (const id of [...subtemas, ...temas, ...unidades]) {
      borrarAristas.run({ id })
    }
    for (const id of subtemas) borrarNodo.run({ tipo: 'subtema', id })
    for (const id of temas) borrarNodo.run({ tipo: 'tema', id })
    for (const id of unidades) borrarNodo.run({ tipo: 'unidad', id })
    borrarAristas.run({ id: asignaturaId })
    borrarNodo.run({ tipo: 'asignatura', id: asignaturaId })
  }

  // --- Consultas ---

  /**
   * SELECT base para el resumen de conceptos: material contado y los títulos de
   * los temas que lo usan (aristas 'instancia'), unidos por saltos de línea para
   * separarlos luego sin colisionar con comas en los títulos.
   */
  private readonly SELECT_RESUMEN_CONCEPTO = /* sql */ `
    SELECT n.id AS id, n.nombre AS nombre, n.descripcion AS descripcion,
           n.dominio AS dominio, n.proxima_revision AS proximaRevision,
           COUNT(DISTINCT r.id) AS totalRecursos,
           (SELECT GROUP_CONCAT(t.nombre, char(10))
              FROM edges e JOIN nodes t ON t.tipo = 'tema' AND t.id = e.origen_id
              WHERE e.tipo_relacion = 'instancia'
                AND e.destino_tipo = 'concepto' AND e.destino_id = n.id) AS temasRaw
    FROM nodes n
    LEFT JOIN resources r ON r.concepto_id = n.id
    WHERE n.tipo = 'concepto'`

  private filaAResumenConcepto(fila: {
    id: string
    nombre: string
    descripcion: string | null
    dominio: number | null
    proximaRevision: string | null
    totalRecursos: number
    temasRaw: string | null
  }): ResumenConcepto {
    return {
      id: fila.id,
      nombre: fila.nombre,
      descripcion: fila.descripcion ?? '',
      totalRecursos: fila.totalRecursos,
      temas: fila.temasRaw ? fila.temasRaw.split('\n') : [],
      // Sin repaso registrado → dominio 0 y próxima revisión null (nunca repasado).
      dominio: fila.dominio ?? 0,
      proximaRevision: fila.proximaRevision ?? null
    }
  }

  listarConceptos(): ResumenConcepto[] {
    return (
      this.db
        .prepare(
          `${this.SELECT_RESUMEN_CONCEPTO}
           GROUP BY n.id, n.nombre, n.descripcion
           ORDER BY n.nombre COLLATE NOCASE`
        )
        .all() as Parameters<SqliteGraphRepository['filaAResumenConcepto']>[0][]
    ).map((f) => this.filaAResumenConcepto(f))
  }

  buscarConceptos(texto: string): ResumenConcepto[] {
    const patron = `%${texto.trim()}%`
    return (
      this.db
        .prepare(
          `${this.SELECT_RESUMEN_CONCEPTO}
             AND n.nombre LIKE @patron COLLATE NOCASE
           GROUP BY n.id, n.nombre, n.descripcion
           ORDER BY n.nombre COLLATE NOCASE`
        )
        .all({ patron }) as Parameters<SqliteGraphRepository['filaAResumenConcepto']>[0][]
    ).map((f) => this.filaAResumenConcepto(f))
  }

  listarAsignaturas(): ResumenAsignatura[] {
    const filas = this.db
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
      .all() as Array<{
      id: string
      nombre: string
      periodo: string
      totalUnidades: number
      totalTemas: number
    }>
    return filas.map((f) => ({
      id: f.id,
      nombre: f.nombre,
      periodos: dividirPeriodos(f.periodo),
      totalUnidades: f.totalUnidades,
      totalTemas: f.totalTemas
    }))
  }

  usosDeConcepto(conceptoId: string): UsoDeConcepto[] {
    const filas = this.db
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
      .all({ conceptoId }) as Array<{
      asignaturaId: string
      asignatura: string
      periodo: string
      unidad: string
      temaId: string
      tema: string
    }>
    return filas.map((f) => ({
      asignaturaId: f.asignaturaId,
      asignatura: f.asignatura,
      periodos: dividirPeriodos(f.periodo),
      unidad: f.unidad,
      temaId: f.temaId,
      tema: f.tema
    }))
  }

  usosConceptoAsignatura(): Array<{ conceptoId: string; asignaturaId: string }> {
    return this.db
      .prepare(
        `SELECT DISTINCT e.destino_id AS conceptoId, a.id AS asignaturaId
         FROM edges e
         JOIN nodes t ON t.tipo = 'tema' AND t.id = e.origen_id
         JOIN nodes u ON u.tipo = 'unidad' AND u.id = t.padre_id
         JOIN nodes a ON a.tipo = 'asignatura' AND a.id = u.padre_id
         WHERE e.origen_tipo = 'tema'
           AND e.destino_tipo = 'concepto'
           AND e.tipo_relacion = 'instancia'`
      )
      .all() as Array<{ conceptoId: string; asignaturaId: string }>
  }

  relacionesEntreConceptos(): Array<{ origen: string; destino: string; tipo: string }> {
    return this.db
      .prepare(
        `SELECT origen_id AS origen, destino_id AS destino, tipo_relacion AS tipo
         FROM edges
         WHERE origen_tipo = 'concepto' AND destino_tipo = 'concepto'`
      )
      .all() as Array<{ origen: string; destino: string; tipo: string }>
  }

  coocurrenciasDeConceptos(): Array<{ a: string; b: string }> {
    return this.db
      .prepare(
        `SELECT DISTINCT e1.destino_id AS a, e2.destino_id AS b
         FROM edges e1
         JOIN edges e2 ON e1.origen_id = e2.origen_id
         WHERE e1.origen_tipo = 'tema' AND e2.origen_tipo = 'tema'
           AND e1.destino_tipo = 'concepto' AND e2.destino_tipo = 'concepto'
           AND e1.tipo_relacion = 'instancia' AND e2.tipo_relacion = 'instancia'
           AND e1.destino_id < e2.destino_id`
      )
      .all() as Array<{ a: string; b: string }>
  }
}
