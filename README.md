# Gestión Pérez

Sistema de gestión para Neumáticos y Servicios Pérez: stock, ventas, órdenes de
taller y personal.

Stack: React 19 + Vite, React Router, Tailwind CSS v4 y Supabase (auth).

## Puesta en marcha

```bash
npm install
cp .env.example .env   # completar con el proyecto de Supabase
# Agregar también estas variables para crear el usuario admin:
# VITE_SUPABASE_URL=https://<project>.supabase.co
# VITE_SUPABASE_ANON_KEY=<anon-key>                 # clave anon real necesaria para login
# SUPABASE_URL=https://<project>.supabase.co
# SUPABASE_SERVICE_ROLE_KEY=<service-role-key>
# ADMIN_EMAIL=admin@dominio.com
# ADMIN_PASSWORD=ContraseñaSegura123
# ADMIN_NOMBRE=Administrador
npm run create-admin
npm run ensure-perfiles
npm run dev
```

Si el sitio muestra un error como “Could not find the table 'public.perfiles' in the schema cache”, significa que el esquema de base de datos no está aplicado en Supabase.

Abre el proyecto en Supabase, ve a SQL Editor y ejecuta el contenido de `supabase/schema.sql`, o aplica el esquema con la CLI de Supabase si la tenés instalada.

Si ya creaste usuarios en Auth y algunos no tienen perfil, también podés ejecutar:

```bash
npm run ensure-perfiles
```

Las credenciales salen de Supabase → Project Settings → API (`Project URL` y la
clave `anon`).

## El circuito del taller

Todo empieza cuando entra un cliente. Recepción le toma los datos y arma la
orden con lo que pide; la orden pasa derecho al taller, que la toma y la
trabaja; recepción entrega y cobra.

| Etapa | Quién | Qué pasa |
| --- | --- | --- |
| `pendiente` | Vendedor / Gerencia | Se identifica al cliente (o se lo da de alta ahí mismo), se registran vehículo, patente, kilometraje y lo que viene a resolver, y se asigna el mecánico. La orden ya aparece en el tablero del taller. |
| `en_proceso` | Mecánico / Gerencia | El taller la toma y trabaja. Sin mecánico asignado no arranca. |
| `terminada` | Mecánico / Gerencia | El trabajo está listo para entregar. |
| `entregada` | Vendedor / Gerencia | Se entrega el vehículo. En un solo paso se cierra la orden, se genera la venta y se descuenta el stock de los repuestos. |

El **plan de trabajo** (`orden_items`: mano de obra y repuestos con precio) es
aparte y opcional. Se carga desde el mostrador cuando se sabe qué lleva —antes,
durante o al terminar— y es lo que se factura al entregar. No frena el paso al
taller. Una orden entregada sin plan simplemente no genera venta.

Las etapas no son un rótulo: el trigger `validar_avance_orden` rechaza los
atajos. No se arranca sin mecánico asignado, no se entrega sin haber terminado
y una orden entregada no se reabre ni se corrige. El mecánico puede mover el
estado y tomar la orden, pero no tocar importes ni datos del cliente: RLS
decide filas, no columnas, así que eso lo aplica el trigger.

Entregar pasa por la función `entregar_orden`: cerrar, facturar y descontar
stock ocurren juntos o no ocurre ninguno.

## Estructura

```
src/
  main.jsx              punto de entrada, monta router y AuthProvider
  App.jsx               rutas y guardia de sesión
  index.css             tokens de marca (Tailwind v4, @theme)
  lib/supabase.js       cliente de Supabase
  context/AuthProvider  sesión, iniciarSesion, cerrarSesion
  components/UI.jsx     Boton, Campo, Aviso, Cargando, estiloInput
  components/taller/    RecibirVehiculo (recepción), PanelOrden (plan y avance)
  lib/taller.js         etapas del circuito y quién puede avanzar cada una
  pages/                Login, Inicio, Stock, Ventas, Clientes, Taller,
                        Personal, Estadisticas
```

## Pendiente

- `public/logo-perez.png` (el logo referenciado por Login e Inicio)
- Exportar la orden y el presupuesto a PDF
- Calendario de turnos por técnico
- Datos y logo de la empresa configurables para la papelería
