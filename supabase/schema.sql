-- Esquema de Gestión Pérez.
-- Correr entero en Supabase → SQL Editor. Es idempotente: se puede repetir.

-- ---------------------------------------------------------------- perfiles
-- Un perfil por usuario de auth. El rol vive acá, no en el cliente, porque
-- las políticas de abajo lo consultan para decidir cada lectura y escritura.

do $$ begin
  create type rol_usuario as enum ('gerencia', 'vendedor', 'mecanico');
exception when duplicate_object then null; end $$;

create table if not exists perfiles (
  id          uuid primary key references auth.users on delete cascade,
  nombre      text not null default '',
  rol         rol_usuario not null default 'vendedor',
  activo      boolean not null default true,
  telefono    text,
  email       text,
  documento   text,
  imagen_url  text,
  creado_en   timestamptz not null default now()
);

alter table perfiles add column if not exists telefono text;
alter table perfiles add column if not exists email text;
alter table perfiles add column if not exists documento text;
alter table perfiles add column if not exists imagen_url text;

-- Alta automática del perfil cuando gerencia crea el usuario en Auth.
-- El rol se puede pasar como metadata al invitar; si no, entra como vendedor.
create or replace function public.crear_perfil()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into perfiles (id, nombre, rol, email, telefono, documento)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'nombre', split_part(new.email, '@', 1)),
    coalesce((new.raw_user_meta_data ->> 'rol')::rol_usuario, 'vendedor'),
    new.email,
    new.raw_user_meta_data ->> 'telefono',
    new.raw_user_meta_data ->> 'documento'
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

-- Saber quién recibió un vehículo o quién lo está reparando es dato de
-- trabajo; el teléfono y el documento de un compañero no. `perfiles` solo deja
-- ver el perfil propio, así que esta vista expone el nombre y nada más. Al no
-- ser security_invoker no arrastra esa política, por eso proyecta apenas tres
-- columnas: lo que no está acá no se puede leer desde el navegador.
create or replace view public.equipo with (security_invoker = off) as
  select id, nombre, rol, activo from perfiles;

revoke all on public.equipo from anon;
grant select on public.equipo to authenticated;

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
  categoria     text not null default 'Cubierta',
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

alter table productos add column if not exists categoria text not null default 'Cubierta';
create index if not exists productos_categoria_idx on productos (categoria);
create index if not exists productos_marca_idx on productos (marca);
create index if not exists productos_medida_idx on productos (medida);

-- ------------------------------------------------------------------ ventas

do $$ begin
  create type estado_venta as enum ('cotizacion', 'confirmada', 'anulada');
exception when duplicate_object then null; end $$;

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
  producto_id     uuid references productos on delete restrict,
  descripcion     text,
  cantidad        numeric(10,2) not null check (cantidad > 0),
  precio_unitario numeric(12,2) not null
);

create index if not exists venta_items_venta_idx on venta_items (venta_id);

-- Una venta nacida en el taller cobra mano de obra, que no es un producto del
-- stock. Por eso producto_id es opcional: si no hay producto, la línea se
-- identifica por su descripción, y `mover_stock` simplemente no la alcanza.
alter table venta_items add column if not exists descripcion text;
alter table venta_items alter column producto_id drop not null;
alter table venta_items alter column cantidad type numeric(10,2);

do $$ begin
  alter table venta_items add constraint venta_items_linea_identificada
    check (producto_id is not null or nullif(btrim(descripcion), '') is not null);
exception when duplicate_object then null; end $$;

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
    update productos p set stock = p.stock - i.cantidad::integer
      from venta_items i where i.venta_id = new.id and p.id = i.producto_id;
  elsif old.estado = 'confirmada' and new.estado is distinct from 'confirmada' then
    update productos p set stock = p.stock + i.cantidad::integer
      from venta_items i where i.venta_id = new.id and p.id = i.producto_id;
  end if;
  return new;
end $$;

drop trigger if exists trg_stock_venta on ventas;
create trigger trg_stock_venta
  after update of estado on ventas
  for each row execute function public.mover_stock();

-- ------------------------------------------------------------------ taller
-- Una orden atraviesa tres escritorios y el orden importa:
--
--   recepción      recibe el vehículo y toma los datos      → recepcion
--   administración arma el plan de trabajo con precios      → presupuestada
--   recepción      registra el OK del cliente               → aprobada
--   taller         ejecuta                                  → en_proceso → terminada
--   recepción      entrega y factura                        → entregada
--
-- Modelar las etapas como estados —y no como un campo libre— permite que la
-- base rechace los atajos: no se puede presupuestar sin plan, ni trabajar sin
-- aprobación, ni entregar sin haber terminado.

do $$ begin
  create type estado_orden as enum (
    'recepcion', 'presupuestada', 'aprobada', 'en_proceso', 'terminada', 'entregada'
  );
exception when duplicate_object then null; end $$;

-- Migración del enum viejo ('pendiente' era todo lo anterior a en_proceso).
-- Las órdenes que ya existían venían de un flujo sin presupuesto: entraron
-- aprobadas de hecho, así que ahí caen.
do $$ begin
  if exists (
    select 1 from pg_enum e join pg_type t on t.oid = e.enumtypid
    where t.typname = 'estado_orden' and e.enumlabel = 'pendiente'
  ) then
    create type estado_orden_nuevo as enum (
      'recepcion', 'presupuestada', 'aprobada', 'en_proceso', 'terminada', 'entregada'
    );
    alter table ordenes alter column estado drop default;
    alter table ordenes alter column estado type estado_orden_nuevo
      using (case estado::text when 'pendiente' then 'aprobada' else estado::text end)::estado_orden_nuevo;
    drop type estado_orden;
    alter type estado_orden_nuevo rename to estado_orden;
  end if;
end $$;

create table if not exists ordenes (
  id           uuid primary key default gen_random_uuid(),
  cliente_id   uuid references clientes on delete set null,
  mecanico_id  uuid references perfiles on delete set null,
  vehiculo     text not null,
  patente      text,
  estado       estado_orden not null default 'recepcion',
  notas        text,
  creada_en    timestamptz not null default now(),
  cerrada_en   timestamptz
);

-- Recepción: quién atendió y en qué condiciones entró el vehículo.
alter table ordenes add column if not exists recepcionista_id uuid references perfiles on delete set null;
alter table ordenes add column if not exists kilometraje integer;
alter table ordenes add column if not exists falla_reportada text;

-- Administración: el plan de trabajo y su precio.
alter table ordenes add column if not exists plan_notas text;
alter table ordenes add column if not exists planificada_por uuid references perfiles on delete set null;
alter table ordenes add column if not exists planificada_en timestamptz;
alter table ordenes add column if not exists total numeric(12,2) not null default 0;

-- Aprobación del cliente y sellos de tiempo de cada etapa.
alter table ordenes add column if not exists aprobada_en timestamptz;
alter table ordenes add column if not exists aprobada_por uuid references perfiles on delete set null;
alter table ordenes add column if not exists aprobacion_nota text;
alter table ordenes add column if not exists iniciada_en timestamptz;
alter table ordenes add column if not exists terminada_en timestamptz;
alter table ordenes add column if not exists venta_id uuid references ventas on delete set null;

alter table ordenes alter column estado set default 'recepcion';

create index if not exists ordenes_estado_idx on ordenes (estado, creada_en desc);
create index if not exists ordenes_mecanico_idx on ordenes (mecanico_id, estado);

-- ------------------------------------------------- plan de trabajo (ítems)
-- Cada renglón del plan es mano de obra o un repuesto del stock. El repuesto
-- apunta al producto para poder descontarlo al entregar; el servicio no, y por
-- eso admite cantidades fraccionadas (media hora de alineación).

do $$ begin
  create type tipo_item_orden as enum ('servicio', 'repuesto');
exception when duplicate_object then null; end $$;

create table if not exists orden_items (
  id              uuid primary key default gen_random_uuid(),
  orden_id        uuid not null references ordenes on delete cascade,
  tipo            tipo_item_orden not null,
  producto_id     uuid references productos on delete restrict,
  descripcion     text not null,
  cantidad        numeric(10,2) not null check (cantidad > 0),
  precio_unitario numeric(12,2) not null default 0,
  constraint orden_items_repuesto_con_producto check (
    (tipo = 'repuesto' and producto_id is not null and cantidad = trunc(cantidad))
    or (tipo = 'servicio' and producto_id is null)
  )
);

create index if not exists orden_items_orden_idx on orden_items (orden_id);

-- Igual que en ventas: el importe lo fija la base, no el navegador.
create or replace function public.recalcular_total_orden()
returns trigger language plpgsql security definer set search_path = public as $$
declare v_id uuid;
begin
  v_id := coalesce(new.orden_id, old.orden_id);
  update ordenes set total = (
    select coalesce(sum(cantidad * precio_unitario), 0) from orden_items where orden_id = v_id
  ) where id = v_id;
  return null;
end $$;

drop trigger if exists trg_total_orden on orden_items;
create trigger trg_total_orden
  after insert or update or delete on orden_items
  for each row execute function public.recalcular_total_orden();

-- Migra los servicios del esquema viejo (text[]) a renglones del plan, sin
-- precio: quedan a la vista para que administración los valorice.
do $$ begin
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'ordenes' and column_name = 'servicios'
  ) then
    insert into orden_items (orden_id, tipo, descripcion, cantidad, precio_unitario)
    select o.id, 'servicio', s, 1, 0
      from ordenes o, unnest(o.servicios) as s
     where not exists (select 1 from orden_items i where i.orden_id = o.id);
    alter table ordenes drop column servicios;
  end if;
end $$;

-- --------------------------------------------------- avance de las órdenes
-- El guardián del circuito. Cada transición dice desde dónde sale y quién
-- puede hacerla; lo que no está listado, no pasa. Los sellos de tiempo los
-- pone la base para que no dependan de que el cliente los mande.

create or replace function public.validar_avance_orden()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_rol   rol_usuario := public.mi_rol();
  v_items integer;
begin
  -- Un usuario sin perfil da rol NULL, y `NULL not in (...)` no es verdadero:
  -- sin este corte, cada control de abajo lo dejaría pasar de largo.
  if v_rol is null then
    raise exception 'Tu usuario no tiene perfil asignado.';
  end if;

  -- RLS decide filas, no columnas: sin esto un mecánico con acceso a la orden
  -- podría reescribir el importe aprobado desde la consola del navegador.
  if v_rol = 'mecanico' and (
       new.total           is distinct from old.total
    or new.cliente_id      is distinct from old.cliente_id
    or new.vehiculo        is distinct from old.vehiculo
    or new.patente         is distinct from old.patente
    or new.kilometraje     is distinct from old.kilometraje
    or new.falla_reportada is distinct from old.falla_reportada
    or new.plan_notas      is distinct from old.plan_notas
    or new.venta_id        is distinct from old.venta_id
    or new.aprobada_en     is distinct from old.aprobada_en
  ) then
    raise exception 'El taller solo cambia el estado, el mecánico asignado y las notas.';
  end if;

  if new.estado = old.estado then return new; end if;

  -- Una orden entregada es un comprobante: no se reabre ni se corrige.
  if old.estado = 'entregada' then
    raise exception 'La orden ya fue entregada y no admite cambios.';
  end if;

  if new.estado = 'presupuestada' and old.estado in ('recepcion', 'aprobada') then
    if v_rol <> 'gerencia' then
      raise exception 'Solo administración arma el plan de trabajo.';
    end if;
    select count(*) into v_items from orden_items where orden_id = new.id;
    if v_items = 0 then
      raise exception 'El plan de trabajo no puede estar vacío.';
    end if;
    new.planificada_por := auth.uid();
    new.planificada_en  := now();
    new.aprobada_en     := null;
    new.aprobada_por    := null;

  elsif new.estado = 'recepcion' and old.estado = 'presupuestada' then
    if v_rol not in ('gerencia', 'vendedor') then
      raise exception 'Solo recepción o administración devuelven una orden a recepción.';
    end if;

  elsif new.estado = 'aprobada' and old.estado = 'presupuestada' then
    if v_rol not in ('gerencia', 'vendedor') then
      raise exception 'Solo recepción o administración registran la aprobación del cliente.';
    end if;
    new.aprobada_por := auth.uid();
    new.aprobada_en  := now();

  elsif new.estado = 'en_proceso' and old.estado in ('aprobada', 'terminada') then
    if v_rol not in ('gerencia', 'mecanico') then
      raise exception 'Solo el taller inicia el trabajo.';
    end if;
    if new.mecanico_id is null then
      raise exception 'Asigná un mecánico antes de iniciar el trabajo.';
    end if;
    if new.iniciada_en is null then new.iniciada_en := now(); end if;
    new.terminada_en := null;

  elsif new.estado = 'terminada' and old.estado = 'en_proceso' then
    if v_rol not in ('gerencia', 'mecanico') then
      raise exception 'Solo el taller marca el trabajo como terminado.';
    end if;
    new.terminada_en := now();

  elsif new.estado = 'entregada' and old.estado = 'terminada' then
    if v_rol not in ('gerencia', 'vendedor') then
      raise exception 'Solo recepción o administración entregan el vehículo.';
    end if;
    new.cerrada_en := now();

  else
    raise exception 'No se puede pasar de % a %.', old.estado, new.estado;
  end if;

  return new;
end $$;

drop trigger if exists trg_avance_orden on ordenes;
create trigger trg_avance_orden
  before update on ordenes
  for each row execute function public.validar_avance_orden();

-- Entregar es un solo acto con tres efectos: cerrar la orden, facturarla y
-- descontar los repuestos. Va en una función para que ocurran juntos o no
-- ocurra ninguno; hacerlo en tres llamadas desde el navegador deja órdenes
-- entregadas sin venta cuando se corta la conexión a la mitad.
create or replace function public.entregar_orden(p_orden uuid)
returns uuid language plpgsql security definer set search_path = public as $$
declare
  v_orden  ordenes;
  v_venta  uuid;
begin
  -- La función es security definer: acá no hay RLS que ataje nada, así que el
  -- rol se comprueba explícitamente y un rol NULL no alcanza para pasar.
  if coalesce(public.mi_rol() in ('gerencia', 'vendedor'), false) is not true then
    raise exception 'Solo recepción o administración entregan el vehículo.';
  end if;

  select * into v_orden from ordenes where id = p_orden for update;
  if not found then
    raise exception 'La orden no existe.';
  end if;

  -- Reintento tras un corte: la orden ya se entregó, devolvemos su venta.
  if v_orden.venta_id is not null then return v_orden.venta_id; end if;

  if v_orden.estado <> 'terminada' then
    raise exception 'Solo se entrega una orden terminada.';
  end if;

  insert into ventas (cliente_id, vendedor_id, estado, notas)
  values (
    v_orden.cliente_id,
    auth.uid(),
    'cotizacion',
    'Orden de taller · ' || v_orden.vehiculo || coalesce(' · ' || v_orden.patente, '')
  )
  returning id into v_venta;

  insert into venta_items (venta_id, producto_id, descripcion, cantidad, precio_unitario)
  select v_venta, i.producto_id, i.descripcion, i.cantidad, i.precio_unitario
    from orden_items i where i.orden_id = p_orden;

  -- Confirmar dispara `mover_stock`, que descuenta solo los renglones con
  -- producto: la mano de obra pasa de largo.
  update ventas set estado = 'confirmada' where id = v_venta;

  update ordenes set estado = 'entregada', venta_id = v_venta where id = p_orden;

  return v_venta;
end $$;

revoke all on function public.entregar_orden(uuid) from public;
grant execute on function public.entregar_orden(uuid) to authenticated;

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
create policy productos_escribir on productos for select to authenticated using (true);

drop policy if exists productos_crear on productos;
create policy productos_crear on productos for insert to authenticated
  with check (public.es_gerencia());

drop policy if exists productos_actualizar on productos;
create policy productos_actualizar on productos for update to authenticated
  using (public.es_gerencia()) with check (public.es_gerencia());

drop policy if exists productos_borrar on productos;
create policy productos_borrar on productos for delete to authenticated
  using (public.es_gerencia());

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

-- Taller: la orden la ve todo el equipo, pero cada escritorio toca lo suyo.
-- Estas políticas deciden *quién* puede escribir la fila; el trigger
-- `validar_avance_orden` decide *hacia dónde* puede moverla.
alter table orden_items enable row level security;

drop policy if exists ordenes_leer on ordenes;
create policy ordenes_leer on ordenes for select to authenticated using (true);

-- Recepción abre la orden, y siempre en la primera etapa.
drop policy if exists ordenes_escribir on ordenes;
drop policy if exists ordenes_crear on ordenes;
create policy ordenes_crear on ordenes for insert to authenticated
  with check (public.mi_rol() in ('gerencia', 'vendedor') and estado = 'recepcion');

-- El mecánico solo alcanza las órdenes que ya llegaron al taller: mientras
-- están en recepción o presupuesto no puede ni tocarlas.
drop policy if exists ordenes_actualizar on ordenes;
create policy ordenes_actualizar on ordenes for update to authenticated
  using (
    public.mi_rol() in ('gerencia', 'vendedor')
    or (public.mi_rol() = 'mecanico' and estado in ('aprobada', 'en_proceso', 'terminada'))
  )
  with check (public.mi_rol() in ('gerencia', 'vendedor', 'mecanico'));

drop policy if exists ordenes_borrar on ordenes;
create policy ordenes_borrar on ordenes for delete to authenticated
  using (public.es_gerencia() and estado in ('recepcion', 'presupuestada'));

-- El plan lo arma administración, y solo antes de que el cliente lo apruebe:
-- después es el presupuesto aceptado y cambiarlo sería cobrar otra cosa.
drop policy if exists orden_items_leer on orden_items;
create policy orden_items_leer on orden_items for select to authenticated using (true);

drop policy if exists orden_items_escribir on orden_items;
create policy orden_items_escribir on orden_items for all to authenticated
  using (
    public.es_gerencia()
    and exists (
      select 1 from ordenes o
       where o.id = orden_id and o.estado in ('recepcion', 'presupuestada'))
  )
  with check (
    public.es_gerencia()
    and exists (
      select 1 from ordenes o
       where o.id = orden_id and o.estado in ('recepcion', 'presupuestada'))
  );

-- Fichadas: cada uno ficha lo propio y no puede editarlo después.
drop policy if exists fichadas_leer on fichadas;
create policy fichadas_leer on fichadas for select to authenticated
  using (perfil_id = auth.uid() or public.es_gerencia());

drop policy if exists fichadas_crear on fichadas;
create policy fichadas_crear on fichadas for insert to authenticated
  with check (perfil_id = auth.uid());
