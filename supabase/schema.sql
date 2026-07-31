-- Esquema de Gestión Pérez.
-- Correr entero en Supabase → SQL Editor. Es idempotente: se puede repetir.

-- ---------------------------------------------------------------- perfiles
-- Un perfil por usuario de auth. El rol vive acá, no en el cliente, porque
-- las políticas de abajo lo consultan para decidir cada lectura y escritura.

create type rol_usuario as enum ('gerencia', 'vendedor', 'mecanico');

create table if not exists perfiles (
  id          uuid primary key references auth.users on delete cascade,
  nombre      text not null default '',
  rol         rol_usuario not null default 'vendedor',
  activo      boolean not null default true,
  creado_en   timestamptz not null default now()
);

-- Alta automática del perfil cuando gerencia crea el usuario en Auth.
-- El rol se puede pasar como metadata al invitar; si no, entra como vendedor.
create or replace function public.crear_perfil()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into perfiles (id, nombre, rol)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'nombre', split_part(new.email, '@', 1)),
    coalesce((new.raw_user_meta_data ->> 'rol')::rol_usuario, 'vendedor')
  )
  on conflict (id) do nothing;
  return new;
end $$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.crear_perfil();

-- Leer el rol propio sin disparar las políticas de perfiles otra vez:
-- sin security definer, la política de perfiles se llamaría a sí misma.
create or replace function public.mi_rol()
returns rol_usuario language sql stable security definer set search_path = public as $$
  select rol from perfiles where id = auth.uid()
$$;

create or replace function public.es_gerencia()
returns boolean language sql stable security definer set search_path = public as $$
  select coalesce(public.mi_rol() = 'gerencia', false)
$$;

-- ---------------------------------------------------------------- catálogo

create table if not exists clientes (
  id          uuid primary key default gen_random_uuid(),
  nombre      text not null,
  telefono    text,
  email       text,
  documento   text,
  creado_en   timestamptz not null default now()
);

create table if not exists productos (
  id            uuid primary key default gen_random_uuid(),
  codigo        text unique,
  marca         text not null,
  medida        text not null,            -- 205/55 R16
  descripcion   text,
  imagen_url    text,
  precio        numeric(12,2) not null default 0,
  costo         numeric(12,2) not null default 0,
  stock         integer not null default 0,
  stock_minimo  integer not null default 4,
  activo        boolean not null default true,
  creado_en     timestamptz not null default now()
);

create index if not exists productos_marca_idx on productos (marca);
create index if not exists productos_medida_idx on productos (medida);

-- ------------------------------------------------------------------ ventas

create type estado_venta as enum ('cotizacion', 'confirmada', 'anulada');

create table if not exists ventas (
  id          uuid primary key default gen_random_uuid(),
  cliente_id  uuid references clientes on delete set null,
  vendedor_id uuid not null references perfiles on delete restrict,
  estado      estado_venta not null default 'cotizacion',
  total       numeric(12,2) not null default 0,
  notas       text,
  creada_en   timestamptz not null default now()
);

create index if not exists ventas_vendedor_idx on ventas (vendedor_id, creada_en desc);

create table if not exists venta_items (
  id              uuid primary key default gen_random_uuid(),
  venta_id        uuid not null references ventas on delete cascade,
  producto_id     uuid not null references productos on delete restrict,
  cantidad        integer not null check (cantidad > 0),
  precio_unitario numeric(12,2) not null
);

create index if not exists venta_items_venta_idx on venta_items (venta_id);

-- El total se recalcula en la base: si lo mandara el cliente, cualquiera
-- podría confirmar una venta con el importe que quisiera.
create or replace function public.recalcular_total()
returns trigger language plpgsql security definer set search_path = public as $$
declare v_id uuid;
begin
  v_id := coalesce(new.venta_id, old.venta_id);
  update ventas set total = (
    select coalesce(sum(cantidad * precio_unitario), 0) from venta_items where venta_id = v_id
  ) where id = v_id;
  return null;
end $$;

drop trigger if exists trg_total_venta on venta_items;
create trigger trg_total_venta
  after insert or update or delete on venta_items
  for each row execute function public.recalcular_total();

-- El stock se descuenta al confirmar y se repone al anular, no al cargar
-- los ítems: una cotización no debe mover inventario.
create or replace function public.mover_stock()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.estado = 'confirmada' and old.estado is distinct from 'confirmada' then
    update productos p set stock = p.stock - i.cantidad
      from venta_items i where i.venta_id = new.id and p.id = i.producto_id;
  elsif old.estado = 'confirmada' and new.estado is distinct from 'confirmada' then
    update productos p set stock = p.stock + i.cantidad
      from venta_items i where i.venta_id = new.id and p.id = i.producto_id;
  end if;
  return new;
end $$;

drop trigger if exists trg_stock_venta on ventas;
create trigger trg_stock_venta
  after update of estado on ventas
  for each row execute function public.mover_stock();

-- ------------------------------------------------------------------ taller

create type estado_orden as enum ('pendiente', 'en_proceso', 'terminada', 'entregada');

create table if not exists ordenes (
  id           uuid primary key default gen_random_uuid(),
  cliente_id   uuid references clientes on delete set null,
  mecanico_id  uuid references perfiles on delete set null,
  vehiculo     text not null,
  patente      text,
  servicios    text[] not null default '{}',
  estado       estado_orden not null default 'pendiente',
  notas        text,
  creada_en    timestamptz not null default now(),
  cerrada_en   timestamptz
);

create index if not exists ordenes_estado_idx on ordenes (estado, creada_en desc);

-- ---------------------------------------------------------------- personal

create type tipo_fichada as enum ('ingreso', 'egreso');

create table if not exists fichadas (
  id        uuid primary key default gen_random_uuid(),
  perfil_id uuid not null references perfiles on delete cascade,
  tipo      tipo_fichada not null,
  momento   timestamptz not null default now()
);

create index if not exists fichadas_perfil_idx on fichadas (perfil_id, momento desc);

-- ------------------------------------------------------- políticas de RLS
-- Sin RLS, la clave anon del navegador puede leer toda la tabla. Todo lo de
-- abajo asume que el cliente es hostil y decide en el servidor.

alter table perfiles     enable row level security;
alter table clientes     enable row level security;
alter table productos    enable row level security;
alter table ventas       enable row level security;
alter table venta_items  enable row level security;
alter table ordenes      enable row level security;
alter table fichadas     enable row level security;

drop policy if exists perfiles_leer on perfiles;
create policy perfiles_leer on perfiles for select to authenticated
  using (id = auth.uid() or public.es_gerencia());

drop policy if exists perfiles_editar on perfiles;
create policy perfiles_editar on perfiles for update to authenticated
  using (public.es_gerencia()) with check (public.es_gerencia());

-- Catálogo: lo ve todo el equipo; lo toca gerencia (y el vendedor, clientes).
drop policy if exists clientes_leer on clientes;
create policy clientes_leer on clientes for select to authenticated using (true);

drop policy if exists clientes_escribir on clientes;
create policy clientes_escribir on clientes for all to authenticated
  using (public.mi_rol() in ('gerencia', 'vendedor'))
  with check (public.mi_rol() in ('gerencia', 'vendedor'));

drop policy if exists productos_leer on productos;
create policy productos_leer on productos for select to authenticated using (true);

drop policy if exists productos_escribir on productos;
create policy productos_escribir on productos for all to authenticated
  using (public.es_gerencia()) with check (public.es_gerencia());

-- Ventas: el vendedor ve y carga las suyas; gerencia ve todo.
drop policy if exists ventas_leer on ventas;
create policy ventas_leer on ventas for select to authenticated
  using (vendedor_id = auth.uid() or public.es_gerencia());

drop policy if exists ventas_crear on ventas;
create policy ventas_crear on ventas for insert to authenticated
  with check (
    (public.mi_rol() = 'gerencia' and vendedor_id is not null)
    or (public.mi_rol() = 'vendedor' and vendedor_id = auth.uid())
  );

drop policy if exists ventas_actualizar on ventas;
create policy ventas_actualizar on ventas for update to authenticated
  using (vendedor_id = auth.uid() or public.es_gerencia())
  with check (vendedor_id = auth.uid() or public.es_gerencia());

drop policy if exists venta_items_todo on venta_items;
create policy venta_items_todo on venta_items for all to authenticated
  using (exists (
    select 1 from ventas v where v.id = venta_id
      and (v.vendedor_id = auth.uid() or public.es_gerencia())))
  with check (exists (
    select 1 from ventas v where v.id = venta_id
      and (v.vendedor_id = auth.uid() or public.es_gerencia())));

-- Taller: lo ve todo el equipo (el vendedor necesita saber si está listo),
-- lo cargan mecánicos y gerencia.
drop policy if exists ordenes_leer on ordenes;
create policy ordenes_leer on ordenes for select to authenticated using (true);

drop policy if exists ordenes_escribir on ordenes;
create policy ordenes_escribir on ordenes for all to authenticated
  using (public.mi_rol() in ('gerencia', 'mecanico'))
  with check (public.mi_rol() in ('gerencia', 'mecanico'));

-- Fichadas: cada uno ficha lo propio y no puede editarlo después.
drop policy if exists fichadas_leer on fichadas;
create policy fichadas_leer on fichadas for select to authenticated
  using (perfil_id = auth.uid() or public.es_gerencia());

drop policy if exists fichadas_crear on fichadas;
create policy fichadas_crear on fichadas for insert to authenticated
  with check (perfil_id = auth.uid());
