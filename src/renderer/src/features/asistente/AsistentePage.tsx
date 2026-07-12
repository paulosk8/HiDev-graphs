import { useEffect, useState } from 'react'
import type { McpInfoDTO } from '@shared/dtos'
import { Boton } from '../../components/Boton'
import { api } from '../../lib/api'
import { useUiStore } from '../../stores/uiStore'

const HERRAMIENTAS = [
  ['resumen_grafo', 'Totales y conceptos más transversales.'],
  ['listar_asignaturas', 'Asignaturas con períodos y componentes.'],
  ['buscar_conceptos', 'Busca conceptos y su material.'],
  ['usos_de_concepto', 'Dónde se usa un concepto.'],
  ['relaciones_de_concepto', 'Conceptos relacionados (tipados y co-ocurrentes).'],
  ['cruces_entre_asignaturas', 'Conceptos/temas que conectan dos asignaturas.']
]

const EJEMPLOS = [
  '¿Qué conceptos conectan «Computación Paralela» y «Estructura de Datos»?',
  'Planifícame una actividad que sirva a esas dos asignaturas usando sus temas relacionados.',
  '¿Cuáles son mis conceptos más transversales y en qué asignaturas se usan?'
]

export function AsistentePage(): JSX.Element {
  const [info, setInfo] = useState<McpInfoDTO | null>(null)
  const [copiado, setCopiado] = useState(false)
  const notificarError = useUiStore((s) => s.notificarError)

  useEffect(() => {
    api.obtenerInfoMcp().then(setInfo).catch((e) => notificarError(e))
  }, [notificarError])

  const config = info
    ? JSON.stringify(
        {
          mcpServers: {
            pedagograph: {
              command: 'node',
              args: [info.rutaServidor],
              env: { PEDAGOGRAPH_VAULT: info.rutaVault }
            }
          }
        },
        null,
        2
      )
    : ''

  const copiar = async (): Promise<void> => {
    await navigator.clipboard.writeText(config)
    setCopiado(true)
    setTimeout(() => setCopiado(false), 2000)
  }

  return (
    <div className="mx-auto max-w-3xl px-8 py-8">
      <h1 className="text-2xl font-semibold text-slate-900">Asistente IA</h1>
      <p className="mt-1 text-sm text-slate-500">
        Conecta tu asistente de IA (Claude Code, Gemini CLI…) a tu grafo pedagógico. La IA consulta
        tus conceptos, relaciones y cruces entre asignaturas <strong>en local</strong> para ayudarte
        a planificar actividades entre materias.
      </p>

      {info && !info.compilado && (
        <div className="mt-5 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          El servidor aún no está compilado. Ejecuta una vez en la terminal:
          <code className="mt-1 block rounded bg-amber-100 px-2 py-1 font-mono text-xs">
            npm run build:mcp
          </code>
        </div>
      )}

      <section className="mt-6">
        <div className="mb-2 flex items-center justify-between">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-400">
            1 · Configuración
          </h2>
          <Boton variante="secundario" onClick={() => void copiar()} disabled={!config}>
            {copiado ? '¡Copiado!' : 'Copiar'}
          </Boton>
        </div>
        <p className="mb-2 text-sm text-slate-600">
          Pega esto en la configuración MCP de tu CLI (p. ej. un archivo <code>.mcp.json</code>, o con{' '}
          <code>claude mcp add-json pedagograph …</code>):
        </p>
        <pre className="overflow-x-auto rounded-lg bg-slate-900 p-4 text-xs leading-relaxed text-slate-100">
          {config || 'Cargando…'}
        </pre>
      </section>

      <section className="mt-6">
        <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-slate-400">
          2 · Qué puede consultar
        </h2>
        <ul className="divide-y divide-slate-100 rounded-lg border border-slate-200">
          {HERRAMIENTAS.map(([nombre, desc]) => (
            <li key={nombre} className="flex items-baseline gap-3 px-4 py-2.5 text-sm">
              <code className="shrink-0 font-mono text-xs text-marca-700">{nombre}</code>
              <span className="text-slate-600">{desc}</span>
            </li>
          ))}
        </ul>
      </section>

      <section className="mt-6">
        <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-slate-400">
          3 · Ejemplos que puedes pedirle
        </h2>
        <ul className="space-y-2">
          {EJEMPLOS.map((e) => (
            <li key={e} className="rounded-lg border border-slate-200 px-4 py-2.5 text-sm text-slate-700">
              «{e}»
            </li>
          ))}
        </ul>
      </section>
    </div>
  )
}
