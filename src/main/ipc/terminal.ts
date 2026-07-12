import { ipcMain } from 'electron'
import { spawn, type IPty } from 'node-pty'
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
 */
export function registrarHandlersTerminal(): void {
  ipcMain.handle(CANALES.terminalCrear, (evento, cols: number, rows: number) => {
    pty?.kill()
    pty = spawn(shellPredeterminado(), [], {
      name: 'xterm-color',
      cols: cols || 80,
      rows: rows || 24,
      cwd: homedir(),
      env: process.env as Record<string, string>
    })
    const sender = evento.sender
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
