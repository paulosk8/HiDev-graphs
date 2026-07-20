# PR — feat(almacenamiento): guardar el material en Google Drive/OneDrive con bienvenida de primer arranque

> Rama: `feat/almacenamiento-nube` → `main`
> Abrir: https://github.com/paulosk8/HiDev-graphs/pull/new/feat/almacenamiento-nube

---

## Descripción (copiar al cuerpo del PR)

## Qué cambia
Reemplaza la sincronización por backend propio (Supabase) por el **modelo Obsidian**: el material vive en una carpeta que el cliente de Google Drive / OneDrive ya sincroniza. Sincroniza también los archivos (antes no), sin login ni backend. Añade **bienvenida de primer arranque** e **historial de versiones**.

## Contenido (3 commits)
1. `feat(almacenamiento)` — almacenamiento en nube + bienvenida + capas + eliminación de Supabase
2. `feat(historial)` — historial de versiones del material con restaurar
3. `chore(scripts)` — datos de prueba (5 conceptos conectados + asignatura)

## Nuevo: almacenamiento
- Elegir dónde se guarda el material (este equipo / carpeta de nube) en Configuración → Datos y copias.
- Autodetección de carpetas de Google Drive y OneDrive (macOS y Windows).
- Diálogo tipo Obsidian: ubicación + nombre de carpeta + vista previa + selector nativo (crear carpeta).
- Índice SQLite por-equipo (userData), fuera de la carpeta de nube; cambio de almacenamiento en caliente (re-apunta el núcleo y recarga la ventana, sin reiniciar el proceso).

## Nuevo: bienvenida de primer arranque
- Paso 1: dónde guardar el material. Paso 2: elegir capas (Docencia / Aprendizaje / ambas).
- El menú lateral muestra solo las capas habilitadas; editable en Configuración → Apariencia.

## Nuevo: historial de versiones
- Guarda una versión (snapshot) de cada concepto/asignatura/tarea cuando su contenido cambia, en userData (por-equipo, fuera del vault).
- Captura por hash (solo si cambió), 40 versiones máx. por elemento.
- UI "Historial de cambios" (Configuración → Datos y copias): ver versiones y restaurar una anterior (reversible).

## Eliminado (Supabase)
Auth con Google, sync de metadatos, resolución de conflictos, panel/stores asociados, canales/DTOs/métodos IPC de auth y nube, dependencia `@supabase/supabase-js`, variables de entorno y carpeta `supabase/`.

## Verificación
`npm run typecheck` y `npm run build` en verde. Flujo probado en local: primer arranque → elegir Drive → elegir capas → sembrar datos de prueba → ver grafo, ficha "Se usa en…" e historial.

🤖 Generated with [Claude Code](https://claude.com/claude-code)
