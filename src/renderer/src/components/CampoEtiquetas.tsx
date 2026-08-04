import { useEffect, useMemo, useRef, useState, type KeyboardEvent } from 'react'
import type { EtiquetaDTO } from '@shared/dtos'
import { api } from '../lib/api'

/**
 * Campo de etiquetas: se escribe una y se confirma con Enter, coma o Tab.
 *
 * Decisión de UX: se sugieren SIEMPRE las etiquetas que el docente ya usa, y se
 * muestran primero las más frecuentes. Sin eso, cada ficha acaba con una
 * variante distinta de la misma idea ("parcial", "primer parcial", "parcial 1")
 * y el filtro deja de servir para nada, que es justo lo que se quería resolver.
 *
 * Se admite teclearlas con almohadilla (`#parcial`): es como se escriben en
 * Obsidian y en cualquier red social, y la app se la quita al guardar.
 */
export function CampoEtiquetas({
  etiquetas,
  onCambiar
}: {
  etiquetas: string[]
  onCambiar: (etiquetas: string[]) => void
}): JSX.Element {
  const [texto, setTexto] = useState('')
  const [conocidas, setConocidas] = useState<EtiquetaDTO[]>([])
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    void api
      .listarEtiquetas()
      .then(setConocidas)
      .catch(() => setConocidas([]))
  }, [])

  const clave = (t: string): string =>
    t
      .replace(/^#+/, '')
      .trim()
      .normalize('NFD')
      .replace(/[̀-ͯ]/g, '')
      .toLowerCase()

  const agregar = (bruta: string): void => {
    const etiqueta = bruta.replace(/^#+/, '').trim()
    if (!etiqueta) return
    if (etiquetas.some((e) => clave(e) === clave(etiqueta))) {
      setTexto('')
      return
    }
    onCambiar([...etiquetas, etiqueta])
    setTexto('')
  }

  const quitar = (etiqueta: string): void =>
    onCambiar(etiquetas.filter((e) => clave(e) !== clave(etiqueta)))

  const alTeclear = (e: KeyboardEvent<HTMLInputElement>): void => {
    if (e.key === 'Enter' || e.key === ',' || e.key === 'Tab') {
      if (texto.trim()) {
        e.preventDefault() // Enter no debe enviar el formulario entero.
        agregar(texto)
      }
      return
    }
    // Retroceso con el campo vacío quita la última, como en cualquier buscador.
    if (e.key === 'Backspace' && !texto && etiquetas.length > 0) {
      quitar(etiquetas[etiquetas.length - 1])
    }
  }

  const sugerencias = useMemo(() => {
    const puestas = new Set(etiquetas.map(clave))
    const buscado = clave(texto)
    return conocidas
      .filter((c) => !puestas.has(clave(c.etiqueta)))
      .filter((c) => !buscado || clave(c.etiqueta).includes(buscado))
      .slice(0, 8)
  }, [conocidas, etiquetas, texto])

  return (
    <div>
      <label className="mb-1.5 block text-sm font-medium text-slate-700">
        Etiquetas (opcional)
      </label>

      <div
        onClick={() => inputRef.current?.focus()}
        className="flex flex-wrap items-center gap-1.5 rounded-lg border border-slate-300 px-2 py-1.5 focus-within:border-marca-500 focus-within:ring-2 focus-within:ring-marca-100"
      >
        {etiquetas.map((e) => (
          <span
            key={e}
            className="inline-flex items-center gap-1 rounded-full bg-marca-50 py-0.5 pl-2.5 pr-1 text-xs font-medium text-marca-700"
          >
            {e}
            <button
              type="button"
              onClick={() => quitar(e)}
              className="text-marca-400 transition hover:text-red-600"
              aria-label={`Quitar la etiqueta ${e}`}
            >
              ✕
            </button>
          </span>
        ))}
        <input
          ref={inputRef}
          value={texto}
          onChange={(ev) => setTexto(ev.target.value)}
          onKeyDown={alTeclear}
          onBlur={() => texto.trim() && agregar(texto)}
          placeholder={etiquetas.length === 0 ? 'Ej. evaluación, primer parcial' : ''}
          className="min-w-[8rem] flex-1 border-0 bg-transparent py-0.5 text-sm outline-none"
          maxLength={40}
        />
      </div>

      <p className="mt-1 text-xs text-slate-400">
        Escribe y pulsa Enter. Sirven para encontrar material entre asignaturas.
      </p>

      {sugerencias.length > 0 && (
        <div className="mt-2 flex flex-wrap items-center gap-1.5">
          <span className="text-xs text-slate-400">Ya usas:</span>
          {sugerencias.map((s) => (
            <button
              key={s.etiqueta}
              type="button"
              onClick={() => agregar(s.etiqueta)}
              className="rounded-full border border-slate-200 px-2.5 py-0.5 text-xs text-slate-600 transition hover:border-marca-300 hover:bg-marca-50 hover:text-marca-700"
            >
              {s.etiqueta}
              <span className="ml-1 text-slate-400">{s.total}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
