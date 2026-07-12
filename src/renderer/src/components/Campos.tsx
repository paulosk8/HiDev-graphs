import type { InputHTMLAttributes, TextareaHTMLAttributes } from 'react'

const CLASE_CONTROL =
  'w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-800 outline-none transition placeholder:text-slate-400 focus:border-marca-500 focus:ring-2 focus:ring-marca-100'

interface PropsTexto extends InputHTMLAttributes<HTMLInputElement> {
  etiqueta: string
  ayuda?: string
}

export function CampoTexto({ etiqueta, ayuda, className = '', ...props }: PropsTexto): JSX.Element {
  return (
    <label className="block">
      <span className="mb-1.5 block text-sm font-medium text-slate-700">{etiqueta}</span>
      <input className={`${CLASE_CONTROL} ${className}`} {...props} />
      {ayuda && <span className="mt-1 block text-xs text-slate-400">{ayuda}</span>}
    </label>
  )
}

interface PropsArea extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  etiqueta: string
  ayuda?: string
}

export function CampoArea({ etiqueta, ayuda, className = '', ...props }: PropsArea): JSX.Element {
  return (
    <label className="block">
      <span className="mb-1.5 block text-sm font-medium text-slate-700">{etiqueta}</span>
      <textarea className={`${CLASE_CONTROL} resize-none ${className}`} {...props} />
      {ayuda && <span className="mt-1 block text-xs text-slate-400">{ayuda}</span>}
    </label>
  )
}
