# Nube de PedagoGraph (Supabase)

Aquí vive el esquema de la base de datos en la nube. **Solo se guarda la
estructura** (conceptos, asignaturas, tareas); los **archivos de material siguen
siendo locales** — en la nube va únicamente su metadato dentro del JSON.

## Aplicar el esquema

1. Entra a tu proyecto en [app.supabase.com](https://app.supabase.com).
2. Menú **SQL Editor → New query**.
3. Pega el contenido de [`migrations/0001_esquema_pedagograph.sql`](./migrations/0001_esquema_pedagograph.sql) y pulsa **Run**.
4. Deberías ver "Success. No rows returned".

Puedes volver a ejecutarlo sin miedo: es idempotente (`create ... if not exists`,
`drop policy if exists`).

## Verificar

En **Table Editor** deben aparecer las tablas `conceptos`, `asignaturas` y
`tareas`, cada una con RLS activado (candado verde). Una comprobación rápida en
el SQL Editor:

```sql
-- Inserta un concepto de prueba a nombre del usuario actual (RLS pone user_id).
insert into public.conceptos (id, datos)
values ('prueba', '{"id":"prueba","nombre":"Divide y vencerás"}');

select id, nombre, user_id from public.conceptos;   -- debe salir solo el tuyo
delete from public.conceptos where id = 'prueba';    -- limpieza
```

> Nota: en el SQL Editor `auth.uid()` puede ser null (no hay sesión de usuario).
> La comprobación real de RLS se hace desde la app ya autenticada (Fase C).

## Diseño

- **Una tabla por agregado**: `conceptos`, `asignaturas`, `tareas`. Cada fila
  guarda el documento completo en `datos jsonb`, con la misma forma que el YAML
  del vault local → sincronizar es leer/escribir el agregado entero.
- **Clave**: `(user_id, id)`. El `id` es el mismo slug que usa la app, único por
  usuario. `user_id` se rellena solo con `auth.uid()`.
- **Columnas derivadas** (`nombre`, `tipo`, `titulo`, `asignatura_id`): generadas
  desde el JSON, para búsquedas y listados sin desnormalizar a mano.
- **RLS**: política `auth.uid() = user_id` en las tres tablas → cada quien ve
  solo lo suyo. Base del modelo multiusuario/de pago.

## Siguiente (Fase C)

Conectar la app: al iniciar sesión, leer/escribir estos agregados en la nube en
vez del vault local; el índice local (SQLite) se reconstruye desde la nube igual
que hoy desde los YAML.
