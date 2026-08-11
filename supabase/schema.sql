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

-- Cómo está inscripto alguien ante ARCA. Decide qué comprobante se le emite:
-- a un Responsable Inscripto va Factura A con el IVA discriminado, al resto
-- Factura B con el IVA adentro del precio. Los códigos que espera ARCA no
-- están acá sino en src/lib/fiscal.js, que es quien arma el comprobante.
do $$ begin
  create type condicion_iva as enum (
    'responsable_inscripto', 'monotributo', 'exento', 'consumidor_final'
  );
exception when duplicate_object then null; end $$;

create table if not exists clientes (
  id          uuid primary key default gen_random_uuid(),
  nombre      text not null,
  telefono    text,
  email       text,
  documento   text,
  creado_en   timestamptz not null default now()
);

-- Datos que solo hacen falta para facturar. Van opcionales porque el mostrador
-- carga al cliente con el auto delante y el apuro es la orden, no el CUIT:
-- administración los completa después, antes de emitir.
alter table clientes add column if not exists cuit          text;
alter table clientes add column if not exists domicilio     text;
alter table clientes add column if not exists condicion_iva condicion_iva not null default 'consumidor_final';

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

-- `create table if not exists` no toca una tabla que ya existe, así que las
-- columnas que se sumaron después del primer despliegue hay que agregarlas
-- explícitamente. Sin esto, una base creada con el esquema viejo hace fallar
-- la pantalla de Stock con "could not find the column in the schema cache".
alter table productos add column if not exists categoria    text not null default 'Cubierta';
alter table productos add column if not exists codigo       text;
alter table productos add column if not exists descripcion  text;
alter table productos add column if not exists imagen_url   text;
alter table productos add column if not exists costo        numeric(12,2) not null default 0;
alter table productos add column if not exists stock_minimo integer not null default 4;
alter table productos add column if not exists activo       boolean not null default true;

do $$ begin
  alter table productos add constraint productos_codigo_key unique (codigo);
exception when duplicate_table or duplicate_object then null; end $$;

alter table clientes add column if not exists telefono  text;
alter table clientes add column if not exists email     text;
alter table clientes add column if not exists documento text;
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

-- ------------------------------------------------------------ facturación
-- La venta y el comprobante no son lo mismo, y por eso son dos tablas.
--
--   la venta        es el movimiento interno: mueve stock, entra en las
--                   estadísticas, la cierra el mostrador
--   el comprobante  es el papel que se lleva el cliente: lo numera ARCA, lo
--                   emite administración, y puede salir un rato después
--
-- Mezclarlos obligaría a que quien entrega el vehículo tenga a mano el CUIT y
-- el CAE, y eso frena el mostrador. Así, entregar deja el comprobante armado
-- y pendiente, y administración lo emite cuando puede.
--
-- Hoy el CAE se carga a mano desde el portal de ARCA. Cuando esté el
-- certificado digital, el servicio va a completar exactamente los mismos tres
-- campos —numero, cae, cae_vencimiento— y nada más de este archivo cambia.

do $$ begin
  create type tipo_comprobante as enum ('factura_a', 'factura_b');
exception when duplicate_object then null; end $$;

do $$ begin
  create type estado_comprobante as enum ('pendiente', 'emitido', 'anulado');
exception when duplicate_object then null; end $$;

-- Los datos del emisor, que van impresos en cada comprobante. Es una fila
-- sola: el `check (id)` sobre un booleano no deja insertar una segunda.
create table if not exists empresa (
  id                 boolean primary key default true check (id),
  razon_social       text not null default '',
  cuit               text not null default '',
  condicion_iva      condicion_iva not null default 'responsable_inscripto',
  domicilio          text not null default '',
  ingresos_brutos    text,
  inicio_actividades date,
  -- El punto de venta lo da ARCA al habilitar la facturación electrónica.
  punto_venta        integer not null default 1 check (punto_venta between 1 and 99999)
);

insert into empresa (id) values (true) on conflict (id) do nothing;

create table if not exists comprobantes (
  id           uuid primary key default gen_random_uuid(),
  -- Una venta se factura una sola vez: el unique es lo que hace que reintentar
  -- `facturar_venta` tras un corte no emita el comprobante dos veces.
  venta_id     uuid unique references ventas on delete set null,
  tipo         tipo_comprobante not null,
  estado       estado_comprobante not null default 'pendiente',
  fecha        date not null default current_date,

  punto_venta  integer not null,
  -- La numeración la manda ARCA, no nosotros: por eso `numero` viaja vacío
  -- hasta la emisión y se carga con el que ARCA devolvió.
  numero       bigint check (numero > 0),

  -- Foto del cliente al momento de facturar. Es a propósito que estén
  -- duplicados: si mañana el cliente corrige su CUIT, el comprobante que ya
  -- salió tiene que seguir diciendo lo que decía el papel que se llevó.
  cliente_id        uuid references clientes on delete set null,
  cliente_nombre    text not null,
  cliente_cuit      text,
  cliente_condicion condicion_iva not null,
  cliente_domicilio text,

  neto   numeric(12,2) not null default 0,
  iva    numeric(12,2) not null default 0,
  total  numeric(12,2) not null default 0,

  cae             text,
  cae_vencimiento date,

  emitido_en       timestamptz,
  emitido_por      uuid references perfiles on delete set null,
  anulado_en       timestamptz,
  motivo_anulacion text,
  creado_en        timestamptz not null default now(),

  -- Un comprobante emitido sin CAE no existe para ARCA; que la base lo rechace
  -- evita que quede en la lista como si estuviera hecho.
  constraint comprobantes_emitido_completo check (
    estado <> 'emitido'
    or (numero is not null and nullif(btrim(coalesce(cae, '')), '') is not null
        and cae_vencimiento is not null)
  ),
  -- Sin CUIT no se puede emitir una A. Se controla acá y no solo en la
  -- pantalla porque es el error que después obliga a una nota de crédito.
  constraint comprobantes_factura_a_con_cuit check (
    tipo <> 'factura_a' or nullif(btrim(coalesce(cliente_cuit, '')), '') is not null
  ),
  constraint comprobantes_anulado_con_motivo check (
    estado <> 'anulado' or nullif(btrim(coalesce(motivo_anulacion, '')), '') is not null
  )
);

-- Dos comprobantes del mismo tipo no pueden compartir número en un punto de
-- venta. Es parcial porque los pendientes todavía no tienen número, y de esos
-- puede haber muchos a la vez.
create unique index if not exists comprobantes_numeracion_idx
  on comprobantes (tipo, punto_venta, numero) where numero is not null;

create index if not exists comprobantes_estado_idx on comprobantes (estado, creado_en desc);

-- Los renglones del comprobante son otra foto: copian lo vendido en vez de
-- apuntar al producto, porque el precio y hasta la descripción de un artículo
-- cambian, y una factura impresa no.
--
-- `precio_unitario` es el precio final, con IVA adentro: es el que se cotiza
-- en el mostrador y el que el cliente espera ver. El neto y el IVA se derivan
-- de ahí, y se calculan en la base para que la pantalla no pueda equivocarse.
create table if not exists comprobante_items (
  id              uuid primary key default gen_random_uuid(),
  comprobante_id  uuid not null references comprobantes on delete cascade,
  descripcion     text not null,
  cantidad        numeric(10,2) not null check (cantidad > 0),
  precio_unitario numeric(12,2) not null,
  alicuota        numeric(4,2) not null default 21,

  importe numeric(12,2) generated always as (round(cantidad * precio_unitario, 2)) stored,
  neto    numeric(12,2) generated always as (
    round(cantidad * precio_unitario / (1 + alicuota / 100), 2)
  ) stored,
  -- El IVA se escribe restando en vez de con su propia fórmula: así
  -- neto + iva da exactamente el importe y no queda un centavo colgado del
  -- redondeo, que es lo que ARCA rechaza.
  iva numeric(12,2) generated always as (
    round(cantidad * precio_unitario, 2)
    - round(cantidad * precio_unitario / (1 + alicuota / 100), 2)
  ) stored
);

create index if not exists comprobante_items_comprobante_idx
  on comprobante_items (comprobante_id);

-- El guardián del comprobante, hermano del de las órdenes: acá se decide qué
-- transición vale y qué queda congelado.
create or replace function public.proteger_comprobante()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_neto  numeric(12,2);
  v_iva   numeric(12,2);
  v_total numeric(12,2);
begin
  -- Un comprobante emitido es el respaldo de un CAE que ARCA ya otorgó. No se
  -- corrige ni se borra: si está mal, se emite una nota de crédito.
  if old.estado = 'emitido' then
    raise exception 'El comprobante ya fue emitido y no admite cambios.';
  end if;
  if old.estado = 'anulado' then
    raise exception 'El comprobante está anulado y no admite cambios.';
  end if;

  -- Los importes salen de los renglones. Se comparan contra la suma en vez de
  -- prohibirse de plano porque `facturar_venta` los escribe justo después de
  -- cargar los ítems; cualquier otro valor no pasa.
  if new.neto is distinct from old.neto
     or new.iva is distinct from old.iva
     or new.total is distinct from old.total then
    select coalesce(sum(neto), 0), coalesce(sum(iva), 0), coalesce(sum(importe), 0)
      into v_neto, v_iva, v_total
      from comprobante_items where comprobante_id = new.id;

    if (new.neto, new.iva, new.total) is distinct from (v_neto, v_iva, v_total) then
      raise exception 'Los importes del comprobante salen de sus renglones.';
    end if;
  end if;

  if new.estado = old.estado then return new; end if;

  if new.estado = 'emitido' then
    -- Las tres cosas que hoy se copian del portal de ARCA y mañana va a traer
    -- el web service. Sin ellas el comprobante no está emitido, está escrito.
    if new.numero is null then
      raise exception 'Cargá el número que devolvió ARCA.';
    end if;
    if nullif(btrim(coalesce(new.cae, '')), '') is null then
      raise exception 'Cargá el CAE.';
    end if;
    if new.cae_vencimiento is null then
      raise exception 'Cargá el vencimiento del CAE.';
    end if;
    new.emitido_en  := now();
    new.emitido_por := auth.uid();

  elsif new.estado = 'anulado' then
    new.anulado_en := now();

  else
    raise exception 'No se puede pasar de % a %.', old.estado, new.estado;
  end if;

  return new;
end $$;

drop trigger if exists trg_comprobante on comprobantes;
create trigger trg_comprobante
  before update on comprobantes
  for each row execute function public.proteger_comprobante();

-- Arma el comprobante de una venta y lo deja pendiente de CAE. La llama
-- `entregar_orden` al cerrar un trabajo de taller, y también Ventas para lo
-- que se vende por mostrador.
create or replace function public.facturar_venta(p_venta uuid)
returns uuid language plpgsql security definer set search_path = public as $$
declare
  v_venta        ventas;
  v_cliente      clientes;
  v_empresa      empresa;
  v_comprobante  uuid;
  v_tipo         tipo_comprobante;
begin
  if coalesce(public.mi_rol() in ('gerencia', 'vendedor'), false) is not true then
    raise exception 'Solo administración factura.';
  end if;

  select * into v_venta from ventas where id = p_venta for update;
  if not found then
    raise exception 'La venta no existe.';
  end if;

  -- Reintento tras un corte: ya estaba facturada, devolvemos el comprobante.
  select id into v_comprobante from comprobantes where venta_id = p_venta;
  if found then return v_comprobante; end if;

  if v_venta.estado <> 'confirmada' then
    raise exception 'Solo se factura una venta confirmada.';
  end if;

  select * into v_empresa from empresa where id;
  select * into v_cliente from clientes where id = v_venta.cliente_id;

  -- La A necesita CUIT sí o sí. Si el cliente es Responsable Inscripto pero
  -- todavía no lo tiene cargado, sale como B y administración la corrige
  -- antes de emitir: frenar acá dejaría el vehículo sin poder entregarse.
  v_tipo := case
    when v_cliente.condicion_iva = 'responsable_inscripto'
     and nullif(btrim(coalesce(v_cliente.cuit, '')), '') is not null
    then 'factura_a'::tipo_comprobante
    else 'factura_b'::tipo_comprobante
  end;

  insert into comprobantes (
    venta_id, tipo, punto_venta,
    cliente_id, cliente_nombre, cliente_cuit, cliente_condicion, cliente_domicilio
  ) values (
    p_venta, v_tipo, coalesce(v_empresa.punto_venta, 1),
    v_venta.cliente_id,
    coalesce(nullif(btrim(v_cliente.nombre), ''), 'Consumidor final'),
    nullif(btrim(coalesce(v_cliente.cuit, v_cliente.documento, '')), ''),
    coalesce(v_cliente.condicion_iva, 'consumidor_final'),
    nullif(btrim(coalesce(v_cliente.domicilio, '')), '')
  )
  returning id into v_comprobante;

  -- La línea de una venta puede no tener descripción propia (cuando es un
  -- producto del stock) o no tener producto (cuando es mano de obra). El
  -- comprobante necesita un texto siempre, así que se resuelve acá.
  insert into comprobante_items (comprobante_id, descripcion, cantidad, precio_unitario)
  select
    v_comprobante,
    coalesce(
      nullif(btrim(coalesce(i.descripcion, '')), ''),
      nullif(btrim(p.marca || ' ' || p.medida), ''),
      'Artículo'
    ),
    i.cantidad,
    i.precio_unitario
  from venta_items i
  left join productos p on p.id = i.producto_id
  where i.venta_id = p_venta;

  update comprobantes c set
    neto  = t.neto,
    iva   = t.iva,
    total = t.total
  from (
    select coalesce(sum(neto), 0) as neto,
           coalesce(sum(iva), 0) as iva,
           coalesce(sum(importe), 0) as total
      from comprobante_items where comprobante_id = v_comprobante
  ) t
  where c.id = v_comprobante;

  return v_comprobante;
end $$;

revoke all on function public.facturar_venta(uuid) from public;
grant execute on function public.facturar_venta(uuid) to authenticated;

-- ------------------------------------------------------------------ taller
-- El cliente llega al mostrador, recepción le toma los datos y arma la orden
-- con lo que pide. La orden pasa derecho al taller, que la toma, la trabaja y
-- la termina. Recepción entrega y cobra.
--
--   recepción  registra al cliente y crea la orden   → pendiente
--   taller     la toma y la trabaja                  → en_proceso → terminada
--   recepción  entrega y factura                     → entregada
--
-- Modelar las etapas como estados —y no como un campo libre— permite que la
-- base rechace los atajos: no se arranca sin mecánico asignado, no se entrega
-- sin haber terminado y una orden entregada no se reabre.
--
-- El plan de trabajo (`orden_items`) es aparte y opcional: se carga cuando se
-- sabe qué lleva, antes o durante el trabajo, y es lo que se factura al
-- entregar. No frena el paso al taller.

do $$ begin
  create type estado_orden as enum ('pendiente', 'en_proceso', 'terminada', 'entregada');
exception when duplicate_object then null; end $$;

-- Si la base quedó con el circuito de presupuesto y aprobación, esas etapas
-- vuelven a 'pendiente': eran trabajo que todavía esperaba al taller.
do $$ begin
  if to_regclass('public.ordenes') is not null and exists (
    select 1 from pg_enum e join pg_type t on t.oid = e.enumtypid
    where t.typname = 'estado_orden'
      and e.enumlabel in ('recepcion', 'presupuestada', 'aprobada')
  ) then
    /* Postgres no deja cambiarle el tipo a una columna de la que dependa una
       política, y estas la nombran. Se sueltan acá y el final del archivo las
       vuelve a crear con las etapas nuevas. */
    drop policy if exists ordenes_crear      on ordenes;
    drop policy if exists ordenes_actualizar on ordenes;
    drop policy if exists ordenes_borrar     on ordenes;
    drop policy if exists ordenes_escribir   on ordenes;
    if to_regclass('public.orden_items') is not null then
      drop policy if exists orden_items_escribir on orden_items;
    end if;

    create type estado_orden_nuevo as enum ('pendiente', 'en_proceso', 'terminada', 'entregada');
    alter table ordenes alter column estado drop default;
    alter table ordenes alter column estado type estado_orden_nuevo
      using (case estado::text
               when 'recepcion'     then 'pendiente'
               when 'presupuestada' then 'pendiente'
               when 'aprobada'      then 'pendiente'
               else estado::text
             end)::estado_orden_nuevo;
    drop type estado_orden;
    alter type estado_orden_nuevo rename to estado_orden;
  end if;
end $$;

-- ---------------------------------------------------------------- vehículos
-- El auto como cosa propia del cliente, y no como un texto suelto adentro de
-- cada orden. Es lo que hace posible que la ficha del cliente muestre "sus
-- autos", que el historial de un vehículo cruce varias visitas y que la
-- patente se tipee una vez sola y no en cada ingreso.
create table if not exists vehiculos (
  id         uuid primary key default gen_random_uuid(),
  cliente_id uuid not null references clientes on delete cascade,
  marca      text not null,
  modelo     text,
  anio       integer,
  patente    text,
  color      text,
  notas      text,
  creado_en  timestamptz not null default now()
);

-- La patente identifica al auto en todo el país, así que no puede repetirse:
-- si aparece dos veces es que alguien la cargó mal o el auto cambió de dueño,
-- y las dos cosas se resuelven mirando, no duplicando. Se compara en
-- mayúsculas porque en el mostrador se tipea de las dos formas, y solo cuando
-- hay patente cargada: un auto sin chapa todavía es un caso real.
create unique index if not exists vehiculos_patente_idx
  on vehiculos (upper(patente)) where patente is not null;

create index if not exists vehiculos_cliente_idx on vehiculos (cliente_id, marca);

create table if not exists ordenes (
  id           uuid primary key default gen_random_uuid(),
  cliente_id   uuid references clientes on delete set null,
  mecanico_id  uuid references perfiles on delete set null,
  vehiculo     text not null,
  patente      text,
  estado       estado_orden not null default 'pendiente',
  notas        text,
  creada_en    timestamptz not null default now(),
  cerrada_en   timestamptz
);

-- Recepción: quién atendió y en qué condiciones entró el vehículo.
alter table ordenes add column if not exists recepcionista_id uuid references perfiles on delete set null;
alter table ordenes add column if not exists kilometraje integer;
alter table ordenes add column if not exists falla_reportada text;

-- El plan de trabajo y lo que suma, que es lo que se factura al entregar.
alter table ordenes add column if not exists plan_notas text;
alter table ordenes add column if not exists total numeric(12,2) not null default 0;

-- Sellos de tiempo de cada etapa y la venta que dejó la entrega.
alter table ordenes add column if not exists iniciada_en timestamptz;
alter table ordenes add column if not exists terminada_en timestamptz;
alter table ordenes add column if not exists venta_id uuid references ventas on delete set null;

-- Restos del circuito con aprobación, que quedó sin usarse.
alter table ordenes drop column if exists planificada_por;
alter table ordenes drop column if exists planificada_en;
alter table ordenes drop column if exists aprobada_en;
alter table ordenes drop column if exists aprobada_por;
alter table ordenes drop column if exists aprobacion_nota;

alter table ordenes alter column estado set default 'pendiente';

-- El vehículo de la orden. `vehiculo` y `patente` siguen siendo texto y no se
-- borran a propósito: son la foto de cómo entró el auto ese día. Si mañana se
-- corrige la patente en la ficha, la orden vieja tiene que seguir diciendo lo
-- que decía el papel que firmó el cliente.
alter table ordenes add column if not exists vehiculo_id uuid references vehiculos on delete set null;
create index if not exists ordenes_vehiculo_idx on ordenes (vehiculo_id, creada_en desc);

-- Rescata los autos que hoy viven como texto adentro de las órdenes ya
-- cargadas. Sin esto la ficha del cliente arrancaría vacía aunque el taller
-- lleve meses atendiéndolo, y habría que recargar todo a mano.
do $$ begin
  insert into vehiculos (cliente_id, marca, patente)
  select distinct on (o.cliente_id, upper(coalesce(nullif(trim(o.patente), ''), o.vehiculo)))
         o.cliente_id,
         o.vehiculo,
         nullif(upper(trim(o.patente)), '')
    from ordenes o
   where o.cliente_id is not null
     and o.vehiculo_id is null
   order by o.cliente_id,
            upper(coalesce(nullif(trim(o.patente), ''), o.vehiculo)),
            o.creada_en
  on conflict do nothing;

  -- Por patente cuando la hay, que es la identificación de verdad; por el
  -- texto del vehículo cuando la orden entró sin chapa.
  update ordenes o set vehiculo_id = v.id
    from vehiculos v
   where o.vehiculo_id is null
     and v.cliente_id = o.cliente_id
     and (
       (nullif(trim(o.patente), '') is not null and upper(trim(o.patente)) = upper(v.patente))
       or (nullif(trim(o.patente), '') is null and v.patente is null and v.marca = o.vehiculo)
     );
end $$;

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

-- ------------------------------------------------- fotos del vehículo
-- El registro visual del auto. Cuelgan de la orden y no del cliente porque lo
-- que queda documentado es *este* ingreso: el mismo auto vuelve a los seis
-- meses con otro rayón, y las dos tandas tienen que convivir sin pisarse. La
-- ficha del cliente las muestra igual, recorriendo sus órdenes.
do $$ begin
  create type momento_foto as enum ('ingreso', 'trabajo', 'entrega');
exception when duplicate_object then null; end $$;

create table if not exists orden_fotos (
  id         uuid primary key default gen_random_uuid(),
  orden_id   uuid not null references ordenes on delete cascade,
  momento    momento_foto not null default 'ingreso',
  -- La ruta dentro del bucket, no la URL. La URL pública se arma al vuelo con
  -- getPublicUrl; guardarla congelaría un enlace que deja de servir el día que
  -- el bucket pase a privado y las fotos haya que firmarlas.
  ruta       text not null unique,
  nota       text,
  subida_por uuid references perfiles on delete set null,
  creada_en  timestamptz not null default now()
);

create index if not exists orden_fotos_orden_idx on orden_fotos (orden_id, momento);

-- --------------------------------------------------- avance de las órdenes
-- El guardián del circuito. Cada transición dice desde dónde sale y quién
-- puede hacerla; lo que no está listado, no pasa. Los sellos de tiempo los
-- pone la base para que no dependan de que el cliente los mande.

create or replace function public.validar_avance_orden()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_rol rol_usuario := public.mi_rol();
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
  ) then
    raise exception 'El taller solo cambia el estado, el mecánico asignado y las notas.';
  end if;

  if new.estado = old.estado then return new; end if;

  -- Una orden entregada es un comprobante: no se reabre ni se corrige.
  if old.estado = 'entregada' then
    raise exception 'La orden ya fue entregada y no admite cambios.';
  end if;

  if new.estado = 'en_proceso' and old.estado in ('pendiente', 'terminada') then
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

  -- Devolver a la cola: el taller la tomó por error o quedó a la espera de un
  -- repuesto y conviene que otro la pueda agarrar.
  elsif new.estado = 'pendiente' and old.estado = 'en_proceso' then
    if v_rol not in ('gerencia', 'mecanico') then
      raise exception 'Solo el taller devuelve una orden a la cola.';
    end if;
    new.iniciada_en := null;

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

-- Entregar es un solo acto con cuatro efectos: cerrar la orden, registrar la
-- venta, descontar los repuestos y dejar el comprobante armado para que
-- administración lo emita. Va en una función para que ocurran juntos o no
-- ocurra ninguno; hacerlo en cuatro llamadas desde el navegador deja órdenes
-- entregadas sin venta cuando se corta la conexión a la mitad.
--
-- Lo que no hace es pedir el CAE: eso es un ida y vuelta con ARCA que puede
-- tardar o fallar, y el cliente no se puede quedar esperando el auto por eso.
-- El comprobante queda pendiente y se emite desde Facturación.
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

  -- El plan es opcional: una orden sin renglones no tiene qué facturar, y
  -- una venta de cero ensuciaría Ventas y las estadísticas.
  if not exists (select 1 from orden_items where orden_id = p_orden) then
    update ordenes set estado = 'entregada' where id = p_orden;
    return null;
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

  -- El comprobante queda pendiente de CAE, esperando a administración.
  perform public.facturar_venta(v_venta);

  return v_venta;
end $$;

revoke all on function public.entregar_orden(uuid) from public;
grant execute on function public.entregar_orden(uuid) to authenticated;

-- ---------------------------------------------------------------- personal

do $$ begin
  create type tipo_fichada as enum ('ingreso', 'egreso');
exception when duplicate_object then null; end $$;

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

alter table perfiles           enable row level security;
alter table clientes           enable row level security;
alter table productos          enable row level security;
alter table ventas             enable row level security;
alter table venta_items        enable row level security;
alter table ordenes            enable row level security;
alter table vehiculos          enable row level security;
alter table fichadas           enable row level security;
alter table empresa            enable row level security;
alter table comprobantes       enable row level security;
alter table comprobante_items  enable row level security;

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

-- El auto lo carga el mostrador, igual que a su dueño: el mecánico lo lee para
-- saber qué tiene delante, pero no le corrige la patente al cliente.
drop policy if exists vehiculos_leer on vehiculos;
create policy vehiculos_leer on vehiculos for select to authenticated using (true);

drop policy if exists vehiculos_escribir on vehiculos;
create policy vehiculos_escribir on vehiculos for all to authenticated
  using (public.mi_rol() in ('gerencia', 'vendedor'))
  with check (public.mi_rol() in ('gerencia', 'vendedor'));

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
  with check (public.mi_rol() in ('gerencia', 'vendedor') and estado = 'pendiente');

-- El mecánico llega a toda orden que siga abierta; la entregada la congela el
-- trigger, que además le impide tocar importes y datos del cliente.
drop policy if exists ordenes_actualizar on ordenes;
create policy ordenes_actualizar on ordenes for update to authenticated
  using (
    public.mi_rol() in ('gerencia', 'vendedor')
    or (public.mi_rol() = 'mecanico' and estado <> 'entregada')
  )
  with check (public.mi_rol() in ('gerencia', 'vendedor', 'mecanico'));

drop policy if exists ordenes_borrar on ordenes;
create policy ordenes_borrar on ordenes for delete to authenticated
  using (public.es_gerencia() and estado = 'pendiente');

-- El plan lo carga el mostrador —recepción anota lo que el cliente pide y
-- administración lo valoriza— y se puede completar hasta la entrega, porque
-- recién ahí se sabe qué llevó de verdad. Después es un comprobante.
drop policy if exists orden_items_leer on orden_items;
create policy orden_items_leer on orden_items for select to authenticated using (true);

drop policy if exists orden_items_escribir on orden_items;
create policy orden_items_escribir on orden_items for all to authenticated
  using (
    public.mi_rol() in ('gerencia', 'vendedor')
    and exists (select 1 from ordenes o where o.id = orden_id and o.estado <> 'entregada')
  )
  with check (
    public.mi_rol() in ('gerencia', 'vendedor')
    and exists (select 1 from ordenes o where o.id = orden_id and o.estado <> 'entregada')
  );

-- Las fotos las saca quien tiene el auto delante: recepción cuando lo recibe y
-- el mecánico mientras trabaja. No hay política de update a propósito —una
-- foto no se corrige, se saca otra— y borrar es de gerencia, para la que salió
-- movida. Una vez entregada la orden no se le agregan fotos: el registro de
-- ese ingreso queda cerrado igual que su comprobante.
alter table orden_fotos enable row level security;

drop policy if exists orden_fotos_leer on orden_fotos;
create policy orden_fotos_leer on orden_fotos for select to authenticated using (true);

drop policy if exists orden_fotos_crear on orden_fotos;
create policy orden_fotos_crear on orden_fotos for insert to authenticated
  with check (
    subida_por = auth.uid()
    and exists (select 1 from ordenes o where o.id = orden_id and o.estado <> 'entregada')
  );

drop policy if exists orden_fotos_borrar on orden_fotos;
create policy orden_fotos_borrar on orden_fotos for delete to authenticated
  using (public.es_gerencia());

-- Facturación: es escritorio de administración. El mecánico no ve importes
-- del cliente ni datos fiscales, y no tiene por qué.
drop policy if exists empresa_leer on empresa;
create policy empresa_leer on empresa for select to authenticated
  using (public.mi_rol() in ('gerencia', 'vendedor'));

drop policy if exists empresa_editar on empresa;
create policy empresa_editar on empresa for update to authenticated
  using (public.es_gerencia()) with check (public.es_gerencia());

drop policy if exists comprobantes_leer on comprobantes;
create policy comprobantes_leer on comprobantes for select to authenticated
  using (public.mi_rol() in ('gerencia', 'vendedor'));

-- Solo se toca lo que todavía está pendiente: corregir el CUIT, cambiar la
-- letra, cargar el CAE. El trigger decide hacia dónde puede moverse; esta
-- política decide quién puede intentarlo.
--
-- No hay política de insert ni de delete a propósito: los comprobantes nacen
-- únicamente en `facturar_venta` y no se borran nunca.
drop policy if exists comprobantes_actualizar on comprobantes;
create policy comprobantes_actualizar on comprobantes for update to authenticated
  using (public.mi_rol() in ('gerencia', 'vendedor') and estado = 'pendiente')
  with check (public.mi_rol() in ('gerencia', 'vendedor'));

drop policy if exists comprobante_items_leer on comprobante_items;
create policy comprobante_items_leer on comprobante_items for select to authenticated
  using (
    public.mi_rol() in ('gerencia', 'vendedor')
    and exists (select 1 from comprobantes c where c.id = comprobante_id)
  );

-- Fichadas: cada uno ficha lo propio y no puede editarlo después.
drop policy if exists fichadas_leer on fichadas;
create policy fichadas_leer on fichadas for select to authenticated
  using (perfil_id = auth.uid() or public.es_gerencia());

drop policy if exists fichadas_crear on fichadas;
create policy fichadas_crear on fichadas for insert to authenticated
  with check (perfil_id = auth.uid());
