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
- **Submenús colapsables**: las cabeceras de grupo (Docencia/Aprendizaje) son botones con chevron que pliegan sus sub-ítems; estado persistido en `layoutStore` (`docenciaColapsada`/`aprendizajeColapsada`, `alternarGrupo`). En el sidebar plegado (franja de iconos) los grupos se muestran siempre.
- **Página de Configuración** (`ConfiguracionPage`, sección `configuracion`): sub-navegación vertical a la izquierda + contenido a la derecha. Agrupa lo que antes colgaba del pie del sidebar: **Apariencia** (modo claro/oscuro, único control del tema), **Asistente IA** (la antigua `AsistentePage`, embebida tal cual) y **Datos y copias** (Sincronizar, Actualizar, Copia de seguridad, Restaurar — cada uno con descripción). El pie del sidebar queda con la entrada ⚙️ Configuración y el chip de usuario (avatar + Salir). El modo oscuro vive **solo** en Apariencia (sin acceso rápido en el sidebar); la cuenta vive **solo** en el pie del menú. Verificado por smoke de GUI.
- **Editar asignatura**: botón "Editar" en la ficha reabre el `AsistenteAsignatura` en **modo edición** (prop `asignaturaExistente`). Caso de uso `EditarAsignatura` (canal `asignatura:editar`): conserva los **ids de unidades y temas** existentes (para no romper vínculos tema↔concepto, tareas ni planificación); los temas borrados se limpian de la planificación y los períodos quitados descartan su plan; no cambia el `tipo` ni los subtemas. Verificado por smoke (preservación de ids/vínculos + depuración de planificación) y smoke de GUI del menú por contexto.

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

## Autenticación / nube (Fase A — en curso)

Dirección SaaS aprobada por el usuario: **login con Google OBLIGATORIO** + backend en **Supabase**. Decisión de datos: **solo los archivos (material) son locales; el resto (conceptos, relaciones, asignaturas, temas, tareas) va a Postgres**. Sin Supabase Storage (para no gastar la capa gratuita). Reutilizable para la futura web.

- **Fase A (hecha)** `feat/auth-login-supabase`: login como compuerta. `SupabaseAuthService` (main, `@supabase/supabase-js`): OAuth de escritorio → abre el navegador del sistema (`shell.openExternal`), captura la redirección en un servidor HTTP efímero en `127.0.0.1` (flujo **PKCE**, `exchangeCodeForSession`); sesión persistida cifrada con `safeStorage` en `userData/sesion.dat`. Config vía `MAIN_VITE_SUPABASE_URL`/`MAIN_VITE_SUPABASE_ANON_KEY` (`.env`, leído en `configSupabase.ts`). Canales `auth:iniciar|cerrar|sesion` (`registrarHandlersAuth`; `envolver` exportado). Renderer: `authStore` + `PantallaLogin` (compuerta en `App`) + chip de usuario con "Salir" en Sidebar. DTOs `SesionDTO`/`UsuarioDTO`. Smoke seam: `PEDAGOGRAPH_AUTH_FAKE=1` hace que `obtenerSesion` devuelva una sesión ficticia (verificado por smoke de render). **Falta probar el OAuth real** tras configurar Supabase+Google (manual, requiere las credenciales del usuario).
- **Fase B (hecha, falta que el usuario la aplique)** `feat/nube-esquema`: esquema Postgres en `supabase/migrations/0001_esquema_pedagograph.sql` (+ `supabase/README.md`). Decisión de modelado: **una tabla por agregado** (`conceptos`, `asignaturas`, `tareas`) con el documento completo en `datos jsonb` (misma forma que el YAML del vault) → sincronizar = leer/escribir el agregado entero. PK `(user_id, id)` (id = slug de la app; `user_id` default `auth.uid()`). Columnas de búsqueda **generadas** desde el JSON: conceptos/asignaturas `nombre`, asignaturas `tipo`, tareas `titulo`+`asignatura_id` (claves reales del agregado: `nombre`/`titulo`/`asignaturaId`/`tipo`). Trigger `actualizado_en`. **RLS** `auth.uid() = user_id` en las tres + grant a `authenticated`. El usuario lo corre en Supabase SQL Editor. No verificable por smoke local (requiere su DB).
- **Fase C (hecha)** `feat/nube-datos-acceso` + `feat/nube-plan-sync` + `feat/nube-sync`: **sincronización local-first** (el usuario eligió local-first+sync sobre solo-nube; la futura web sería solo-nube). `SupabaseDataService` (CRUD de agregados `{id,datos}` sobre las 3 tablas con el cliente autenticado; `listar` trae `actualizado_en`). `sincronizacion.ts` = lógica PURA `planificarSincronizacion(locales, remotos)`: solo-local sube, solo-remoto baja, ambos → no-op si contenido idéntico (`canonizar` con claves ordenadas, evita rebotes) o gana el más reciente (mtime vs actualizado_en). Vault: `leerAgregadosLocales`/`escribirAgregadoLocal` tratan el agregado como JSON autocontenido (conceptos/asignaturas = YAML crudo; **tareas pliegan/despliegan las instrucciones** que viven en archivo aparte). `SyncService.sincronizar()` planifica→sube/baja→reindexa si bajó algo. Canal `nube:sincronizar` (+`SincronizacionDTO`). `authStore` sincroniza al iniciar sesión y al arrancar con sesión (no bloquea si falla) + botón "Sincronizar" (☁) en Sidebar. Verificado por 2 smokes (planner; round-trip local A→nube→B con idempotencia). **Mitad de red se prueba en vivo.**
- **Fase D (efectivamente cubierta por Fase C)**: la primera sincronización tras iniciar sesión sube todos los agregados "solo-local" → migra el vault existente a la cuenta sin paso aparte.
- **Auto-sync** `feat/nube-autosync`: además del sync al login/arranque/botón, tras cada cambio local se sube automáticamente. Reutiliza el vigilante chokidar (en su callback programa un sync con debounce de 2s, solo si `auth.configurado` + `auth.haySesionGuardada()`). Sin bucles: el planner hace no-op si el contenido ya coincide, así el ciclo bajar→escribir→detectar→sync se corta tras un ciclo. `SyncService` es reentrante (serializa; si llega petición durante un sync, se repite al terminar). Verificado por smoke del SyncService con nube simulada (sube/baja/idempotente/concurrencia).
- **Sync en vivo confirmado OK** (login + nube + sync + auto-sync, end-to-end con el Supabase real). Gotcha resuelto: `PGRST205 "Could not find the table public.conceptos"` = el esquema (Fase B) no estaba aplicado en el proyecto del `.env`; solución = correr el SQL en ESE proyecto + `notify pgrst, 'reload schema';`. El botón Sincronizar ahora muestra el detalle real de Supabase (`detalle(PostgrestError)`).
- **Borrados** `feat/nube-borrados`: el borrado local se propaga a la nube (merge de tres vías). `planificarSincronizacion(locales, remotos, base)` usa el "estado base" (ids de la última sync, en `.index/sync-base.json` via `leer/guardarBaseSync`) para distinguir "nuevo de otro equipo" (bajar) de "borrado aquí" (borrar de la nube → `borrarRemoto`). **Asimetría deliberada**: NUNCA borra datos locales por sync (seguridad ante nube vaciada/cuenta equivocada) → un ítem borrado en otro equipo puede reaparecer desde este (limitación conocida). `IndexSyncService` ahora también vigila `tareas/` (para su auto-sync). Verificado por smoke (planner 3-vías + propagación end-to-end).
- **Limitaciones actuales (conocidas)**: borrado NO simétrico (ver arriba); conflictos = última-escritura-gana (relojes distintos). Material (archivos) nunca sube: en otro equipo aparece el metadato pero el archivo falta.
- Nota UX: login obligatorio + nube ⇒ la app necesita internet/cuenta para arrancar (rompe el "cero configuración"); añadir modo offline/caché más adelante.

## Decisiones de producto registradas

- La IA **no** analiza automáticamente al agregar un concepto (razonamiento on-demand vía CLI/MCP; el dato es local). Al vincular se valida estructuralmente, no semánticamente.
- Dos tareas se relacionan cuando **comparten conceptos** (pasan por el mismo nodo), no hay "sincronización" aparte.
- Para material de aprendizaje se reutiliza el modelo de conceptos (no material directo en el tema); se puede reconsiderar si genera fricción.
