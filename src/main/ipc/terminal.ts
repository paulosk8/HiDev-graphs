import { ipcMain } from 'electron'
import { spawn, type IPty } from 'node-pty'
import { existsSync } from 'node:fs'
import { homedir } from 'node:os'

import { CANALES } from '../../shared/canales'

let pty: IPty | null = null

function shellPredeterminado(): string {
  if (process.platform === 'win32') return process.env.COMSPEC ?? 'powershell.exe'
  return process.env.SHELL ?? '/bin/zsh'
}

/**
 * Terminal embebida: abre un pseudo-terminal (pty) real con el shell del sistema
 * y lo conecta al renderer (xterm.js). Multiplataforma vía node-pty (ConPTY en
 * Windows). El proceso de IA (Claude Code, Gemini CLI…) se ejecuta dentro.
 *
 * Se abre en la carpeta del vault, para que el CLI (y su MCP) pueda navegar los
 * archivos de conceptos, asignaturas y material de los temas relacionados.
 */
export function registrarHandlersTerminal(rutaVault: string): void {
  ipcMain.handle(CANALES.terminalCrear, (evento, cols: number, rows: number) => {
    pty?.kill()
    const cwd = existsSync(rutaVault) ? rutaVault : homedir()
    pty = spawn(shellPredeterminado(), [], {
      name: 'xterm-color',
      cols: cols || 80,
      rows: rows || 24,
      cwd,
      env: process.env as Record<string, string>
    })
    const sender = evento.sender
    // Aviso inicial: en qué carpeta está el terminal (el material del vault).
    sender.send(
      CANALES.terminalDatos,
      `\x1b[90m# PedagoGraph — tu material está en: ${cwd}\r\n# (conceptos/, asignaturas/, tareas/). Ejecuta aquí tu CLI de IA.\x1b[0m\r\n`
    )
    pty.onData((datos) => {
      if (!sender.isDestroyed()) sender.send(CANALES.terminalDatos, datos)
    })
    pty.onExit(({ exitCode }) => {
      if (!sender.isDestroyed()) sender.send(CANALES.terminalSalida, exitCode)
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
  ipcMain.on(CANALES.terminalCerrar, () => {
    pty?.kill()
    pty = null
  })
}

/** Cierra el pty al salir de la app. */
export function cerrarTerminal(): void {
  pty?.kill()
  pty = null
}
