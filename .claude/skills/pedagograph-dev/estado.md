# PedagoGraph — estado y funcionalidades

Historial de lo construido, con las decisiones no obvias. Complementa `SKILL.md`
(arquitectura/flujo) y `CLAUDE.md` (especificación). Ordenado por temas.

## Fases

- **Fase 1 (MVP)**: completa. CRUD de conceptos, material por drag&drop, CRUD de asignaturas con wizard, vincular temas↔conceptos, ficha de concepto ("se usa en…"), índice SQLite + Reindexar, respaldo. Los 6 criterios de aceptación de `CLAUDE.md §8` verificados.
- **Fase 2**: completa. Mapa de conceptos (Cytoscape + fcose, filtros por asignatura/relación) y planificación semanal con semáforo de cobertura de material.
- **Fase 3**: pendiente (generar tareas por componente exportables a Moodle). El CRUD manual de tareas ya existe; faltaría la exportación GIFT/Moodle.

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

## Decisiones de producto registradas

- La IA **no** analiza automáticamente al agregar un concepto (razonamiento on-demand vía CLI/MCP; el dato es local). Al vincular se valida estructuralmente, no semánticamente.
- Dos tareas se relacionan cuando **comparten conceptos** (pasan por el mismo nodo), no hay "sincronización" aparte.
- Para material de aprendizaje se reutiliza el modelo de conceptos (no material directo en el tema); se puede reconsiderar si genera fricción.
