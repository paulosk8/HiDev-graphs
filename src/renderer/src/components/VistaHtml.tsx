import { useEffect, useRef } from 'react'

/**
 * Pinta el HTML que escribe el docente, admitiendo contenido incrustado
 * (`<iframe>` de Excalidraw, vídeos, GeoGebra…).
 *
 * Por qué no se usa `srcDoc`: el contenido puede llevar iframes, y las
 * restricciones del `sandbox` **se heredan** a los anidados. Sin
 * `allow-same-origin` el incrustado no accede a su propio origen y se queda en
 * blanco; con `allow-same-origin` sobre `srcDoc`, el contenido compartiría
 * origen con la app y podría alcanzar `window.parent` y la API interna.
 *
 * Solución: cargar `recurso://contenido/` —un documento anfitrión con **origen
 * propio**, servido por el proceso principal— y mandarle el HTML por
 * `postMessage`. Así el sandbox puede relajarse sin exponer la aplicación.
 */
export function VistaHtml({
  html,
  titulo = 'Contenido',
  className
}: {
  html: string
  titulo?: string
  className?: string
}): JSX.Element {
  const marcoRef = useRef<HTMLIFrameElement>(null)

  useEffect(() => {
    const marco = marcoRef.current
    if (!marco) return

    const enviar = (): void => {
      marco.contentWindow?.postMessage({ tipo: 'pedagograph:contenido', html }, '*')
    }

    // El anfitrión avisa cuando está listo. Se escucha además `load` porque si
    // el contenido cambia y el documento ya estaba cargado, no habrá otro aviso.
    const alRecibir = (evento: MessageEvent): void => {
      if (evento.source === marco.contentWindow && evento.data?.tipo === 'pedagograph:listo') {
        enviar()
      }
    }
    window.addEventListener('message', alRecibir)

    // Recargar es lo que garantiza partir de un documento limpio: el anfitrión
    // pinta con document.write, que no es reversible.
    marco.src = 'recurso://contenido/'

    return () => window.removeEventListener('message', alRecibir)
  }, [html])

  return (
    <iframe
      ref={marcoRef}
      title={titulo}
      // `allow-same-origin` es seguro aquí porque "su origen" es
      // recurso://contenido, no el de la app.
      sandbox="allow-scripts allow-same-origin allow-popups allow-presentation allow-forms"
      allow="fullscreen; clipboard-write"
      className={`min-h-[16rem] w-full rounded-lg border border-slate-200 bg-white ${className ?? ''}`}
    />
  )
}
