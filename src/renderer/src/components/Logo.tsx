/**
 * Marca de PedagoGraph: un birrete académico dibujado como un grafo (las
 * esquinas son nodos; los lados, aristas). Es el mismo dibujo que el icono de
 * la aplicación (`resources/icon.svg`), en SVG para que se vea nítido a cualquier
 * tamaño y herede el color del contenedor con `currentColor`.
 */
export function Logo({ className = 'h-6 w-6' }: { className?: string }): JSX.Element {
  return (
    <svg viewBox="0 0 64 64" className={className} fill="none" aria-hidden focusable="false">
      <g stroke="currentColor" strokeWidth="4.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M57 25 V46" strokeWidth="3.5" />
        <path d="M32 14 L57 25 L32 36 L7 25 Z" fill="currentColor" fillOpacity=".18" />
      </g>
      <g fill="currentColor">
        <circle cx="32" cy="14" r="4.5" />
        <circle cx="57" cy="25" r="4.5" />
        <circle cx="32" cy="36" r="4.5" />
        <circle cx="7" cy="25" r="4.5" />
        <circle cx="57" cy="50" r="4" />
      </g>
    </svg>
  )
}

/**
 * La marca dentro del cuadrado redondeado índigo, igual que el icono del dock:
 * así la app se reconoce igual por dentro que por fuera.
 */
export function LogoInsignia({
  className = 'h-8 w-8',
  interior = 'h-5 w-5'
}: {
  className?: string
  interior?: string
}): JSX.Element {
  return (
    <div
      className={`flex shrink-0 items-center justify-center rounded-xl bg-marca-600 text-white ${className}`}
    >
      <Logo className={interior} />
    </div>
  )
}
