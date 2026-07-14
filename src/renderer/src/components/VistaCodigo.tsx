/**
 * Muestra texto como si estuviera en un editor de código (estilo VS Code):
 * cabecera con los tres puntos, tema oscuro, tipografía monoespaciada y números
 * de línea. Sin resaltado de sintaxis (cero dependencias nuevas), pero con el
 * aspecto de un editor. El scroll horizontal queda contenido.
 */
export function VistaCodigo({ texto, lenguaje }: { texto: string; lenguaje?: string }): JSX.Element {
  const lineas = texto.replace(/\n+$/, '').split('\n')
  return (
    <div className="overflow-hidden rounded-lg border border-slate-700 bg-[#1e1e1e] text-[13px] shadow-sm">
      <div className="flex items-center gap-2 border-b border-black/40 bg-[#323233] px-3 py-1.5">
        <span className="flex gap-1.5" aria-hidden>
          <span className="h-3 w-3 rounded-full bg-[#ff5f56]" />
          <span className="h-3 w-3 rounded-full bg-[#ffbd2e]" />
          <span className="h-3 w-3 rounded-full bg-[#27c93f]" />
        </span>
        <span className="ml-1 text-xs text-slate-400">{lenguaje?.trim() || 'código'}</span>
      </div>
      <div className="overflow-x-auto">
        <table className="border-collapse font-mono leading-relaxed">
          <tbody>
            {lineas.map((linea, i) => (
              <tr key={i}>
                <td
                  className="select-none whitespace-nowrap border-r border-white/10 px-3 text-right align-top text-[#858585]"
                  style={{ width: '1%' }}
                >
                  {i + 1}
                </td>
                <td className="whitespace-pre px-3 text-[#d4d4d4]">{linea || ' '}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
