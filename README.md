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
| `entregada` | Vendedor / Gerencia | Se entrega el vehículo. En un solo paso se cierra la orden, se genera la venta, se descuenta el stock de los repuestos y queda armado el comprobante para administración. |

El **plan de trabajo** (`orden_items`: mano de obra y repuestos con precio) es
aparte y opcional. Se carga desde el mostrador cuando se sabe qué lleva —antes,
durante o al terminar— y es lo que se factura al entregar. No frena el paso al
taller. Una orden entregada sin plan simplemente no genera venta.

Las etapas no son un rótulo: el trigger `validar_avance_orden` rechaza los
atajos. No se arranca sin mecánico asignado, no se entrega sin haber terminado
y una orden entregada no se reabre ni se corrige. El mecánico puede mover el
estado y tomar la orden, pero no tocar importes ni datos del cliente: RLS
decide filas, no columnas, así que eso lo aplica el trigger.

Entregar pasa por la función `entregar_orden`: cerrar, registrar la venta,
descontar stock y armar el comprobante ocurren juntos o no ocurre ninguno.

## Facturación

La venta y el comprobante son dos cosas distintas. La **venta** es el
movimiento interno: mueve stock y alimenta las estadísticas, y la cierra el
mostrador. El **comprobante** es el papel que se lleva el cliente: lo numera
ARCA y lo emite administración, que puede hacerlo un rato después.

Separarlos evita que quien entrega el vehículo necesite tener a mano el CUIT y
el CAE. Al entregar, el comprobante queda `pendiente` y aparece en
**Facturación**; ahí se corrigen los datos fiscales y se carga la autorización.

| Estado | Qué significa |
| --- | --- |
| `pendiente` | Armado y esperando el CAE. Se puede corregir la letra, el CUIT, el domicilio y la fecha, o anularlo si no se va a emitir. |
| `emitido` | Tiene número, CAE y vencimiento. Queda congelado y se puede imprimir. |
| `anulado` | Un pendiente que no se va a emitir. La venta y el stock quedan como estaban. |

La letra sale de cómo está inscripto el cliente: al Responsable Inscripto le va
**Factura A** con el IVA discriminado, al resto **Factura B** con el IVA dentro
del precio. Sin CUIT no hay A posible, así que en ese caso sale B y
administración lo corrige antes de emitir.

Los precios del sistema son finales, con IVA incluido. El neto y el IVA los
calcula la base en `comprobante_items`, restando en vez de con dos fórmulas
sueltas, para que `neto + iva` dé exactamente el importe.

### Conexión con ARCA

**Hoy el CAE se carga a mano** desde el portal de ARCA. Falta el certificado
digital, que es lo único que habilita la emisión automática:

1. Entrar al portal de ARCA con clave fiscal.
2. **Administración de Certificados Digitales**: generar el certificado.
3. **Administrador de Relaciones**: asociarlo al servicio *Facturación
   Electrónica*.

El certificado no puede vivir en el navegador —la clave privada quedaría
expuesta—, así que la emisión automática va a salir de un backend (Edge
Function de Supabase con WSAA + WSFEv1, o un servicio tercero). Cuando entre,
va a completar exactamente los mismos tres campos que hoy se copian a mano
—`numero`, `cae`, `cae_vencimiento`— y el resto del circuito no cambia.

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
  components/facturacion/  PanelComprobante (carga del CAE), ComprobanteImpreso
  lib/taller.js         etapas del circuito y quién puede avanzar cada una
  lib/fiscal.js         condiciones de IVA, tipos de comprobante, validación de CUIT
  pages/                Login, Inicio, Stock, Ventas, Clientes, Taller,
                        Facturacion, Personal, Estadisticas
```

## Pendiente

- `public/logo-perez.png` (el logo referenciado por Login e Inicio)
- Emisión automática del CAE contra ARCA (ver «Conexión con ARCA»)
- El QR de ARCA en el comprobante impreso: se arma con el CAE, así que recién
  se puede generar cuando lo devuelve el web service
- Notas de crédito, para revertir un comprobante ya emitido
- Exportar la orden y el presupuesto a PDF
- Calendario de turnos por técnico
- El logo de la empresa en la papelería (los datos ya son configurables)
