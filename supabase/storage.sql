-- Buckets de Storage para las fotos de empleados, de artículos y de los
-- vehículos que entran al taller.
-- Correr en Supabase → SQL Editor. Es idempotente: se puede repetir.
-- Sin esto, la app tira "Bucket not found" al subir una foto.

insert into storage.buckets (id, name, public)
values ('empleados', 'empleados', true),
       ('productos', 'productos', true),
       ('vehiculos', 'vehiculos', true)
on conflict (id) do update set public = excluded.public;

-- Públicos para lectura: las fotos se muestran con getPublicUrl, sin firmar.
-- No pongas nada sensible acá; la URL la puede abrir cualquiera que la tenga.
drop policy if exists storage_leer_publico on storage.objects;
create policy storage_leer_publico on storage.objects for select to public
  using (bucket_id in ('empleados', 'productos', 'vehiculos'));

-- Escribir solo con sesión: el visitante anónimo no sube archivos.
drop policy if exists storage_subir on storage.objects;
create policy storage_subir on storage.objects for insert to authenticated
  with check (bucket_id in ('empleados', 'productos', 'vehiculos'));

drop policy if exists storage_actualizar on storage.objects;
create policy storage_actualizar on storage.objects for update to authenticated
  using (bucket_id in ('empleados', 'productos', 'vehiculos'))
  with check (bucket_id in ('empleados', 'productos', 'vehiculos'));

drop policy if exists storage_borrar on storage.objects;
create policy storage_borrar on storage.objects for delete to authenticated
  using (bucket_id in ('empleados', 'productos', 'vehiculos'));

-- Verificación. Tienen que salir los 3 buckets en public=true y 4 políticas.
-- Crear el bucket desde el panel NO crea las políticas: sin ellas, subir un
-- archivo falla con "new row violates row-level security policy".
select id, public from storage.buckets where id in ('empleados', 'productos', 'vehiculos');
select policyname, cmd from pg_policies
where schemaname = 'storage' and tablename = 'objects'
  and policyname like 'storage_%'
order by policyname;
