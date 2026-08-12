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
| `en_proceso` | Mecánico / Gerencia | El taller la toma y trabaja. Sin mecánico asignado no arranca. Acá se cargan hallazgos y diagnóstico, y se sacan las fotos del vehículo. |
| `control_calidad` | Mecánico / Gerencia | El trabajo está hecho y se revisa: nivel de aceite, presión de neumáticos, frenos y luces. |
| `terminada` | Mecánico / Gerencia | Pasó el control y está listo para entregar. El trigger no deja llegar acá con la revisión incompleta. |
| `entregada` | Vendedor / Gerencia | Se entrega el vehículo, con su medio de pago y el próximo service. En un solo paso se cierra la orden, se genera la venta, se descuenta el stock de los repuestos y queda armado el comprobante para administración. |

El **plan de trabajo** (`orden_items`: mano de obra y repuestos con precio) es
aparte y opcional. Se carga desde el mostrador cuando se sabe qué lleva —antes,
durante o al terminar— y es lo que se factura al entregar. No frena el paso al
taller. Una orden entregada sin plan simplemente no genera venta.

Las etapas no son un rótulo: el trigger `validar_avance_orden` rechaza los
atajos. No se arranca sin mecánico asignado, no se entrega sin haber terminado
y no se da un trabajo por listo sin completar los cuatro puntos del control de calidad, y una orden entregada no se reabre ni se corrige. El mecánico puede mover el
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
  hooks/useConsulta.js  envuelve una consulta: carga, error y recarga
  hooks/useNoLeidos.js  contador de mensajes sin leer del chat
  components/UI.jsx     Boton, Campo, Tabla, Etiqueta, Modal, Segmentado…
  components/taller/    NuevaOrden, PanelOrden, FotosVehiculo
  components/clientes/  FichaCliente (vehículos, fotos e historial)
  components/facturacion/  PanelComprobante (carga del CAE), ComprobanteImpreso
  lib/taller.js         etapas del circuito, control de calidad y permisos
  lib/vehiculos.js      cómo se nombra y se normaliza un vehículo
  lib/imagen.js         achica las fotos antes de subirlas
  lib/fiscal.js         condiciones de IVA, tipos de comprobante, validación de CUIT
  pages/                Login, Inicio, Stock, Ventas, Clientes, Taller,
                        Facturacion, Caja, Comisiones, Chat, Personal,
                        Estadisticas, Manual, Asistente
api/
  asistente.js          función de servidor del asistente (Groq + herramientas)
```

## Los otros módulos

**Vehículos y fotos.** El auto es del cliente, no un texto dentro de la orden:
eso es lo que permite cruzar varias visitas del mismo vehículo. Las fotos
cuelgan de la orden porque lo que se documenta es *ese* ingreso, y la ficha del
cliente las muestra todas juntas. El momento —cómo entró, durante el trabajo,
cómo se entregó— lo deduce el estado de la orden.

**Comisiones.** El vendedor cobra sobre lo vendido; el mecánico, sobre la mano
de obra (los repuestos no los vende, los coloca). *Liquidar* cierra un tramo de
tiempo en vez de marcar una casilla: lo que se debe es siempre lo generado
después de la última liquidación, y cada una guarda el porcentaje de ese día,
así cambiar el % no reescribe lo ya pagado.

**Caja.** Se abre con lo que hay en el cajón y se cierra contando. Solo mira el
efectivo —una transferencia no está en el cajón—, y para eso la venta guarda
`medio_pago`, que se pregunta al confirmar. Un índice único parcial garantiza
una sola caja abierta en todo el local.

**Chat.** Un canal grupal para los tres puestos, con foto y audio. Los mensajes
llegan por realtime; un mensaje no se edita, se manda otro.

**Garantías y hallazgos.** El hallazgo es lo que aparece de más con el auto en
el elevador: lo informa el taller y lo responde el mostrador, que es quien
habla con el cliente. La garantía es el trabajo que volvió: cuelga de la orden
entregada y le aparece al mecánico que lo hizo.

## El asistente

Una pantalla de conversación, solo para gerencia, donde se le pregunta al
sistema en castellano: «¿cuánto vendimos esta semana?», «¿qué falta reponer?»,
«¿qué le hicimos al Corsa de Gómez?». Corre sobre Groq.

Vive en `api/asistente.js`, una función de servidor, y no en el navegador, por
dos razones que no se pueden esquivar. La primera es la clave: Vite inlinea en
el bundle todo lo que empieza con `VITE_`, así que una clave ahí es una clave
publicada. La segunda es la confianza: el navegador puede pedir lo que quiera,
y quién está preguntando se verifica contra Supabase antes de contestar nada.

**El modelo no escribe SQL.** Tiene trece herramientas —`resumen_ventas`,
`buscar_productos`, `historial_vehiculo`, `estado_caja`…— que son consultas
fijas de solo lectura. El modelo elige cuál llamar y con qué argumentos; qué
tabla se toca y qué columnas salen, no lo decide él. No hay forma de que una
pregunta termine en un `delete`.

Y las consultas salen con el token de quien pregunta, no con la service role:
**RLS sigue mandando igual que en el resto de la app**. El servidor no gana
permisos por ser servidor. Encima de eso, la función exige rol `gerencia`: que
la pantalla no aparezca en el menú de los demás no alcanza, porque la URL se
puede llamar sin pantalla.

Además de los datos, el asistente sabe *cómo funciona el negocio* —las cinco
etapas de una orden, por qué la venta y el comprobante son cosas distintas,
cómo se mide una comisión—, porque la mitad de lo que se consulta no es un dato
sino un «¿cómo se hace esto?», y para eso no hay tabla. Eso está escrito en la
constante `INSTRUCCION` del mismo archivo: si cambia una regla del circuito,
se actualiza ahí.

### Configuración

En Vercel → Settings → Environment Variables:

| Variable | Para qué |
| --- | --- |
| `GROQ_API_KEY` | La clave de [console.groq.com](https://console.groq.com). **Sin** prefijo `VITE_`. |
| `GROQ_MODEL` | Opcional. Por defecto `llama-3.3-70b-versatile`. Groq rota su catálogo; si el modelo desaparece, se cambia acá sin tocar código. |
| `SUPABASE_ANON_KEY` | Solo si no están ya cargadas `VITE_SUPABASE_URL` y `VITE_SUPABASE_ANON_KEY`, que es de donde las toma si faltan. |

En local, `npm run dev` **no** levanta la función: Vite sirve el `index.html`
para cualquier ruta que no sea un archivo, y el asistente responde que no está
corriendo. Para probarlo hace falta `vercel dev`, que sirve el front y la
función juntos.

## Pendiente

- `public/logo-perez.png` (el logo referenciado por Login e Inicio)
- Emisión automática del CAE contra ARCA (ver «Conexión con ARCA»)
- El QR de ARCA en el comprobante impreso: se arma con el CAE, así que recién
  se puede generar cuando lo devuelve el web service
- Notas de crédito, para revertir un comprobante ya emitido
- Exportar la orden y el presupuesto a PDF
- Calendario de turnos por técnico
- Que el asistente pueda además *hacer* cosas (cargar un recordatorio, abrir
  una orden). Hoy solo consulta, a propósito: escribir pide confirmación
  explícita en pantalla antes de que la base se entere.
- El logo de la empresa en la papelería (los datos ya son configurables)

## Antes de usarlo con datos reales

Dos cosas que hoy están bien para mostrar el sistema y no para trabajarlo:

- **Los buckets de Storage son públicos.** Las fotos de los vehículos y los
  adjuntos del chat se abren con solo tener el enlace, sin sesión. Pasarlos a
  privado es cambiar `public` a `false` en `supabase/storage.sql` y reemplazar
  `getPublicUrl` por `createSignedUrl` en `FotosVehiculo`, `FichaCliente` y
  `Chat`.
- **La contraseña del admin es de demostración.** Cambiala desde Supabase →
  Authentication antes de que entre gente del taller.
