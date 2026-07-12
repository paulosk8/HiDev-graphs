import { spawnSync } from 'node:child_process'
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { homedir } from 'node:os'
import { dirname, join } from 'node:path'

import { ErrorDeDominio } from '../domain/errores'
import type { ClienteMcpDTO, ClienteMcpId } from '../../shared/dtos'

/** Datos del servidor MCP para escribir en la configuración de un CLI. */
export interface ConfigServidorMcp {
  rutaServidor: string
  rutaVault: string
  ejecutable: string
}

const NOMBRE_SERVIDOR = 'pedagograph'

/** Objeto de configuración del servidor que entienden los CLIs (formato común). */
function objetoServidor(cfg: ConfigServidorMcp): Record<string, unknown> {
  return {
    command: cfg.ejecutable,
    args: [cfg.rutaServidor],
    env: { ELECTRON_RUN_AS_NODE: '1', PEDAGOGRAPH_VAULT: cfg.rutaVault }
  }
}

// --- Gemini / Antigravity (agy): archivo ~/.gemini/config/mcp_config.json ---

function rutaConfigGemini(): string {
  return join(homedir(), '.gemini', 'config', 'mcp_config.json')
}

function geminiInstalado(): boolean {
  // La existencia de ~/.gemini implica que el CLI (Gemini/Antigravity) se usó aquí.
  return existsSync(join(homedir(), '.gemini'))
}

function leerJsonSeguro(ruta: string): Record<string, unknown> {
  if (!existsSync(ruta)) return {}
  const texto = readFileSync(ruta, 'utf8').trim()
  if (!texto) return {}
  try {
    const dato = JSON.parse(texto)
    return dato && typeof dato === 'object' ? (dato as Record<string, unknown>) : {}
  } catch {
    throw new ErrorDeDominio(
      'Tu archivo de configuración de Gemini tiene un formato no válido.',
      'Ábrelo y corrígelo, o pega la configuración a mano desde «Ver configuración manual».'
    )
  }
}

function geminiConectado(): boolean {
  const cfg = leerJsonSeguro(rutaConfigGemini())
  const servidores = cfg.mcpServers as Record<string, unknown> | undefined
  return !!servidores && NOMBRE_SERVIDOR in servidores
}

function conectarGemini(cfg: ConfigServidorMcp): void {
  const ruta = rutaConfigGemini()
  mkdirSync(dirname(ruta), { recursive: true })
  const actual = leerJsonSeguro(ruta)
  const servidores = (actual.mcpServers as Record<string, unknown>) ?? {}
  servidores[NOMBRE_SERVIDOR] = objetoServidor(cfg)
  actual.mcpServers = servidores
  writeFileSync(ruta, `${JSON.stringify(actual, null, 2)}\n`, 'utf8')
}

// --- Claude Code: comando `claude mcp add-json` ---

/** Directorios habituales donde vive el binario del CLI (la app GUI no hereda el PATH del shell). */
function directoriosBin(): string[] {
  return [
    join(homedir(), '.local', 'bin'),
    join(homedir(), '.claude', 'local'),
    '/opt/homebrew/bin',
    '/usr/local/bin',
    '/usr/bin'
  ]
}

function buscarBinario(nombre: string): string | null {
  for (const dir of directoriosBin()) {
    const ruta = join(dir, nombre)
    if (existsSync(ruta)) return ruta
  }
  return null
}

function entornoConPath(): NodeJS.ProcessEnv {
  const extra = directoriosBin().join(':')
  return { ...process.env, PATH: `${process.env.PATH ?? ''}:${extra}` }
}

function claudeBin(): string | null {
  return buscarBinario('claude')
}

function claudeInstalado(): boolean {
  return claudeBin() !== null || existsSync(join(homedir(), '.claude'))
}

function claudeConectado(): boolean {
  // Mejor esfuerzo: la config de usuario de Claude vive en ~/.claude.json.
  const ruta = join(homedir(), '.claude.json')
  if (!existsSync(ruta)) return false
  try {
    return readFileSync(ruta, 'utf8').includes(`"${NOMBRE_SERVIDOR}"`)
  } catch {
    return false
  }
}

function conectarClaude(cfg: ConfigServidorMcp): void {
  const bin = claudeBin()
  if (!bin) {
    throw new ErrorDeDominio(
      'No encontré el comando de Claude Code en este equipo.',
      'Instálalo (o inícialo una vez) y vuelve a intentar; o pega la configuración a mano.'
    )
  }
  const json = JSON.stringify(objetoServidor(cfg))
  const r = spawnSync(bin, ['mcp', 'add-json', NOMBRE_SERVIDOR, json, '-s', 'user'], {
    env: entornoConPath(),
    encoding: 'utf8'
  })
  if (r.status !== 0) {
    throw new ErrorDeDominio(
      'No se pudo configurar Claude Code automáticamente.',
      (r.stderr || r.stdout || 'Prueba a pegar la configuración a mano desde «Ver configuración manual».').trim()
    )
  }
}

// --- API del módulo ---

export function detectarClientesMcp(): ClienteMcpDTO[] {
  return [
    {
      id: 'gemini',
      nombre: 'Gemini / Antigravity',
      instalado: geminiInstalado(),
      conectado: geminiConectado(),
      rutaConfig: rutaConfigGemini()
    },
    {
      id: 'claude',
      nombre: 'Claude Code',
      instalado: claudeInstalado(),
      conectado: claudeConectado()
    }
  ]
}

export function conectarClienteMcp(cli: ClienteMcpId, cfg: ConfigServidorMcp): void {
  if (cli === 'gemini') conectarGemini(cfg)
  else conectarClaude(cfg)
}
