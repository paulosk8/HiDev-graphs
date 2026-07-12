import { useEffect, useRef } from 'react'
import { Terminal } from '@xterm/xterm'
import { FitAddon } from '@xterm/addon-fit'
import '@xterm/xterm/css/xterm.css'

export function TerminalPage(): JSX.Element {
  const contenedor = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!contenedor.current) return
    const term = new Terminal({
      fontSize: 13,
      fontFamily: 'Menlo, Monaco, "Courier New", monospace',
      cursorBlink: true,
      theme: { background: '#0f172a', foreground: '#e2e8f0', cursor: '#818cf8' }
    })
    const fit = new FitAddon()
    term.loadAddon(fit)
    term.open(contenedor.current)
    fit.fit()
    window.__term = term

    void window.api.terminal.crear(term.cols, term.rows)
    const offDatos = window.api.terminal.onDatos((d) => term.write(d))
    const offSalida = window.api.terminal.onSalida(() =>
      term.write('\r\n\x1b[90m[el proceso terminó]\x1b[0m\r\n')
    )
    const disp = term.onData((d) => window.api.terminal.escribir(d))

    const ro = new ResizeObserver(() => {
      fit.fit()
      window.api.terminal.redimensionar(term.cols, term.rows)
    })
    ro.observe(contenedor.current)
    term.focus()

    return () => {
      ro.disconnect()
      disp.dispose()
      offDatos()
      offSalida()
      window.api.terminal.cerrar()
      term.dispose()
    }
  }, [])

  return (
    <div className="flex h-full flex-col bg-slate-900">
      <header className="border-b border-slate-800 px-6 py-3">
        <h1 className="text-sm font-semibold text-slate-200">Terminal</h1>
        <p className="text-xs text-slate-400">
          Ejecuta aquí tu CLI de IA (Claude Code, Gemini CLI…). La configuración MCP está en
          «Asistente IA».
        </p>
      </header>
      <div ref={contenedor} className="min-h-0 flex-1 p-2" />
    </div>
  )
}
