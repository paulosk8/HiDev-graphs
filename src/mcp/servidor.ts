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

import {
  buscarConceptos,
  cargarVault,
  crucesEntreAsignaturas,
  listarAsignaturas,
  relacionesDeConcepto,
  resumenGrafo,
  usosDeConcepto
} from './consultas'

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

const transport = new StdioServerTransport()
await server.connect(transport)
