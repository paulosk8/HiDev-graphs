/**
 * Estado de repaso espaciado de un concepto (aprendizaje por recuerdo activo).
 *
 * Combina dos cosas:
 *  - `dominio` (0..5): cuánto crees que dominas el concepto. Es lo que colorea
 *    el mapa (rojo = flojo, verde = dominado).
 *  - la planificación del repaso (SM-2 simplificado): `facilidad`, `intervalo`,
 *    `repeticiones` y la `proximaRevision`, que decide "qué toca repasar hoy".
 *
 * Las fechas se guardan como ISO de día (YYYY-MM-DD) para comparar y ordenar
 * como texto sin ambigüedad de zona horaria.
 */
export interface RepasoConcepto {
  /** Nivel de dominio percibido, 0 (flojo) a 5 (dominado). */
  readonly dominio: number
  /** Factor de facilidad de SM-2 (>= 1.3). Cuanto mayor, más se espacian los repasos. */
  readonly facilidad: number
  /** Intervalo en días hasta la próxima revisión. */
  readonly intervalo: number
  /** Aciertos consecutivos (se reinicia al fallar). */
  readonly repeticiones: number
  /** Último repaso (ISO YYYY-MM-DD). */
  readonly ultimaRevision: string
  /** Próximo repaso previsto (ISO YYYY-MM-DD). */
  readonly proximaRevision: string
}

/**
 * Calidad del recuerdo declarada por la persona al repasar:
 *  0 = no me acuerdo · 3 = con esfuerzo · 4 = bien · 5 = fácil.
 * (Se admite todo el rango 0..5 de SM-2; la UI usa 0/3/4/5.)
 */
export type CalidadRepaso = 0 | 1 | 2 | 3 | 4 | 5

const FACILIDAD_INICIAL = 2.5
const FACILIDAD_MINIMA = 1.3

const acotar = (n: number, min: number, max: number): number => Math.min(Math.max(n, min), max)

/** Suma días a una fecha ISO (YYYY-MM-DD) y devuelve otra fecha ISO. */
export function sumarDias(fechaIso: string, dias: number): string {
  const base = new Date(`${fechaIso}T00:00:00Z`)
  base.setUTCDate(base.getUTCDate() + dias)
  return base.toISOString().slice(0, 10)
}

/**
 * Aplica un repaso al estado actual del concepto y devuelve el estado nuevo
 * (función pura). `hoy` es la fecha ISO del día del repaso.
 *
 * Reglas:
 *  - Si fallas (calidad < 3): se reinician las repeticiones, el próximo repaso
 *    es mañana y el dominio baja un punto.
 *  - Si aciertas: el intervalo crece (1 → 6 → intervalo×facilidad) y, si fue
 *    "bien" o "fácil" (>= 4), el dominio sube un punto.
 *  - La facilidad se ajusta con la fórmula de SM-2, con suelo 1.3.
 */
export function repasar(
  actual: RepasoConcepto | undefined,
  calidad: CalidadRepaso,
  hoy: string
): RepasoConcepto {
  const base = actual ?? {
    dominio: 0,
    facilidad: FACILIDAD_INICIAL,
    intervalo: 0,
    repeticiones: 0,
    ultimaRevision: hoy,
    proximaRevision: hoy
  }

  let { dominio, intervalo, repeticiones } = base

  if (calidad < 3) {
    repeticiones = 0
    intervalo = 1
    dominio = acotar(dominio - 1, 0, 5)
  } else {
    repeticiones += 1
    intervalo = repeticiones === 1 ? 1 : repeticiones === 2 ? 6 : Math.round(intervalo * base.facilidad)
    if (calidad >= 4) dominio = acotar(dominio + 1, 0, 5)
    // calidad === 3: el dominio se mantiene.
  }

  const facilidad = Math.max(
    FACILIDAD_MINIMA,
    base.facilidad + (0.1 - (5 - calidad) * (0.08 + (5 - calidad) * 0.02))
  )

  return {
    dominio,
    facilidad: Number(facilidad.toFixed(3)),
    intervalo,
    repeticiones,
    ultimaRevision: hoy,
    proximaRevision: sumarDias(hoy, intervalo)
  }
}

/** Lee un estado de repaso desde datos planos del YAML (tolerante a campos ausentes). */
export function repasoDesdePlano(datos: unknown): RepasoConcepto | undefined {
  if (!datos || typeof datos !== 'object') return undefined
  const d = datos as Record<string, unknown>
  const num = (v: unknown, def: number): number => (typeof v === 'number' && !Number.isNaN(v) ? v : def)
  const txt = (v: unknown): string => (typeof v === 'string' ? v : '')
  const proxima = txt(d.proximaRevision)
  if (!proxima) return undefined
  return {
    dominio: acotar(num(d.dominio, 0), 0, 5),
    facilidad: Math.max(FACILIDAD_MINIMA, num(d.facilidad, FACILIDAD_INICIAL)),
    intervalo: Math.max(0, num(d.intervalo, 0)),
    repeticiones: Math.max(0, num(d.repeticiones, 0)),
    ultimaRevision: txt(d.ultimaRevision) || proxima,
    proximaRevision: proxima
  }
}
