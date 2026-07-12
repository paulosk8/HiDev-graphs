import { TerminalEmbebida } from './TerminalEmbebida'

export function TerminalPage(): JSX.Element {
  return (
    <div className="flex h-full flex-col bg-slate-900">
      <header className="border-b border-slate-800 px-6 py-3">
        <h1 className="text-sm font-semibold text-slate-200">Terminal</h1>
        <p className="text-xs text-slate-400">
          Ejecuta aquí tu CLI de IA (Claude Code, Gemini CLI…). La configuración MCP está en
          «Asistente IA».
        </p>
      </header>
      <TerminalEmbebida className="min-h-0 flex-1 p-2" />
    </div>
  )
}
