import { useMemo } from 'react'
import type { AsignaturaDTO } from '@shared/dtos'
import { useConceptosStore } from '../../stores/conceptosStore'

type Nivel = 'verde' | 'amarillo' | 'rojo' | 'gris'

const SEMAFORO: Record<Nivel, { color: string; texto: string }> = {
  verde: { color: '#10b981', texto: 'Material completo' },
  amarillo: { color: '#f59e0b', texto: 'Material parcial' },
  rojo: { color: '#ef4444', texto: 'Sin material' },
  gris: { color: '#cbd5e1', texto: 'Sin conceptos' }
}

interface TemaPlan {
  id: string
  titulo: string
  unidad: string
  semana: number | null
  conceptos: string[]
}

function coberturaDe(
  conceptos: string[],
  materialPorId: Map<string, number>
): { nivel: Nivel; conMaterial: number; total: number } {
  const total = conceptos.length
  if (total === 0) return { nivel: 'gris', conMaterial: 0, total: 0 }
  const conMaterial = conceptos.filter((id) => (materialPorId.get(id) ?? 0) > 0).length
  const nivel: Nivel = conMaterial === 0 ? 'rojo' : conMaterial === total ? 'verde' : 'amarillo'
  return { nivel, conMaterial, total }
}

export function PlanificacionSemanal({ asignatura }: { asignatura: AsignaturaDTO }): JSX.Element {
  const conceptos = useConceptosStore((s) => s.lista)
  const materialPorId = useMemo(
    () => new Map(conceptos.map((c) => [c.id, c.totalRecursos])),
    [conceptos]
  )
  const nombrePorId = useMemo(() => new Map(conceptos.map((c) => [c.id, c.nombre])), [conceptos])

  const temas: TemaPlan[] = asignatura.unidades.flatMap((u) =>
    u.temas.map((t) => ({ id: t.id, titulo: t.titulo, unidad: u.titulo, semana: t.semana, conceptos: t.conceptos }))
  )

  // Agrupa por semana; los temas sin semana van al final.
  const semanas = [...new Set(temas.filter((t) => t.semana !== null).map((t) => t.semana as number))].sort(
    (a, b) => a - b
  )
  const sinSemana = temas.filter((t) => t.semana === null)

  if (temas.length === 0) {
    return (
      <p className="rounded-xl border border-dashed border-slate-200 px-4 py-6 text-center text-sm text-slate-400">
        Esta asignatura aún no tiene temas para planificar.
      </p>
    )
  }

  const grupos: { etiqueta: string; temas: TemaPlan[] }[] = [
    ...semanas.map((n) => ({ etiqueta: `Semana ${n}`, temas: temas.filter((t) => t.semana === n) })),
    ...(sinSemana.length > 0 ? [{ etiqueta: 'Sin semana asignada', temas: sinSemana }] : [])
  ]

  return (
    <div>
      {/* Leyenda */}
      <div className="mb-4 flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-500">
        {(Object.keys(SEMAFORO) as Nivel[]).map((n) => (
          <span key={n} className="flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: SEMAFORO[n].color }} />
            {SEMAFORO[n].texto}
          </span>
        ))}
      </div>

      <div className="space-y-5">
        {grupos.map((grupo) => (
          <div key={grupo.etiqueta}>
            <h3 className="mb-2 text-sm font-semibold text-slate-500">{grupo.etiqueta}</h3>
            <ul className="space-y-2">
              {grupo.temas.map((tema) => {
                const cob = coberturaDe(tema.conceptos, materialPorId)
                return (
                  <li key={tema.id} className="rounded-lg border border-slate-200 px-4 py-3">
                    <div className="flex items-center gap-2.5">
                      <span
                        className="h-3 w-3 shrink-0 rounded-full"
                        style={{ backgroundColor: SEMAFORO[cob.nivel].color }}
                        title={SEMAFORO[cob.nivel].texto}
                      />
                      <span className="flex-1 truncate text-sm font-medium text-slate-800">
                        {tema.titulo}
                      </span>
                      <span className="shrink-0 text-xs text-slate-400">
                        {tema.unidad}
                        {cob.total > 0 ? ` · ${cob.conMaterial}/${cob.total} con material` : ' · sin conceptos'}
                      </span>
                    </div>

                    {tema.conceptos.length > 0 && (
                      <div className="mt-2 flex flex-wrap gap-1.5 pl-5">
                        {tema.conceptos.map((id) => {
                          const tiene = (materialPorId.get(id) ?? 0) > 0
                          return (
                            <span
                              key={id}
                              className="flex items-center gap-1 rounded-full bg-slate-50 px-2 py-0.5 text-xs text-slate-600"
                            >
                              <span
                                className="h-1.5 w-1.5 rounded-full"
                                style={{ backgroundColor: tiene ? '#10b981' : '#ef4444' }}
                              />
                              {nombrePorId.get(id) ?? id}
                            </span>
                          )
                        })}
                      </div>
                    )}
                  </li>
                )
              })}
            </ul>
          </div>
        ))}
      </div>
    </div>
  )
}
