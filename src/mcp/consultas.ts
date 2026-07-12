/**
 * Consultas del grafo pedagógico EN MEMORIA, leyendo el vault directamente
 * (YAML). No usa SQLite: así el servidor MCP corre con Node puro, sin módulos
 * nativos. La fuente de verdad son los archivos del vault.
 */
import { VaultFileSystemService } from '../main/infrastructure/VaultFileSystemService'
import type { Asignatura } from '../main/domain/Asignatura'
import type { Concepto } from '../main/domain/Concepto'
import type { Tarea } from '../main/domain/Tarea'

export interface DatosVault {
  conceptos: Concepto[]
  asignaturas: Asignatura[]
  tareas: Tarea[]
}

export function cargarVault(rutaVault: string): DatosVault {
  const vault = new VaultFileSystemService(rutaVault)
  vault.asegurarVault()
  return {
    conceptos: vault.leerTodosConceptos(),
    asignaturas: vault.leerTodasAsignaturas(),
    tareas: vault.leerTodasTareas()
  }
}

const nombreConcepto = (d: DatosVault, id: string): string =>
  d.conceptos.find((c) => c.id === id)?.nombre ?? id

/** Nº de asignaturas donde se instancia un concepto (su transversalidad). */
function transversalidad(d: DatosVault, conceptoId: string): number {
  return d.asignaturas.filter((a) =>
    a.unidades.some((u) => u.temas.some((t) => t.conceptos.includes(conceptoId)))
  ).length
}

export function listarAsignaturas(d: DatosVault): unknown[] {
  return d.asignaturas.map((a) => ({
    id: a.id,
    nombre: a.nombre,
    periodos: a.periodos,
    componentes: a.componentes.map((c) => c.clave),
    unidades: a.unidades.length,
    temas: a.unidades.reduce((n, u) => n + u.temas.length, 0)
  }))
}

export function buscarConceptos(d: DatosVault, texto?: string): unknown[] {
  const q = (texto ?? '').trim().toLowerCase()
  return d.conceptos
    .filter((c) => c.nombre.toLowerCase().includes(q))
    .map((c) => ({
      id: c.id,
      nombre: c.nombre,
      descripcion: c.descripcion || undefined,
      materiales: c.recursos.length,
      transversalidad: transversalidad(d, c.id)
    }))
}

export function usosDeConcepto(d: DatosVault, conceptoId: string): unknown[] {
  const usos: unknown[] = []
  for (const a of d.asignaturas) {
    for (const u of a.unidades) {
      for (const t of u.temas) {
        if (t.conceptos.includes(conceptoId)) {
          usos.push({ asignaturaId: a.id, asignatura: a.nombre, periodos: a.periodos, unidad: u.titulo, tema: t.titulo })
        }
      }
    }
  }
  return usos
}

export function relacionesDeConcepto(
  d: DatosVault,
  conceptoId: string
): { tipadas: unknown[]; coocurren: unknown[] } {
  const concepto = d.conceptos.find((c) => c.id === conceptoId)
  const tipadas = (concepto?.relaciones ?? []).map((r) => ({
    concepto: nombreConcepto(d, r.destino),
    conceptoId: r.destino,
    tipo: r.tipo
  }))

  // Co-ocurrencia: conceptos que comparten algún tema con este.
  const juntos = new Map<string, Set<string>>() // conceptoId -> temas donde coinciden
  for (const a of d.asignaturas) {
    for (const u of a.unidades) {
      for (const t of u.temas) {
        if (!t.conceptos.includes(conceptoId)) continue
        for (const otro of t.conceptos) {
          if (otro === conceptoId) continue
          const set = juntos.get(otro) ?? new Set<string>()
          set.add(`${a.nombre} › ${t.titulo}`)
          juntos.set(otro, set)
        }
      }
    }
  }
  const coocurren = [...juntos.entries()].map(([id, temas]) => ({
    concepto: nombreConcepto(d, id),
    conceptoId: id,
    enTemas: [...temas]
  }))

  return { tipadas, coocurren }
}

/** Encuentra un concepto por id exacto o por nombre (contiene, sin distinguir mayúsculas). */
export function resolverConcepto(d: DatosVault, ref: string): Concepto | null {
  const r = ref.trim().toLowerCase()
  return (
    d.conceptos.find((c) => c.id.toLowerCase() === r) ??
    d.conceptos.find((c) => c.nombre.toLowerCase().includes(r)) ??
    null
  )
}

/**
 * Análisis de conexiones del grafo (estilo Graphify): da a la IA las señales
 * estructurales para detectar vínculos que faltan.
 *  - `posiblesConexiones`: pares de conceptos que se enseñan en el mismo tema
 *    (co-ocurren) pero NO tienen una relación tipada entre sí. Candidatos a
 *    formalizar (la IA decide el tipo tras leer su material/descripción).
 *  - `aislados`: conceptos sin relaciones tipadas y sin co-ocurrencias.
 * La IA complementa esto leyendo el material (leer_material) para proponer
 * conexiones semánticas y aplicarlas con vincular_conceptos.
 */
export function analizarConexiones(d: DatosVault): unknown {
  const clave = (a: string, b: string): string => (a < b ? `${a}|${b}` : `${b}|${a}`)
  const info = (id: string): { id: string; nombre: string; materiales: number } => ({
    id,
    nombre: nombreConcepto(d, id),
    materiales: d.conceptos.find((c) => c.id === id)?.recursos.length ?? 0
  })

  // Relaciones tipadas existentes (no dirigidas, para no re-sugerir lo ya vinculado).
  const tipadas = new Set<string>()
  for (const c of d.conceptos) {
    for (const r of c.relaciones) tipadas.add(clave(c.id, r.destino))
  }

  // Co-ocurrencias: pares que comparten un tema, con los temas como motivo.
  const cooc = new Map<string, Set<string>>()
  for (const a of d.asignaturas) {
    for (const u of a.unidades) {
      for (const t of u.temas) {
        for (let i = 0; i < t.conceptos.length; i++) {
          for (let j = i + 1; j < t.conceptos.length; j++) {
            const k = clave(t.conceptos[i], t.conceptos[j])
            const set = cooc.get(k) ?? new Set<string>()
            set.add(`${a.nombre} › ${t.titulo}`)
            cooc.set(k, set)
          }
        }
      }
    }
  }

  const posiblesConexiones = [...cooc.entries()]
    .filter(([k]) => !tipadas.has(k))
    .map(([k, temas]) => {
      const [a, b] = k.split('|')
      return { a: info(a), b: info(b), enTemas: [...temas] }
    })

  // Conceptos conectados (tienen relación tipada como origen o destino, o co-ocurren).
  const conectados = new Set<string>()
  for (const k of [...tipadas, ...cooc.keys()]) {
    const [a, b] = k.split('|')
    conectados.add(a)
    conectados.add(b)
  }
  const aislados = d.conceptos.filter((c) => !conectados.has(c.id)).map((c) => info(c.id))

  return {
    totales: { conceptos: d.conceptos.length },
    tiposDeRelacion: ['prerequisito_de', 'relacionado_con', 'profundiza'],
    posiblesConexiones,
    aislados,
    nota:
      'posiblesConexiones = co-ocurren en un tema pero sin relación tipada. Lee su material/descripción y, si procede, vincúlalos con vincular_conceptos indicando el tipo. aislados = sin ninguna conexión; busca a qué concepto podrían enlazar.'
  }
}

/** Encuentra una asignatura por id exacto o por nombre (contiene, sin distinguir mayúsculas). */
export function resolverAsignatura(d: DatosVault, ref: string): Asignatura | null {
  const r = ref.trim().toLowerCase()
  return (
    d.asignaturas.find((a) => a.id.toLowerCase() === r) ??
    d.asignaturas.find((a) => a.nombre.toLowerCase().includes(r)) ??
    null
  )
}

function temasDe(a: Asignatura, conceptoId: string): string[] {
  const salida: string[] = []
  for (const u of a.unidades) {
    for (const t of u.temas) {
      if (t.conceptos.includes(conceptoId)) salida.push(`${u.titulo} › ${t.titulo}`)
    }
  }
  return salida
}

/**
 * Conceptos que interconectan DOS asignaturas y en qué temas de cada una
 * aparecen. Base para planificar una actividad que sirva a ambas.
 */
export function crucesEntreAsignaturas(d: DatosVault, refA: string, refB: string): unknown {
  const a = resolverAsignatura(d, refA)
  const b = resolverAsignatura(d, refB)
  if (!a) return { error: `No encontré la asignatura "${refA}".` }
  if (!b) return { error: `No encontré la asignatura "${refB}".` }

  const conceptosDe = (asig: Asignatura): Set<string> =>
    new Set(asig.unidades.flatMap((u) => u.temas.flatMap((t) => t.conceptos)))
  const compartidos = [...conceptosDe(a)].filter((id) => conceptosDe(b).has(id))

  return {
    asignaturaA: { id: a.id, nombre: a.nombre, periodos: a.periodos },
    asignaturaB: { id: b.id, nombre: b.nombre, periodos: b.periodos },
    conceptosEnComun: compartidos.map((id) => ({
      concepto: nombreConcepto(d, id),
      conceptoId: id,
      temasEnA: temasDe(a, id),
      temasEnB: temasDe(b, id),
      materialDisponible: (d.conceptos.find((c) => c.id === id)?.recursos.length ?? 0) > 0
    }))
  }
}

/** Estructura completa de una asignatura (unidades → temas con ids y conceptos). */
export function detalleAsignatura(d: DatosVault, ref: string): unknown {
  const a = resolverAsignatura(d, ref)
  if (!a) return { error: `No encontré la asignatura "${ref}".` }
  return {
    id: a.id,
    nombre: a.nombre,
    periodos: a.periodos,
    componentes: a.componentes.map((c) => ({ clave: c.clave, nombre: c.nombre })),
    unidades: a.unidades.map((u) => ({
      titulo: u.titulo,
      temas: u.temas.map((t) => ({
        id: t.id,
        titulo: t.titulo,
        semana: t.semana,
        conceptos: t.conceptos.map((id) => nombreConcepto(d, id))
      }))
    }))
  }
}

/** Resuelve referencias de tema (id exacto o título) a ids dentro de una asignatura. */
export function resolverTemas(
  d: DatosVault,
  asignaturaRef: string,
  refs: string[]
): { asignaturaId: string | null; ids: string[]; noEncontrados: string[] } {
  const a = resolverAsignatura(d, asignaturaRef)
  if (!a) return { asignaturaId: null, ids: [], noEncontrados: refs }
  const todos = a.unidades.flatMap((u) => u.temas)
  const ids: string[] = []
  const noEncontrados: string[] = []
  for (const ref of refs) {
    const r = ref.trim().toLowerCase()
    const tema = todos.find((t) => t.id.toLowerCase() === r) ?? todos.find((t) => t.titulo.toLowerCase().includes(r))
    if (tema) ids.push(tema.id)
    else noEncontrados.push(ref)
  }
  return { asignaturaId: a.id, ids, noEncontrados }
}

export function listarTareasDe(d: DatosVault, asignaturaRef: string): unknown {
  const a = resolverAsignatura(d, asignaturaRef)
  if (!a) return { error: `No encontré la asignatura "${asignaturaRef}".` }
  const tituloTema = new Map(a.unidades.flatMap((u) => u.temas.map((t) => [t.id, t.titulo] as const)))
  return d.tareas
    .filter((t) => t.asignaturaId === a.id)
    .map((t) => ({
      id: t.id,
      titulo: t.titulo,
      componente: t.componente,
      temas: t.temas.map((id) => tituloTema.get(id) ?? id),
      adjuntos: t.recursos.length
    }))
}

export function resumenGrafo(d: DatosVault): unknown {
  const transversales = d.conceptos
    .map((c) => ({ concepto: c.nombre, conceptoId: c.id, asignaturas: transversalidad(d, c.id) }))
    .filter((x) => x.asignaturas > 0)
    .sort((a, b) => b.asignaturas - a.asignaturas)
    .slice(0, 8)
  return {
    totales: { conceptos: d.conceptos.length, asignaturas: d.asignaturas.length, tareas: d.tareas.length },
    conceptosMasTransversales: transversales
  }
}
