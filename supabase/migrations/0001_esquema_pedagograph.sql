-- ============================================================================
-- PedagoGraph — Esquema inicial en la nube (Fase B)
--
-- Guarda la ESTRUCTURA de cada usuario (conceptos, asignaturas, tareas). Los
-- ARCHIVOS de material NO se suben: siguen siendo locales; en la nube solo va su
-- metadato (nombre/formato), dentro del JSON del concepto.
--
-- Diseño: una tabla por "agregado", con el documento completo en `datos jsonb`
-- (misma forma que el YAML del vault local). Así la sincronización lee/escribe
-- el agregado entero. Las columnas de búsqueda se derivan del JSON (generadas).
--
-- Seguridad: Row-Level Security. Cada usuario solo ve y gestiona SUS filas
-- (user_id = auth.uid()). La clave `anon` pública no puede leer datos de otros.
--
-- Cómo aplicar: Supabase → SQL Editor → pega este archivo → Run.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- Conceptos (capa de conocimiento)
-- ---------------------------------------------------------------------------
create table if not exists public.conceptos (
  user_id        uuid        not null default auth.uid() references auth.users (id) on delete cascade,
  -- id/slug usado por la app; único dentro de cada usuario.
  id             text        not null,
  datos          jsonb       not null,
  -- Columna de búsqueda derivada del documento (no se escribe a mano).
  nombre         text        generated always as (datos ->> 'nombre') stored,
  actualizado_en timestamptz not null default now(),
  primary key (user_id, id)
);

-- ---------------------------------------------------------------------------
-- Asignaturas / espacios de aprendizaje (capa curricular)
-- ---------------------------------------------------------------------------
create table if not exists public.asignaturas (
  user_id        uuid        not null default auth.uid() references auth.users (id) on delete cascade,
  id             text        not null,
  datos          jsonb       not null,
  nombre         text        generated always as (datos ->> 'nombre') stored,
  tipo           text        generated always as (coalesce(datos ->> 'tipo', 'docencia')) stored,
  actualizado_en timestamptz not null default now(),
  primary key (user_id, id)
);

-- ---------------------------------------------------------------------------
-- Tareas (capa transversal)
-- ---------------------------------------------------------------------------
create table if not exists public.tareas (
  user_id        uuid        not null default auth.uid() references auth.users (id) on delete cascade,
  id             text        not null,
  datos          jsonb       not null,
  titulo         text        generated always as (datos ->> 'titulo') stored,
  asignatura_id  text        generated always as (datos ->> 'asignaturaId') stored,
  actualizado_en timestamptz not null default now(),
  primary key (user_id, id)
);

-- Listar rápido las tareas de una asignatura del usuario.
create index if not exists tareas_por_asignatura
  on public.tareas (user_id, asignatura_id);

-- ---------------------------------------------------------------------------
-- Mantener `actualizado_en` al día en cada UPDATE
-- ---------------------------------------------------------------------------
create or replace function public.tocar_actualizado_en()
returns trigger
language plpgsql
as $$
begin
  new.actualizado_en = now();
  return new;
end;
$$;

drop trigger if exists conceptos_touch   on public.conceptos;
drop trigger if exists asignaturas_touch on public.asignaturas;
drop trigger if exists tareas_touch      on public.tareas;

create trigger conceptos_touch   before update on public.conceptos   for each row execute function public.tocar_actualizado_en();
create trigger asignaturas_touch before update on public.asignaturas for each row execute function public.tocar_actualizado_en();
create trigger tareas_touch      before update on public.tareas      for each row execute function public.tocar_actualizado_en();

-- ---------------------------------------------------------------------------
-- Row-Level Security: cada usuario, solo lo suyo
-- ---------------------------------------------------------------------------
alter table public.conceptos   enable row level security;
alter table public.asignaturas enable row level security;
alter table public.tareas      enable row level security;

drop policy if exists conceptos_propios   on public.conceptos;
drop policy if exists asignaturas_propias on public.asignaturas;
drop policy if exists tareas_propias      on public.tareas;

create policy conceptos_propios on public.conceptos
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy asignaturas_propias on public.asignaturas
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy tareas_propias on public.tareas
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- Los usuarios autenticados operan sobre estas tablas (RLS limita a sus filas).
grant select, insert, update, delete
  on public.conceptos, public.asignaturas, public.tareas
  to authenticated;
