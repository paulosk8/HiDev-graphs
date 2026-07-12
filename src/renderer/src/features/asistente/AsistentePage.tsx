import { useEffect, useState } from 'react'
import type { ClienteMcpId, McpInfoDTO } from '@shared/dtos'
import { Boton } from '../../components/Boton'
import { api } from '../../lib/api'
import { useUiStore } from '../../stores/uiStore'

const HERRAMIENTAS = [
  ['resumen_grafo', 'Totales y conceptos más transversales.'],
  ['listar_asignaturas', 'Asignaturas con períodos y componentes.'],
  ['detalle_asignatura', 'Unidades y temas (con conceptos) de una asignatura.'],
  ['buscar_conceptos', 'Busca conceptos y su material.'],
  ['usos_de_concepto', 'Dónde se usa un concepto.'],
  ['relaciones_de_concepto', 'Conceptos relacionados (tipados y co-ocurrentes).'],
  ['cruces_entre_asignaturas', 'Conceptos/temas que conectan dos asignaturas.'],
  ['leer_material', 'Extrae el texto del material (PDF/Word/PPT/MD…) de un concepto.'],
  ['listar_tareas', 'Tareas de una asignatura.'],
  ['crear_tarea', 'Crea una tarea (temas + instrucciones + componente).'],
  ['duplicar_tarea', 'Propaga una tarea a otra asignatura relacionada.']
]

const EJEMPLOS = [
  '¿Qué conceptos conectan «Computación Paralela» y «Estructura de Datos»?',
  'Lee el material de esos conceptos y redáctame una actividad basada en su contenido.',
  'Crea esa tarea en «Estructura de Datos» para sus temas relacionados y duplícala en «Computación Paralela».'
]

export function AsistentePage(): JSX.Element {
  const [info, setInfo] = useState<McpInfoDTO | null>(null)
  const [copiado, setCopiado] = useState(false)
  const [conectando, setConectando] = useState<ClienteMcpId | null>(null)
  const notificar = useUiStore((s) => s.notificar)
  const notificarError = useUiStore((s) => s.notificarError)

  useEffect(() => {
    api.obtenerInfoMcp().then(setInfo).catch((e) => notificarError(e))
  }, [notificarError])

  const conectar = async (cli: ClienteMcpId, nombre: string): Promise<void> => {
    setConectando(cli)
    try {
      const actualizado = await api.conectarMcp(cli)
      setInfo(actualizado)
      notificar({ tipo: 'exito', mensaje: `${nombre} quedó conectado. Reinícialo para que tome los cambios.` })
    } catch (error) {
      notificarError(error)
    } finally {
      setConectando(null)
    }
  }

  const config = info
    ? JSON.stringify(
        {
          mcpServers: {
            pedagograph: {
              // Usa el motor incluido en PedagoGraph (Electron como Node), así no
              // hace falta instalar Node aparte.
              command: info.ejecutable,
              args: [info.rutaServidor],
              env: { ELECTRON_RUN_AS_NODE: '1', PEDAGOGRAPH_VAULT: info.rutaVault }
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
        <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-slate-400">
          1 · Conecta tu asistente
        </h2>
        <p className="mb-3 text-sm text-slate-600">
          Con un clic dejamos tu CLI listo para leer tu grafo. Después, <strong>reinícialo</strong>{' '}
          para que tome la conexión. No necesitas instalar Node.
        </p>
        <ul className="divide-y divide-slate-100 rounded-lg border border-slate-200">
          {(info?.clientes ?? []).map((c) => (
            <li key={c.id} className="flex items-center gap-3 px-4 py-3">
              <span
                className={`h-2.5 w-2.5 shrink-0 rounded-full ${
                  c.conectado ? 'bg-emerald-500' : c.instalado ? 'bg-amber-400' : 'bg-slate-300'
                }`}
              />
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium text-slate-800">{c.nombre}</p>
                <p className="text-xs text-slate-400">
                  {c.conectado ? 'Conectado' : c.instalado ? 'Detectado, sin conectar' : 'No detectado en este equipo'}
                </p>
              </div>
              {c.conectado ? (
                <span className="shrink-0 text-sm font-medium text-emerald-600">Conectado ✓</span>
              ) : (
                <Boton
                  variante="primario"
                  onClick={() => void conectar(c.id, c.nombre)}
                  disabled={!c.instalado || conectando !== null}
                >
                  {conectando === c.id ? 'Conectando…' : 'Conectar'}
                </Boton>
              )}
            </li>
          ))}
          {!info && <li className="px-4 py-3 text-sm text-slate-400">Cargando…</li>}
        </ul>

        {info && !info.compilado && (
          <p className="mt-3 text-xs text-amber-700">
            Nota: el servidor aún no está compilado (ver aviso arriba); conéctalo igualmente y volverá a
            funcionar cuando lo compiles.
          </p>
        )}

        <details className="mt-4 rounded-lg border border-slate-200 px-4 py-3">
          <summary className="cursor-pointer text-sm text-slate-600">
            Ver configuración manual (avanzado)
          </summary>
          <div className="mt-3">
            <div className="mb-2 flex items-center justify-between">
              <p className="text-xs text-slate-500">
                Pega esto en la configuración MCP de tu CLI si prefieres hacerlo a mano:
              </p>
              <Boton variante="secundario" onClick={() => void copiar()} disabled={!config}>
                {copiado ? '¡Copiado!' : 'Copiar'}
              </Boton>
            </div>
            <pre className="overflow-x-auto rounded-lg bg-slate-900 p-4 text-xs leading-relaxed text-slate-100">
              {config || 'Cargando…'}
            </pre>
          </div>
        </details>
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
