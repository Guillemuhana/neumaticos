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

Una orden atraviesa tres escritorios, y el orden importa:

| Etapa | Quién | Qué pasa |
| --- | --- | --- |
| `recepcion` | Vendedor / Gerencia | Llega el vehículo. Se identifica al cliente (o se lo da de alta ahí mismo) y se registran patente, kilometraje y la falla reportada. |
| `presupuestada` | Gerencia | Administración arma el plan de trabajo: mano de obra y repuestos del stock, con precios. El total lo calcula la base. |
| `aprobada` | Vendedor / Gerencia | Se registra el OK del cliente. Recién acá la orden se ve como trabajo a hacer. |
| `en_proceso` | Mecánico / Gerencia | El taller ejecuta. Sin mecánico asignado no arranca. |
| `terminada` | Mecánico / Gerencia | El trabajo está listo para entregar. |
| `entregada` | Vendedor / Gerencia | Se entrega el vehículo. En un solo paso se cierra la orden, se genera la venta y se descuenta el stock de los repuestos. |

Las etapas no son un rótulo: el trigger `validar_avance_orden` rechaza los
atajos. No se puede presupuestar sin plan, ni trabajar sin aprobación, ni
entregar sin haber terminado, ni tocar una orden ya entregada. El plan queda
congelado una vez aprobado —cambiarlo sería cobrarle otra cosa al cliente— y el
mecánico no puede modificar importes ni datos del cliente.

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
