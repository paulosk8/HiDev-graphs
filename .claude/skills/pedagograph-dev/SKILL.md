---
name: pedagograph-dev
description: >-
  Contexto de desarrollo de PedagoGraph (app Electron para docentes que organiza
  material por conceptos reutilizables y lo visualiza como grafo). Carga esta skill
  al empezar a trabajar en este repo desde cualquier equipo: resume el estado del
  proyecto, la arquitectura, las convenciones, el flujo Git y cómo compilar,
  hacer typecheck y escribir smoke tests. La especificación de dominio completa
  está en CLAUDE.md (en la raíz).
---

# PedagoGraph — contexto de desarrollo

App de escritorio (Electron) para **docentes universitarios no técnicos**: organiza
material pedagógico por **conceptos reutilizables** entre asignaturas y lo visualiza
como grafo. Toda la UI es **en español** y sin jerga técnica.

> La **especificación de dominio, UX y fases** está en [`CLAUDE.md`](../../../CLAUDE.md) (raíz del repo). Léela primero.
> El **historial detallado de funcionalidades** (qué se construyó y cómo) está en [`estado.md`](./estado.md), en esta misma carpeta.

---

## 1. Arquitectura (resumen)

Hexagonal. El **main process es el backend**; el **renderer solo llama IPC**.

```
src/
  main/
    domain/          # entidades y lógica PURA (sin Electron/SQLite/fs). Nombres en español.
    infrastructure/  # VaultFileSystemService (YAML), SqliteGraphRepository, IndexSyncService (chokidar)
    application/     # casos de uso (un archivo por caso: CrearConcepto.ts, RestaurarVault.ts, …)
    ipc/             # registrarHandlers.ts: mapea canales -> casos de uso
  shared/            # contrato IPC TIPADO: canales.ts + dtos.ts + api.ts + resultado.ts
  preload/           # bridge contextIsolation: expone window.api tipada
  renderer/          # React + Zustand. CERO lógica de negocio.
  mcp/               # servidor MCP en Node puro (copiloto IA), independiente de Electron
```

**Reglas invariantes:**
- El renderer **solo** habla por IPC (`window.api`). Nada de fs/SQLite/dominio en el renderer.
- Fuente de verdad = **vault YAML** en `~/Documents/PedagoGraph/` (`conceptos/`, `asignaturas/`, `tareas/`, `.index/`). El SQLite (`.index/index.db`) es **derivado y reconstruible**; sincronización **unidireccional** `fs → índice`.
- El material se referencia por **nombre de archivo relativo** (ej. `clase.pdf`) dentro de la carpeta del concepto → el vault es **portable entre sistemas operativos**.
- Errores cruzan el IPC como `Resultado<T>` = `{ ok:true; valor } | { ok:false; error:{ mensaje, sugerencia? } }`. El renderer los desenvuelve con `desenvolver`.
- Cambiar el contrato obliga a tocar `src/shared` (canales.ts + dtos.ts + api.ts) **y** preload + `renderer/src/lib/api.ts`.

---

## 2. Comandos de desarrollo

```bash
npm run dev            # abre la app (electron-vite dev). Crea el vault si no existe.
npm run build          # compila main+preload+renderer a out/
npm run typecheck      # typecheck:node (tsconfig.node.json) + typecheck:web (tsconfig.web.json)
npm run build:mcp      # empaqueta el servidor MCP a out/mcp/pedagograph-mcp.mjs
npm run rebuild        # recompila módulos nativos (better-sqlite3, node-pty) para Electron
npm run sembrar-demo   # siembra datos de ejemplo en el vault
```

- **TypeScript estricto** (`strict: true`), sin `any` implícito. Nombres de dominio en español.
- `typecheck` usa `--composite false`; **no** invoques `tsc -p tsconfig.web.json` a secas (da TS6307 porque el proyecto es composite).
- El renderer importa lo compartido con el alias **`@shared/...`** (no rutas relativas `../../../../shared`, rompen la lista de archivos del proyecto composite).
- Módulos nativos (better-sqlite3, node-pty) se recompilan en `postinstall`. El empaquetado Windows debe hacerse en Windows/CI.

---

## 3. Cómo verificar cambios: smoke tests headless

**Regla del proyecto: cada funcionalidad se verifica con un smoke antes de commitear.** No hay
framework de tests; se usan scripts de Electron headless en el scratchpad de la sesión.

Dos modos según lo que pruebas:

**A) Lógica de servicios / casos de uso (sin UI)** → Electron con `ELECTRON_RUN_AS_NODE=1`
y `main()` directo. **Ojo: `app.whenReady()` NO resuelve en run-as-node**, por eso se llama
la lógica directamente. Se bundlea con esbuild dejando externos los nativos/ESM:

```bash
npx esbuild smoke.ts --bundle --platform=node --format=cjs \
  --external:electron --external:better-sqlite3 --external:chokidar \
  --external:js-yaml --external:archiver --external:jszip --outfile=.smoke.cjs
ELECTRON_RUN_AS_NODE=1 npx electron .smoke.cjs
```

**B) Render / GUI** → Electron normal con `app.whenReady()` + `BrowserWindow({ show:false })`
+ `webContents.executeJavaScript(...)` para consultar el DOM. Bundlear igual pero **sin**
`ELECTRON_RUN_AS_NODE`, y cargar `out/preload/index.js` + `out/renderer/index.html` (requiere
`npm run build` antes).

**Trucos aprendidos (para que un smoke no dé falsos negativos):**
- `localStorage.clear()` + `reload()` para resetear el layout persistido (zustand persist).
- `innerText` devuelve MAYÚSCULAS si hay `text-transform:uppercase` (cabeceras) — usa `textContent`.
- Para inputs controlados de React: usar el **native value setter** + `dispatchEvent(new Event('input',{bubbles:true}))`.
- Los inputs del modal viven tras un portal; los de la página quedan detrás. **Acota los selectores a `form ...`**.
- La terminal xterm inyecta su propio `<textarea>` oculto; para el textarea del modal usa `[placeholder^="Escribe"]`, no `querySelector('textarea')`.
- **Drag & drop HTML5 no se simula con `dragstart` sintético** (el `setData` no persiste): fija `dt.setData('text/plain', id)` a mano y despacha un `new DragEvent('drop',{dataTransfer:dt,bubbles:true})` sobre un elemento DENTRO de la zona de destino (no un div padre — el evento no baja).
- Pegar: `new DataTransfer()` + `new ClipboardEvent('paste',{clipboardData})`; imagen: `dt.items.add(new File(...))`.
- `cy.zoom(n)` (Cytoscape) devuelve el Core, no clonable por `executeJavaScript` → envuélvelo en una IIFE que retorne un bool.

Limpia el `.smoke*.cjs` y los vaults temporales al terminar.

---

## 4. Flujo de trabajo Git

Repo: `https://github.com/paulosk8/HiDev-graphs` (remoto `origin`, base `main`).

- **Una rama por unidad de trabajo**: `feat/<algo>`, `fix/<algo>`, `chore/<algo>`. `main` siempre desplegable.
- **Commits semánticos (Conventional Commits) en español**: `feat(ámbito): descripción en imperativo`.
  Ámbitos frecuentes: `conceptos`, `asignaturas`, `vault`, `indice`, `material`, `vinculos`, `ipc`, `ui`, `tareas`, `grafo`.
- Terminar cada commit con el trailer: `Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>`.
- **Integración a `main`**: el stack es lineal, así que se hace `git merge --ff-only <rama>` a `main` + `git push origin main`. (`gh` CLI **no está instalado** → no se crean PRs por CLI.)
- Compilar + typecheck + smoke **antes** de commitear.

---

## 5. Peculiaridades del entorno (máquina macOS del autor)

- **`~/.npm` tiene archivos de `root`** (bug viejo de npm) → `EACCES`/`vite@undefined` en `npm install`. Workaround: `npm install --cache <dir-propio>`. Fix permanente (lo corre el usuario): `sudo chown -R $(id -u):$(id -g) ~/.npm`.
- **Node vía nvm, default 22** (electron-vite 5 exige Node ≥20.19; hay `.nvmrc`). En cada shell nuevo: `export NVM_DIR="$HOME/.nvm"; . "$NVM_DIR/nvm.sh"; nvm use default; hash -r`.
- **Operaciones de red de npm** requieren desactivar el sandbox de la tool Bash.

---

## 6. Estado y siguiente

- **Fase 1 (MVP) y Fase 2 completas**; copiloto IA por MCP (consultar grafo, leer material, crear/propagar tareas) + terminal embebida. Workspaces de aprendizaje, tareas ricas (Markdown/HTML/Moodle), planificación por período, respaldo **y restauración**. Ver [`estado.md`](./estado.md) para el detalle.
- **Nube/SaaS (Fases A–D hechas)**: login Google obligatorio + Supabase (Postgres), sync local-first bidireccional con auto-sync y borrados de tres vías. **Robustez offline**: la app arranca sin internet (sesión cacheada), sincroniza al reconectar y las llamadas de red tienen timeout; aviso "Sin conexión" en el Sidebar.
- **Pendiente**: empaquetado/instaladores (electron-builder mac local + Windows por CI, por better-sqlite3). Fase 3: exportar tareas a Moodle/GIFT. **Limitación de nube por resolver**: el **material (archivos) nunca sube** (decisión: sin Supabase Storage). (El borrado simétrico seguro `feat/nube-borrado-simetrico` y la resolución manual de conflictos `feat/nube-conflictos` ya están hechos.) Versión web (SaaS solo-nube) más adelante.
