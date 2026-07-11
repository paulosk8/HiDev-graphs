/**
 * Esquema (DDL) del índice SQLite.
 *
 * Se define como cadena en TypeScript (en vez de un .sql suelto) para que el
 * empaquetado de electron-vite lo incluya sin configuración extra.
 *
 * El índice es DERIVADO y reconstruible: la fuente de verdad son los YAML del
 * vault. Tres tablas: nodes, edges (con tipo_relacion) y resources.
 */
export const ESQUEMA_SQL = /* sql */ `
PRAGMA journal_mode = WAL;
PRAGMA foreign_keys = ON;

-- Nodos del grafo: conceptos y jerarquía curricular (asignatura/unidad/tema/subtema).
CREATE TABLE IF NOT EXISTS nodes (
  tipo        TEXT NOT NULL,           -- 'concepto'|'asignatura'|'unidad'|'tema'|'subtema'
  id          TEXT NOT NULL,           -- slug (concepto/asignatura) o uuid (unidad/tema/subtema)
  nombre      TEXT NOT NULL,           -- nombre o título visible
  padre_tipo  TEXT,                    -- jerarquía curricular (nullable)
  padre_id    TEXT,
  orden       INTEGER,                 -- posición dentro del padre (unidad/tema/subtema)
  periodo     TEXT,                    -- solo asignatura
  PRIMARY KEY (tipo, id)
);

CREATE INDEX IF NOT EXISTS idx_nodes_tipo    ON nodes (tipo);
CREATE INDEX IF NOT EXISTS idx_nodes_padre   ON nodes (padre_tipo, padre_id);

-- Aristas: relaciones concepto↔concepto (tipadas), tema→concepto ('instancia')
-- y jerarquía curricular ('contiene').
CREATE TABLE IF NOT EXISTS edges (
  origen_tipo    TEXT NOT NULL,
  origen_id      TEXT NOT NULL,
  destino_tipo   TEXT NOT NULL,
  destino_id     TEXT NOT NULL,
  tipo_relacion  TEXT NOT NULL,        -- 'prerequisito_de'|'relacionado_con'|'profundiza'|'instancia'|'contiene'
  PRIMARY KEY (origen_tipo, origen_id, destino_tipo, destino_id, tipo_relacion)
);

CREATE INDEX IF NOT EXISTS idx_edges_destino ON edges (destino_tipo, destino_id, tipo_relacion);

-- Material didáctico, siempre asociado a un concepto.
CREATE TABLE IF NOT EXISTS resources (
  id          TEXT PRIMARY KEY,
  concepto_id TEXT NOT NULL,
  nombre      TEXT NOT NULL,
  archivo     TEXT NOT NULL,
  formato     TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_resources_concepto ON resources (concepto_id);
`
