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
import {
  buscarConceptos,
  cargarVault,
  crucesEntreAsignaturas,
  listarAsignaturas,
  relacionesDeConcepto,
  resumenGrafo,
  usosDeConcepto
} from './consultas'
import { extraerTexto } from './extraerTexto'

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

const transport = new StdioServerTransport()
await server.connect(transport)
