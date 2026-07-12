import { useEffect, useRef } from 'react'
import { Terminal } from '@xterm/xterm'
import { FitAddon } from '@xterm/addon-fit'
import '@xterm/xterm/css/xterm.css'

/**
 * Terminal embebida reutilizable: abre un xterm conectado al pty del sistema
 * (un CLI de IA como Gemini o Claude Code se ejecuta dentro). El pty vive en el
 * proceso main y es único, así que solo debe montarse una instancia a la vez.
 */
export function TerminalEmbebida({ className }: { className?: string }): JSX.Element {
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

    // Los listeners se registran ANTES de crear/reconectar, para no perder el
    // historial que el proceso principal reenvía al volver a montar la terminal.
    const offDatos = window.api.terminal.onDatos((d) => term.write(d))
    const offSalida = window.api.terminal.onSalida(() =>
      term.write('\r\n\x1b[90m[el proceso terminó]\x1b[0m\r\n')
    )
    const disp = term.onData((d) => window.api.terminal.escribir(d))
    void window.api.terminal.crear(term.cols, term.rows)

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

  return <div ref={contenedor} className={className ?? 'h-full w-full'} />
}
