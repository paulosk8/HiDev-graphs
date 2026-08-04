# PedagoGraph — estado y funcionalidades

Historial de lo construido, con las decisiones no obvias. Complementa `SKILL.md`
(arquitectura/flujo) y `CLAUDE.md` (especificación). Ordenado por temas.

## Fases

- **Fase 1 (MVP)**: completa. CRUD de conceptos, material por drag&drop, CRUD de asignaturas con wizard, vincular temas↔conceptos, ficha de concepto ("se usa en…"), índice SQLite + Reindexar, respaldo. Los 6 criterios de aceptación de `CLAUDE.md §8` verificados.
- **Fase 2**: completa. Mapa de conceptos (Cytoscape + fcose, filtros por asignatura/relación) y planificación semanal con semáforo de cobertura de material.
- **Fase 3**: pendiente (generar tareas por componente exportables a Moodle). El CRUD manual de tareas ya existe; faltaría la exportación GIFT/Moodle.

## Navegación por contexto (Docencia / Aprendizaje)

- El sidebar se organiza en **dos grupos**: **Docencia** y **Aprendizaje**, cada uno con sus sub-ítems **Asignaturas/Espacios**, **Conceptos** y **Mapa**. El **Asistente IA** es transversal. Estado en `uiStore`: `contexto: 'docencia' | 'aprendizaje'` (default docencia); `irASeccion(seccion, contexto?)`.
- Los **conceptos siguen siendo un único pool compartido**: el contexto solo **filtra la vista**. `ListaConceptos` muestra los conceptos usados en asignaturas de ese contexto **más los aún sin usar** (disponibles en ambos); crear un concepto lo deja visible en los dos. El **mapa** (`GrafoPage`) se acota a las asignaturas del contexto activo (`elementosVisibles` recibe el conjunto permitido = asignaturas del contexto ∩ filtro por asignatura). `ListaAsignaturas` recibe `contexto` y muestra solo ese tipo.
- **Lista de conceptos compacta y plegable en dos niveles**: los **grupos de asignatura** arrancan **colapsados** (`gruposAbiertos` vacío por defecto; se despliegan solos al buscar) → ves una lista breve de grupos y decides cuál abrir. Al abrir un grupo, cada concepto es una fila con **estadísticas** («N temas · N materiales»); sus **temas también van colapsados** (`temasAbiertos`) y se despliegan por concepto (lista vertical). El nombre abre la ficha; los chevrons solo pliegan/despliegan. Evita el scroll largo con muchos conceptos o temas. **Fix de contraste en modo oscuro** (`fix/conceptos-contraste-temas`): la sublista de temas usaba `bg-slate-50/50`, y el remapeo oscuro de `main.css` solo cubre las clases neutras **exactas** (no la variante con `/50` ni `border-slate-50`) → barra clara + texto claro ilegible. Se usan `bg-slate-50` y `border-slate-100` (sí remapeadas). Gotcha para el smoke: al quitar una clase Tailwind del código, esa clase se **purga** del CSS compilado (aplicarla luego no hace nada); para reproducir el bug antiguo usa el estilo inline exacto que Tailwind generaba.
- **Submenús colapsables**: las cabeceras de grupo (Docencia/Aprendizaje) son botones con chevron que pliegan sus sub-ítems; estado persistido en `layoutStore` (`docenciaColapsada`/`aprendizajeColapsada`, `alternarGrupo`). En el sidebar plegado (franja de iconos) los grupos se muestran siempre.
- **Página de Configuración** (`ConfiguracionPage`, sección `configuracion`): sub-navegación vertical a la izquierda + contenido a la derecha. Agrupa lo que antes colgaba del pie del sidebar: **Apariencia** (modo claro/oscuro, único control del tema), **Asistente IA** (la antigua `AsistentePage`, embebida tal cual) y **Datos y copias** (Sincronizar, Actualizar, Copia de seguridad, Restaurar — cada uno con descripción). El pie del sidebar queda con la entrada ⚙️ Configuración y el chip de usuario (avatar + Salir). El modo oscuro vive **solo** en Apariencia (sin acceso rápido en el sidebar); la cuenta vive **solo** en el pie del menú. Verificado por smoke de GUI. **Configuración es un toggle** (`feat/config-toggle`): pulsar el botón cuando ya estás en Configuración la cierra y **regresa a la vista anterior** (sección + contexto, recordados al abrirla en `vistaPrevia`, variable de módulo de `uiStore`); `uiStore.alternarConfiguracion` + el `Item` del Sidebar acepta un `alSeleccionar` opcional para no alterar el resto de ítems. Smoke del store (10 checks).
- **Editar asignatura**: botón "Editar" en la ficha reabre el `AsistenteAsignatura` en **modo edición** (prop `asignaturaExistente`). Caso de uso `EditarAsignatura` (canal `asignatura:editar`): conserva los **ids de unidades y temas** existentes (para no romper vínculos tema↔concepto, tareas ni planificación); los temas borrados se limpian de la planificación y los períodos quitados descartan su plan; no cambia el `tipo` ni los subtemas. Verificado por smoke (preservación de ids/vínculos + depuración de planificación) y smoke de GUI del menú por contexto.

## Repaso espaciado + dominio en el grafo

- **Aprendizaje por recuerdo activo** sobre los conceptos. Estado de repaso en el dominio (`Repaso.ts`, SM-2 puro `repasar(actual, calidad, hoy)` + `sumarDias`): `dominio` (0..5), `facilidad`, `intervalo`, `repeticiones`, `ultimaRevision`, `proximaRevision` (ISO de día). `Concepto` tiene `repaso?`.
- **Persistencia**: el repaso vive dentro de `concepto.yaml` (parte del contenido → sincroniza con la nube y viaja entre equipos). El índice añade columnas `dominio`/`proxima_revision` a `nodes` (migración ligera); `ResumenConcepto(DTO)` y `ConceptoDTO` exponen `dominio` + `proximaRevision`. Reindexar reconstruye el repaso desde el YAML (verificado).
- **Caso de uso** `RegistrarRepaso` (canal `concepto:repasar`, `CalidadRepaso 0|3|4|5` en la UI): recalcula, guarda y reindexa. `conceptosStore.repasar` refleja el nuevo dominio/próxima revisión en el listado.
- **Alcance = capa de Aprendizaje**: el repaso vive **bajo el grupo Aprendizaje** del menú y solo cubre los conceptos usados en espacios de aprendizaje (`conceptosDeAprendizaje` en `lib/repaso.ts`); los de docencia no entran (aprender ≠ enseñar). El pool de conceptos sigue siendo único; esto es solo el alcance de la actividad. Reversible si se quisiera transversal.
- **UI**: **«Repaso»** bajo Aprendizaje (`ModoEstudioPage`, sidebar con badge de pendientes de hoy de esa capa) → sesión de recuerdo activo (mostrar respuesta → valorar No lo sé/Difícil/Bien/Fácil). Helper `lib/repaso.ts` (`pendientesHoy`, `tocaHoy`, `colorDominio`, `etiquetaDominio`). En la página de Repaso, un explicador **«¿Cómo funciona?»** (modal) describe el recuerdo activo, las 4 valoraciones y el dominio. El toggle **«🎯 Dominio»** del **Mapa** colorea los conceptos por dominio (gris = sin repasar, rojo = no lo sé, ámbar = a profundizar, verde = dominado) y **solo aparece en el Mapa de Aprendizaje** (el repaso es de esa capa). Verificado por smokes (lógica SM-2/persistencia/reindexado, GUI de la sesión + badge, y GUI del explicador + acotado del toggle a Aprendizaje).

## Panel de salud de la asignatura

- Pestaña **«Estado»** en la ficha de asignatura (junto a Contenido y Planificación), componente `SaludAsignatura`. Se calcula **en el cliente** desde datos que la ficha ya tiene (asignatura + tareas + `conceptosStore` para el nº de material por concepto); **sin backend ni IPC nuevos**.
- Chequeos con semáforo verde/ámbar: **temas sin concepto vinculado**, **conceptos sin material** (chips que abren la ficha del concepto para agregarlo), **temas sin tarea/práctica** y —solo docencia— **temas sin asignar a ninguna semana**. Arriba, cifras clave (temas, conceptos, con material X/Y, tareas) y un resumen (todo en orden / N puntos por revisar). Verificado por smoke de GUI.

## Docencia: «Tema/Subtema» en vez de «Unidad/Tema»

- Decisión: en **Docencia** el nivel superior ya **no se llama «Unidad»** sino **«Tema»** (el docente lo titula «Unidad 1» si quiere) y sus hijos son **«Subtemas»**. Es **solo reetiquetado de UI** (`AsistenteAsignatura`, `FichaAsignatura`, tarjeta de `ListaAsignaturas`): el backend sigue siendo Asignatura→Unidad→Tema→Subtema, así que el puente (concepto se vincula al backend-Tema = «Subtema» en la UI), la planificación y las tareas **no se tocan** («no dañar el backend»). Aprendizaje conserva «Bloque/Tema».
- **Alta/edición sin paso de contenido** (`AsistenteAsignatura`, ahora un **formulario simple**, no un wizard): crear/editar solo pide lo esencial — nombre y, en docencia, períodos y componentes; aprendizaje pide solo el nombre. El **contenido (temas/subtemas) se agrega/edita inline** en la ficha, no aquí. En edición, `DatosAsignaturaEdicionDTO.unidades` es **opcional**: el formulario lo omite y `EditarAsignatura` **conserva la estructura**; el editor inline sí lo envía (incluso `[]` para vaciar).
- **Edición inline + 3 niveles** (`EditorContenido`): la pestaña «Contenido» de la ficha es un **árbol editable in situ** (sin abrir el wizard): títulos editables al vuelo (persisten al perder el foco), y botones «+ Agregar tema/subtema/sub-subtema» y «✕» en cada nivel. Expone el 3er nivel usando el `Subtema` del backend. Etiquetas por contexto: docencia = tema→subtema→sub-subtema; aprendizaje = bloque→tema→subtema. La vinculación de conceptos y las tareas siguen en el nivel 2 (backend-Tema). Persiste vía `editarAsignatura` (extendido: `DatosTemaEdicionDTO.subtemas` conserva ids), conservando lo demás. **Autosave silencioso**: al perder el foco solo guarda si de verdad cambió algo (dirty-check contra la asignatura); guarda **sin toast** (`asignaturasStore.editar(..., { silencioso: true })`) y muestra un indicador transitorio **«✓ Guardado»** en el editor. **Confirmación de borrado**: quitar un tema/subtema con contenido (título, hijos, conceptos vinculados o tareas) abre un `DialogoConfirmacion` con el detalle de lo que se perderá (los conceptos y su material NO se borran); los nodos vacíos nuevos se quitan sin preguntar. Así, entrar y salir de un campo sin editar ya no dispara el aviso «Cambios guardados». El wizard «Editar» sigue existiendo para nombre/períodos/componentes. Verificado por smoke de GUI (añadir subtema L2 y sub-subtema L3, comprobados en el vault). Gotcha de test: en ventana oculta `el.blur()` no dispara `onBlur` de React; hay que despachar `focusout` que burbujea.

## Notas de concepto + formato «código»

- **Notas/observaciones por concepto (VARIAS)**: `Concepto.notas: NotaConcepto[]` (`{id,titulo,contenido,formato}`), guardadas en `concepto.yaml` (sincronizan). Cada nota es markdown/html/código. Se editan en la ficha (`NotasConcepto`: lista + «+ Agregar nota», editar/eliminar por nota) y se muestran al **revelar la respuesta en el repaso**. **Compat**: la forma antigua (`notas: string` + `formatoNotas`) migra a una nota única al leer. DTO: `NotaDTO`, `ConceptoDTO.notas`/`DatosConceptoDTO.notas` como array.
- **Pegado rico en las notas** (`lib/pegadoRico.ts`, compartido con el editor de tareas): pegar desde Word/web conserva **tablas** (HTML→Markdown o HTML crudo) e **imágenes** (base64). El **HTML** en `ContenidoFormateado` ahora ocupa **todo el ancho** (el iframe siempre lleva `w-full`; antes el `className` lo reemplazaba y lo encogía).
- **Bug corregido**: `EditarConcepto` no preservaba `repaso` (editar un concepto borraba su progreso de repaso). Ahora conserva `repaso` y las `notas` salvo que la edición traiga notas nuevas.
- **Formato «código»** (tercer formato además de Markdown/HTML): `FormatoInstrucciones = 'markdown'|'html'|'codigo'` (en shared **y** en `domain/tipos`). Componentes compartidos `VistaCodigo` (aspecto tipo VS Code: cabecera con puntos, tema oscuro, números de línea, monoespaciada; **sin dependencia nueva**) y `ContenidoFormateado` (renderiza md/html/código) reutilizados por tareas, notas y repaso. En el vault, las instrucciones de tarea en código viven en `instrucciones.code.txt`; el guardado limpia los archivos de los otros formatos (helper `formatoInstruccionesDesde` + `rutaInstruccionesExistente`/`limpiarInstruccionesOtras`). Verificado por smoke headless (persistencia + preservación + limpieza) y GUI (editor de notas + opción en tareas).

## Modelo de dominio (dos capas + puente)

- **Conocimiento**: `Concepto` (relaciones tipadas prerequisito_de/relacionado_con/profundiza; posee `Recurso`s = material). El material pertenece al **concepto**, nunca a la asignatura.
- **Curricular**: `Asignatura` → `Unidad` → `Tema` → `Subtema`; `ComponenteAprendizaje` configurable por asignatura; planificación por `Semana`.
- **Puente**: un `Tema` instancia uno o más `Concepto`s (así se reutiliza el material entre asignaturas).
- **Asignatura multi-período**: la misma asignatura se oferta en varios `periodos` (ej. 2026A, 2026B) **sin duplicar** contenido. Modelo: `periodos: string[]`.
- **Workspaces de aprendizaje**: `Asignatura.tipo: 'docencia' | 'aprendizaje'`. Un espacio de aprendizaje reutiliza TODO el modelo (temas/subtemas/conceptos/material/prácticas) pero en la UI omite períodos y componentes, y relabela ("Prácticas", "Bloque", badge "Aprendizaje"). Retrocompatible: sin `tipo` = docencia. El índice no guarda `tipo`; el handler `asignaturasListar` lo lee del vault.
- **Tarea** (capa transversal, en `vault/tareas/`): temas (1+), componente (0-1 opcional), conceptos (auto-derivados de los temas), instrucciones en **Markdown o HTML** (HTML para Moodle, preview en iframe sandbox), imágenes pegadas incrustadas en **base64**, adjuntos, y **enlaces** (recursos online). El índice NO toca tareas (se consultan por escaneo del vault).

## Copiloto IA (MCP)

- Servidor MCP en **Node puro** (`src/mcp/`), stdio, sin better-sqlite3/Electron (lee el vault en memoria). Se lanza con el ejecutable de la app + `ELECTRON_RUN_AS_NODE=1` para que el usuario final no necesite Node.
- **14 tools**: resumen_grafo, listar_asignaturas, buscar_conceptos, usos_de_concepto, relaciones_de_concepto, cruces_entre_asignaturas, leer_material, detalle_asignatura, listar_tareas, crear_tarea, duplicar_tarea, combinar_tareas, analizar_conexiones, vincular_conceptos.
- `leer_material` extrae texto de PDF (unpdf), Word (mammoth), PowerPoint (jszip + `<a:t>`), md/xml/html.
- **Auto-conexión con un clic** ("Asistente IA"): detecta y configura Gemini/Antigravity (`~/.gemini/config/mcp_config.json`) y Claude Code (`claude mcp add-json … -s user`). La app busca el binario en rutas comunes porque la GUI no hereda el PATH del shell.
- **Terminal embebida** (xterm.js + node-pty) con sesión **persistente** durante la vida de la app (no se mata al navegar). Abre en `cwd = vault`.
- Nota: el servidor MCP escribe YAML; la app lo refleja al recargar la ficha (chokidar no vigila `tareas/`, es scan-based). Antigravity guarda artefactos en su carpeta de conversación; hay que pedirle explícitamente `crear_tarea` para que quede en el vault.

## Grafo (Mapa de conceptos)

- Cytoscape + fcose. Nodos: conceptos, asignaturas y **tareas** (rombo ámbar con aristas a sus conceptos). Aristas: `usado_en`, relaciones tipadas, `tarea_concepto`.
- Filtros por asignatura (chips si ≤6, desplegable con búsqueda si >6) y por tipo de relación (con tooltips). Etiquetas a tamaño ~constante al hacer zoom. Al seleccionar un concepto, el panel lateral se filtra a sus conectados.
- **Color de los nodos-concepto = rol en la secuencia de prerequisitos** (`rolesDeConceptos` desde las aristas `prerequisito_de`): **Base** (cian, es prerequisito de otros y no depende de ninguno), **Intermedio** (violeta, puente), **Avanzado** (rosa, depende de otros), **Sin secuencia** (índigo neutro). Sustituye la antigua paleta posicional/aleatoria. Los puntos del panel lateral usan el mismo color. El **tamaño** del nodo sigue siendo la importancia (peso = conexiones/usos) y el **color de las líneas** el tipo de relación. En **Aprendizaje** con «🎯 Dominio» los nodos se colorean por dominio en su lugar.
- **Leyenda unificada**: el panel plegable inferior-derecho se titula **«Leyenda»** con dos secciones: **Color del concepto** (roles, o dominio en modo Aprendizaje) y **Tipos de conexión** (aristas). Se quitó la leyenda de dominio del encabezado (consolidada aquí). Verificado por smoke (lee el color real de cada nodo vía `window.__cy`) y captura.
- Panel **"Analizar conexiones"** (en cliente): pares que co-ocurren en un tema sin relación tipada + conceptos aislados; botón "Vincular" (IPC `concepto:vincular`, que además reindexa para reflejo inmediato).
- Combinar tareas: seleccionar 2 nodos-tarea → "Combinar en una tarea nueva".
- **Modo oscuro** (toggle en Sidebar, persistido en `layoutStore`): se remapean los neutros de Tailwind bajo `.dark` en `assets/main.css`; Cytoscape colorea etiquetas según el tema.

## Planificación semanal por período

- `Asignatura.planificaciones: [{ periodo, semanas:[{ numero, temas[] }] }]`. Caso de uso `GuardarPlanificacion`, canal `planificacion:guardar`.
- UI `PlanificacionSemanal`: selector de período, temas arrastrables (HTML5 DnD) a semanas (drop zones), por semana la cobertura de material + tareas que la cubren (reutilizar/crear) + los **recursos concretos** (archivos) de los conceptos de esos temas, previsualizables. Caso de uso `ObtenerMaterialDeConceptos`.

## Respaldo y restauración

- **Respaldo** (`RespaldarVault`, `archiver` ESM vía `await import`): `.zip` nivel 9 con `conceptos/`, `asignaturas/`, `tareas/` (con material); excluye `.index/` (reconstruible). Diálogo "Guardar como", nombre `PedagoGraph-respaldo-YYYY-MM-DD.zip`.
- **Restauración** (`RestaurarVault`, `jszip` vía `await import`): elige el `.zip` → descomprime esas carpetas sobre el vault (**combina**: reemplaza los del mismo nombre, conserva el resto), con guarda anti *zip-slip*, y reindexa. Canal `sistema:restaurar`, `RestauracionDTO`. Botón "Restaurar copia" (♻️) en el Sidebar con confirmación.
- Portable entre SO (material por nombre relativo). Verificado por smoke de ida y vuelta (respaldar vault A → restaurar en vault B vacío: material byte-idéntico, índice rehecho).

## Almacenamiento del material (modelo Obsidian)

Cambio de rumbo: **se eliminó el backend propio (Supabase)** —login con Google, sync de
metadatos y resolución de conflictos— y se adoptó el **modelo Obsidian**: el material vive
en una carpeta que el cliente de escritorio de **Google Drive / OneDrive** ya sincroniza.
Razón: así **también se sincronizan los archivos** (con Supabase nunca subían, era la
limitación conocida), sin login, sin backend y sin coste. Todo lo borrado está en el
historial de git (rama `feat/almacenamiento-nube`, PR #18) por si hay que recuperarlo.

- **Preferencias por-equipo** (`infrastructure/configApp.ts`, `userData/config.json`, fuera
  del vault a propósito: la ruta del vault no puede vivir dentro del vault): `configurado`,
  `modoAlmacenamiento: 'local' | 'nube'` y `rutaVaultNube` (ruta absoluta y completa; el
  docente elige ubicación **y** nombre de carpeta). `rutaContenedorNube` queda como campo
  heredado, solo se lee para migrar al formato nuevo.
- **Detección de carpetas de nube** (`infrastructure/DeteccionNube.ts`): sin APIs ni OAuth
  de los proveedores — solo se **busca con `existsSync`** la carpeta local que el cliente ya
  mantiene sincronizada, en macOS y Windows. En Google Drive se apunta a `Mi unidad`/`My
  Drive` (nunca a la raíz de la cuenta, que también trae "Ordenadores" y "Unidades
  compartidas").
- **Mover el almacenamiento** (`application/MoverAlmacenamiento.ts`): copia recursiva de
  `conceptos/`, `asignaturas/` y `tareas/` (nunca `.index/`) **sin sobrescribir** lo que ya
  exista en el destino y **sin borrar nada** — así se puede *adoptar* una carpeta de nube que
  ya trae material de otro equipo (`adoptado`), y la carpeta anterior se conserva como
  respaldo. El cambio es **en caliente**: re-apunta el núcleo y recarga la ventana, sin
  reiniciar el proceso. Canales en `ipc/registrarHandlersAlmacenamiento.ts`.
- **El índice SQLite pasó a ser por-equipo** (`userData`), fuera de la carpeta de nube: es
  derivado y reconstruible, y no debe viajar entre equipos ni provocar conflictos del cliente
  de nube.
- **UI**: Configuración → Datos y copias (`AlmacenamientoNube.tsx`) con "este equipo" / "en mi
  nube", y `DialogoGuardarNube.tsx` (estilo Obsidian: ubicación + nombre de carpeta + vista
  previa de la ruta + selector nativo para crear carpeta). **Cambiar de carpeta o de nube
  cuando ya se usa una** (p. ej. Drive → OneDrive): "En mi nube" ofrece "Cambiar…" además de
  marcarse como actual, el diálogo preselecciona la ubicación de hoy ("Ahora aquí"), precarga
  el nombre y avisa de que la carpeta anterior se conserva.
- **Limitación heredada resuelta**: los archivos de material ahora sí llegan a los otros
  equipos (los sincroniza el cliente de nube, no la app). A cambio, la app **no controla** la
  resolución de conflictos: la delega en Drive/OneDrive (que renombran el archivo en
  conflicto). El deshacer propio es el historial de versiones (abajo).

## Bienvenida de primer arranque y capas

- `features/bienvenida/Bienvenida.tsx` — **paso 1**: dónde guardar el material (este equipo o
  la nube detectada). Solo aparece si `configurado` es falso. Si la elección no recarga la
  ventana (p. ej. "este equipo", que ya es la carpeta por defecto), entra directo vía `onListo`.
- `features/bienvenida/SeleccionCapas.tsx` — **paso 2**: qué capas quiere ver (Docencia,
  Aprendizaje o ambas). Habilita/oculta los grupos del menú lateral (`layoutStore.elegirCapas`)
  y aterriza en la primera capa habilitada para no mostrar una sección oculta. Editable luego
  en Configuración → Apariencia.

## Historial de versiones del material

- `infrastructure/HistorialService.ts`: cada vez que un **concepto, asignatura o tarea**
  cambia se guarda un *snapshot* JSON en `userData` —**por-equipo, fuera del vault**— para no
  viajar por la nube ni ensuciar la carpeta del docente. Captura **por hash** (solo si el
  contenido cambió) y conserva **40 versiones máx. por elemento** (poda las antiguas).
- Versiona solo los agregados, **no** los binarios de material (pdf/pptx): son grandes y no
  cambian tras subirse.
- UI "Historial de cambios" (`features/configuracion/HistorialCambios.tsx`, en Configuración →
  Datos y copias): ver las versiones de un elemento y **restaurar** una anterior (reversible,
  porque restaurar también queda registrado). Canales en `ipc/registrarHandlersHistorial.ts`.

## Identidad visual y barra de menú

- **Logo**: marca original en SVG (`resources/icon.svg`) — un birrete académico dibujado como
  un grafo (las esquinas son nodos; los lados, aristas). `npm run iconos`
  (`scripts/generar-iconos.ts`) lo rasteriza **con el propio Chromium de Electron** (canvas,
  sin dependencias nuevas) y genera `icon.png` (1024), `icon.icns` (macOS, vía `iconutil`),
  `icon.ico` (Windows, empaquetado a mano) y `resources/icons/*.png` sueltos. Van en
  `resources/` y no en `build/` porque esa carpeta sí se versiona. En la app se usa vía
  `components/Logo.tsx` (inline, hereda color) en la ventana, el dock, el menú lateral y la
  bienvenida.
- **Barra de menú propia, en español** (`main/menu.ts`), con lenguaje de docente: Archivo
  (nuevo concepto ⌘N, nueva asignatura ⇧⌘N, copia de seguridad ⇧⌘S, restaurar), Editar, Ver
  (Asignaturas/Conceptos/Mapa/Repaso/Asistente ⌘1…⌘5, tamaño del texto, pantalla completa),
  Herramientas (actualizar mi material ⌘R, abrir la carpeta del material, terminal) y Ayuda.
  Sustituye a la de Electron (en inglés y con opciones de programador).
  **Decisión clave**: el menú **no ejecuta lógica de interfaz**; envía la acción al renderer
  por el canal `menu:accion` (`AccionMenu`) y allí se resuelve con la **misma API que los
  botones** equivalentes → un solo camino por acción. Lo que sí es del sistema (abrir la
  carpeta, "Acerca de") se hace en el main. `rutaVault` se pasa como **función** porque la
  carpeta puede cambiar en caliente.
- Las acciones de datos (actualizar, respaldar, restaurar) se extrajeron a
  `features/configuracion/accionesDatos.ts` y las comparten Configuración y el menú.
- **El nombre "PedagoGraph" en el dock** (`fix/nombre-app`): en macOS el nombre visible NO sale
  de `app.setName()`, sale del **paquete que ejecuta la app** — en desarrollo, el `Electron.app`
  de `node_modules`, por eso se veía "Electron". `npm run marca-dev` (`scripts/marca-dev.ts`)
  reescribe `CFBundleName`/`CFBundleDisplayName` y el icono de esa copia local (solo
  `node_modules`, nada del sistema; se rehace en cada instalación, por eso va también en
  `postinstall`) y le toca la fecha al paquete, porque macOS cachea nombre e icono por mtime.
  Para la app **empaquetada** el arreglo real es `productName: "PedagoGraph"` en
  `package.json`; en Windows, `app.setAppUserModelId` evita que la barra de tareas agrupe la
  ventana bajo "Electron". **Hay que reiniciar la app para verlo.**

## Datos de prueba

- `npm run sembrar-demo` (`scripts/sembrar-demo.ts`) — el juego de datos grande de siempre.
- `scripts/sembrar-prueba.ts` — juego **pequeño**: 5 conceptos conectados por relaciones
  tipadas + una asignatura, para probar el Mapa, la ficha de concepto y el historial. Apunta al
  **vault activo** (lee `config.json`: nube o local) y es **aditivo** (solo crea lo que falta).
  Se ejecuta bundleándolo con esbuild (ver la cabecera del archivo).

## Lienzos (mapa conceptual libre)

Sección **Lienzos**, una por capa (Docencia / Aprendizaje). A diferencia del
Mapa de conceptos —que CALCULA la disposición con fcose— aquí la decide el
docente y se guarda.

- **Formato `.canvas` de Obsidian** (JSON) en `lienzos/<slug>.canvas`. Claves en
  inglés (`nodes`, `edges`, `fromSide`) porque son las suyas. `nombre` y
  `contexto` son extensiones nuestras; Obsidian ignora lo que no conoce.
- **DOM + SVG, sin dependencias nuevas.** Cytoscape no sirve: no da tarjetas
  ricas ni editables. Tarjetas en DOM, líneas en un SVG debajo.
- **Las tarjetas son REFERENCIAS**, no copias: `conceptos/<id>/concepto.yaml`
  (concepto), + `notaId` (una nota concreta), o `conceptos/<id>/<archivo>`
  (material). Lo que se ve sale del concepto de verdad.
- Tipos de tarjeta: concepto, nota de un concepto, material (con vista previa
  vía `recurso://`), texto libre («nota suelta») y grupo.
- **Grupos**: selección múltiple con recuadro o Mayús+clic, Ctrl/⌘+G agrupa.
  Mover el grupo arrastra su contenido; quitarlo CONSERVA las tarjetas.
- **Conexiones**: se arrastra desde uno de los cuatro puntos de una tarjeta.
  Bézier perpendicular al lado (una recta se confunde con el borde). Clic sobre
  la línea para nombre y color; doble clic la quita.
- **Arrastrar desde el panel lateral**: concepto, nota o material caen donde se
  suelten. El dato viaja bajo `application/pedagograph-lienzo` (ver
  `features/lienzo/arrastreAlLienzo.ts`) y NO bajo `text/plain`, para que
  soltar texto de fuera no cree tarjetas fantasma.
- **Colores translúcidos (12 %)** en grupos y notas sueltas: un relleno sólido
  solo vale para UN fondo y en modo oscuro se veía como mancha blanca. Los
  contrastes están MEDIDOS (ver `features/lienzo/coloresLienzo.ts`).
- El buscador de conceptos va en **modal**: el área de dibujo mide 3000 px, así
  que posicionarlo contra su borde derecho lo mandaba fuera de la vista.
- **Gotcha resuelto**: el `min-width` del SVG ensanchaba el `<main>` de la app y
  provocaba scroll horizontal en TODA la ventana. El área de dibujo es ahora un
  div con tamaño propio y la raíz del editor lleva `overflow-hidden`.

## Panel lateral del concepto (`components/PanelVistazo.tsx`)

Se abre al pulsar un `[[enlace]]` o una tarjeta del lienzo. **Reutiliza
`NotasConcepto` y `ZonaMaterial` de la ficha** en vez de tener su propio
editor: el primero que escribí no soportaba formatos de nota, pegado con
formato ni arrastrar material. Es una COLUMNA del layout, no flotante (antes
tapaba la barra del lienzo). Pestañas verticales cuando hay varios conceptos
abiertos, para no deshacer la pila uno a uno.

## Etiquetas, enlaces y organización

- **Etiquetas** (`Concepto.etiquetas`, tabla `tags` en el índice): campo del
  concepto, no texto en la nota. Se comparan sin tildes ni mayúsculas y se
  sugieren las ya usadas. `buscarConceptos` mira nombre, descripción Y
  etiquetas.
- **Enlaces `[[Concepto]]`** en las notas: se teclea `[[` y autocompleta. Un
  enlace roto se pinta en ámbar, no desaparece. «Se menciona en» (retroenlaces)
  y «Aparece en estos lienzos» se resuelven ESCANEANDO el vault, no el índice:
  el enlace vive dentro del texto y indexarlo obligaría a re-escanear en cada
  tecla.
- **Carpetas de material**: reales en disco (`conceptos/<slug>/Lecturas/x.pdf`),
  un solo nivel, plegables. Se arrastra un archivo a otra carpeta; el arrastre
  interno se distingue del de archivos del sistema POR EL TIPO, no adivinando.
- **Mover con clic derecho**: menú propio (el nativo no permite buscar el
  destino). Los temas se mueven dentro de su asignatura; cruzar de asignatura
  rompería las tareas y la planificación que los referencian.
- **Papelera**: lo eliminado va a `Eliminados/` dentro del vault (recuperable,
  viaja por la nube) o se borra. Configurable.
- **Temas accesibles**: claro, cálido, alto contraste (claro y oscuro), oscuro.
  Contrastes MEDIDOS con smoke. Se arregló de paso que `text-slate-400` daba
  2,56:1 en el tema por defecto.

## Trampas del vault que ya han mordido

`RespaldarVault`, `RestaurarVault` y `MoverAlmacenamiento` llevan **su lista de
carpetas escrita a mano**. Al añadir `lienzos/` nadie las actualizó y los
lienzos se perdían al respaldar, restaurar o mover el material. **Si añades una
carpeta nueva al vault, actualiza las tres.**

## Decisiones de producto registradas

- La IA **no** analiza automáticamente al agregar un concepto (razonamiento on-demand vía CLI/MCP; el dato es local). Al vincular se valida estructuralmente, no semánticamente.
- Dos tareas se relacionan cuando **comparten conceptos** (pasan por el mismo nodo), no hay "sincronización" aparte.
- Para material de aprendizaje se reutiliza el modelo de conceptos (no material directo en el tema); se puede reconsiderar si genera fricción.
