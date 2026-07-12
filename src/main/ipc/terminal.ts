import { ipcMain, type WebContents } from 'electron'
import { spawn, type IPty } from 'node-pty'
import { existsSync } from 'node:fs'
import { homedir } from 'node:os'

import { CANALES } from '../../shared/canales'

let pty: IPty | null = null
/** Renderer al que se reenvía la salida del pty (cambia al reconectar). */
let sender: WebContents | null = null
/** Historial reciente para reconstruir la vista al reconectar (nueva pestaña/vuelta al mapa). */
let historial = ''
const MAX_HISTORIAL = 200_000 // ~200 KB de scrollback

function shellPredeterminado(): string {
  if (process.platform === 'win32') return process.env.COMSPEC ?? 'powershell.exe'
  return process.env.SHELL ?? '/bin/zsh'
}

/**
 * Terminal embebida: abre un pseudo-terminal (pty) real con el shell del sistema
 * y lo conecta al renderer (xterm.js). Multiplataforma vía node-pty (ConPTY en
 * Windows). El proceso de IA (Claude Code, Gemini/Antigravity CLI…) se ejecuta
 * dentro.
 *
 * El pty es PERSISTENTE durante la vida de la app: al navegar fuera del mapa y
 * volver, el componente de xterm se desmonta y se vuelve a montar, pero NO se
 * mata el proceso; se reconecta a la misma sesión y se le reenvía su historial.
 * Así una sesión de IA (con su login) sobrevive al cambiar de sección.
 *
 * Se abre en la carpeta del vault, para que el CLI (y su MCP) pueda navegar los
 * archivos de conceptos, asignaturas y material de los temas relacionados.
 */
export function registrarHandlersTerminal(rutaVault: string): void {
  ipcMain.handle(CANALES.terminalCrear, (evento, cols: number, rows: number) => {
    sender = evento.sender

    // Ya hay una sesión viva: reconecta reenviando el historial y ajustando el tamaño.
    if (pty) {
      try {
        pty.resize(cols || 80, rows || 24)
      } catch {
        /* ignora tamaños inválidos transitorios */
      }
      if (historial && !sender.isDestroyed()) sender.send(CANALES.terminalDatos, historial)
      return
    }

    const cwd = existsSync(rutaVault) ? rutaVault : homedir()
    pty = spawn(shellPredeterminado(), [], {
      name: 'xterm-color',
      cols: cols || 80,
      rows: rows || 24,
      cwd,
      env: process.env as Record<string, string>
    })
    // Aviso inicial: en qué carpeta está el terminal (el material del vault).
    const aviso = `\x1b[90m# PedagoGraph — tu material está en: ${cwd}\r\n# (conceptos/, asignaturas/, tareas/). Ejecuta aquí tu CLI de IA.\x1b[0m\r\n`
    historial = aviso
    if (!sender.isDestroyed()) sender.send(CANALES.terminalDatos, aviso)

    pty.onData((datos) => {
      historial = (historial + datos).slice(-MAX_HISTORIAL)
      if (sender && !sender.isDestroyed()) sender.send(CANALES.terminalDatos, datos)
    })
    pty.onExit(({ exitCode }) => {
      if (sender && !sender.isDestroyed()) sender.send(CANALES.terminalSalida, exitCode)
      pty = null
      historial = ''
    })
  })

  ipcMain.on(CANALES.terminalEscribir, (_e, datos: string) => pty?.write(datos))
  ipcMain.on(CANALES.terminalRedimensionar, (_e, cols: number, rows: number) => {
    try {
      pty?.resize(cols || 80, rows || 24)
    } catch {
      /* ignora tamaños inválidos transitorios */
    }
  })
  // Desmontar el componente (cambiar de sección, cerrar el panel) NO mata la
  // sesión: solo se deja de escuchar. El pty se conserva para reconectar.
  ipcMain.on(CANALES.terminalCerrar, () => {
    /* intencionalmente vacío: la sesión persiste hasta salir de la app */
  })
}

/** Cierra el pty al salir de la app. */
export function cerrarTerminal(): void {
  pty?.kill()
  pty = null
  historial = ''
}
