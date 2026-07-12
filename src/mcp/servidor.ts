/**
 * Servidor MCP de PedagoGraph.
 *
 * Expone el grafo pedagógico como herramientas que un CLI de IA (Claude Code,
 * Gemini CLI, Cursor…) puede consultar. Corre en Node puro por stdio, leyendo
 * el vault directamente (sin SQLite ni Electron). La ruta del vault se toma de
 * PEDAGOGRAPH_VAULT o, por defecto, Documentos/PedagoGraph.
 */
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js'
import { z } from 'zod'
import { homedir } from 'node:os'
import { join } from 'node:path'

import { VaultFileSystemService } from '../main/infrastructure/VaultFileSystemService'
import { crearTarea, duplicarTarea } from '../main/application/Tareas'
import type { Servicios } from '../main/servicios'
import {
  buscarConceptos,
  cargarVault,
  crucesEntreAsignaturas,
  detalleAsignatura,
  listarAsignaturas,
  listarTareasDe,
  relacionesDeConcepto,
  resolverTemas,
  resumenGrafo,
  usosDeConcepto
} from './consultas'
import { extraerTexto } from './extraerTexto'

/** Servicios mínimos para los casos de uso de tarea (solo usan el vault). */
const servicios = (): Servicios => ({ vault: new VaultFileSystemService(rutaVault) }) as unknown as Servicios

const MAX_TEXTO = 8000

const rutaVault = process.env.PEDAGOGRAPH_VAULT ?? join(homedir(), 'Documents', 'PedagoGraph')

function texto(obj: unknown): { content: { type: 'text'; text: string }[] } {
  return { content: [{ type: 'text', text: JSON.stringify(obj, null, 2) }] }
}

const server = new McpServer({ name: 'pedagograph', version: '0.1.0' })

server.registerTool(
  'resumen_grafo',
  {
    description:
      'Resumen del grafo pedagógico: totales de conceptos, asignaturas y tareas, y los conceptos más transversales (usados en más asignaturas).'
  },
  async () => texto(resumenGrafo(cargarVault(rutaVault)))
)

server.registerTool(
  'listar_asignaturas',
  { description: 'Lista las asignaturas con sus períodos, componentes y nº de unidades/temas.' },
  async () => texto(listarAsignaturas(cargarVault(rutaVault)))
)

server.registerTool(
  'buscar_conceptos',
  {
    description:
      'Busca conceptos por nombre (o todos si se omite el texto). Devuelve materiales y transversalidad de cada uno.',
    inputSchema: { texto: z.string().optional().describe('Texto a buscar en el nombre del concepto') }
  },
  async ({ texto: q }) => texto(buscarConceptos(cargarVault(rutaVault), q))
)

server.registerTool(
  'usos_de_concepto',
  {
    description: 'Dónde se usa un concepto: asignatura · períodos › unidad › tema.',
    inputSchema: { conceptoId: z.string().describe('Id (slug) del concepto') }
  },
  async ({ conceptoId }) => texto(usosDeConcepto(cargarVault(rutaVault), conceptoId))
)

server.registerTool(
  'relaciones_de_concepto',
  {
    description:
      'Conceptos relacionados con uno dado: relaciones tipadas y conceptos que co-ocurren (se enseñan en el mismo tema).',
    inputSchema: { conceptoId: z.string().describe('Id (slug) del concepto') }
  },
  async ({ conceptoId }) => texto(relacionesDeConcepto(cargarVault(rutaVault), conceptoId))
)

server.registerTool(
  'cruces_entre_asignaturas',
  {
    description:
      'Conceptos que interconectan DOS asignaturas y en qué temas de cada una aparecen. Úsalo para planificar una actividad que sirva a ambas. Acepta id o nombre de la asignatura.',
    inputSchema: {
      asignaturaA: z.string().describe('Id o nombre de la primera asignatura'),
      asignaturaB: z.string().describe('Id o nombre de la segunda asignatura')
    }
  },
  async ({ asignaturaA, asignaturaB }) =>
    texto(crucesEntreAsignaturas(cargarVault(rutaVault), asignaturaA, asignaturaB))
)

server.registerTool(
  'leer_material',
  {
    description:
      'Extrae el TEXTO del material de un concepto (PDF, Word, PowerPoint, Markdown, HTML, XML) para razonar sobre su contenido y, p. ej., generar tareas. Si se indica `archivo`, solo ese; si no, todo el material del concepto.',
    inputSchema: {
      conceptoId: z.string().describe('Id (slug) del concepto'),
      archivo: z.string().optional().describe('Nombre de archivo concreto (opcional)')
    }
  },
  async ({ conceptoId, archivo }) => {
    const datos = cargarVault(rutaVault)
    const concepto = datos.conceptos.find((c) => c.id === conceptoId)
    if (!concepto) return texto({ error: `No encontré el concepto "${conceptoId}".` })

    const vault = new VaultFileSystemService(rutaVault)
    const recursos = archivo
      ? concepto.recursos.filter((r) => r.archivo === archivo)
      : concepto.recursos

    const materiales = []
    for (const r of recursos) {
      const ruta = vault.rutaRecurso(conceptoId, r.archivo)
      if (ruta === null) continue
      try {
        const completo = await extraerTexto(ruta, r.formato)
        materiales.push({
          nombre: r.nombre,
          formato: r.formato,
          texto: completo.slice(0, MAX_TEXTO),
          truncado: completo.length > MAX_TEXTO
        })
      } catch (error) {
        materiales.push({ nombre: r.nombre, formato: r.formato, error: String(error) })
      }
    }
    return texto({ concepto: concepto.nombre, materiales })
  }
)

server.registerTool(
  'detalle_asignatura',
  {
    description:
      'Estructura completa de una asignatura: unidades → temas (con su id, título, semana y conceptos). Úsalo para conocer los temas antes de crear una tarea.',
    inputSchema: { asignatura: z.string().describe('Id o nombre de la asignatura') },
    annotations: { readOnlyHint: true }
  },
  async ({ asignatura }) => texto(detalleAsignatura(cargarVault(rutaVault), asignatura))
)

server.registerTool(
  'listar_tareas',
  {
    description: 'Lista las tareas de una asignatura (título, componente, temas, adjuntos).',
    inputSchema: { asignatura: z.string().describe('Id o nombre de la asignatura') },
    annotations: { readOnlyHint: true }
  },
  async ({ asignatura }) => texto(listarTareasDe(cargarVault(rutaVault), asignatura))
)

server.registerTool(
  'crear_tarea',
  {
    description:
      'Crea una tarea en una asignatura para uno o más temas, con instrucciones en Markdown (puede incluir la rúbrica) y un componente opcional. Los conceptos se derivan de los temas. Devuelve la tarea creada.',
    inputSchema: {
      asignatura: z.string().describe('Id o nombre de la asignatura'),
      temas: z.array(z.string()).describe('Ids o títulos de los temas'),
      titulo: z.string(),
      instrucciones: z.string().describe('Instrucciones en Markdown'),
      componente: z.string().optional().describe('Clave del componente (p. ej. AA), opcional')
    },
    annotations: { readOnlyHint: false, destructiveHint: false }
  },
  async ({ asignatura, temas, titulo, instrucciones, componente }) => {
    const datos = cargarVault(rutaVault)
    const { asignaturaId, ids, noEncontrados } = resolverTemas(datos, asignatura, temas)
    if (!asignaturaId) return texto({ error: `No encontré la asignatura "${asignatura}".` })
    if (ids.length === 0) return texto({ error: 'No encontré ninguno de esos temas.', noEncontrados })
    const tarea = crearTarea(servicios(), {
      titulo,
      instrucciones,
      asignaturaId,
      temas: ids,
      componente: componente ?? null
    })
    return texto({ creada: tarea, temasNoEncontrados: noEncontrados })
  }
)

server.registerTool(
  'duplicar_tarea',
  {
    description:
      'Duplica una tarea en otra asignatura para propagar una actividad a materias relacionadas. Copia instrucciones y adjuntos y re-deriva los conceptos según los temas destino.',
    inputSchema: {
      tareaId: z.string().describe('Id de la tarea a duplicar'),
      asignaturaDestino: z.string().describe('Id o nombre de la asignatura destino'),
      temasDestino: z.array(z.string()).describe('Ids o títulos de los temas destino'),
      titulo: z.string().optional().describe('Título de la copia (opcional)')
    },
    annotations: { readOnlyHint: false, destructiveHint: false }
  },
  async ({ tareaId, asignaturaDestino, temasDestino, titulo }) => {
    const datos = cargarVault(rutaVault)
    const { asignaturaId, ids } = resolverTemas(datos, asignaturaDestino, temasDestino)
    if (!asignaturaId) return texto({ error: `No encontré la asignatura "${asignaturaDestino}".` })
    if (ids.length === 0) return texto({ error: 'No encontré ninguno de esos temas destino.' })
    const original = datos.tareas.find((t) => t.id === tareaId)
    const copia = duplicarTarea(servicios(), tareaId, {
      asignaturaId,
      temas: ids,
      titulo: titulo ?? `${original?.titulo ?? 'Tarea'} (copia)`
    })
    return texto({ duplicada: copia })
  }
)

const transport = new StdioServerTransport()
await server.connect(transport)
