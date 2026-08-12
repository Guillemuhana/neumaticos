/* El asistente de gerencia: un empleado que se sabe el sistema de memoria y
   contesta preguntas sobre lo que hay adentro.
 *
 * Corre en el servidor y no en el navegador por dos razones que no se pueden
 * esquivar:
 *
 *   la clave de Groq   Vite inlinea todo lo que empieza con VITE_ dentro del
 *                      bundle. Una clave ahí es una clave publicada: cualquiera
 *                      abre las herramientas del navegador y se la lleva.
 *   la confianza       El navegador puede pedir lo que quiera. Acá se verifica
 *                      contra Supabase quién es el que pregunta antes de
 *                      contestar nada.
 *
 * El modelo no toca la base: pide datos a través de las herramientas de abajo,
 * que son consultas fijas y de solo lectura. No hay SQL generado por el modelo,
 * así que no hay forma de que una pregunta mal escrita —o mal intencionada—
 * termine en un `delete`.
 *
 * Y las consultas salen con el token de quien pregunta, no con la service role:
 * RLS sigue mandando igual que en el resto de la app. Si mañana esta pantalla
 * se le abre a un vendedor, la base ya sabe qué no mostrarle. */

import { createClient } from '@supabase/supabase-js'

const GROQ_URL = 'https://api.groq.com/openai/v1/chat/completions'

/* Configurable por si conviene cambiarlo: Groq rota su catálogo cada tanto y
   no vale la pena tocar código para eso. Ver README. */
const MODELO = process.env.GROQ_MODEL || 'llama-3.3-70b-versatile'

/* El taller está en Argentina y "hoy" tiene que significar hoy acá. El
   servidor de Vercel corre en UTC: a las 21:30 de Buenos Aires ya es mañana
   para él, y las ventas del día saldrían cortadas. */
const ZONA = 'America/Argentina/Buenos_Aires'
const OFFSET = '-03:00'

/* `en-CA` da AAAA-MM-DD, que es justo lo que espera Postgres. */
const enFecha = new Intl.DateTimeFormat('en-CA', {
  timeZone: ZONA,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
})

const hoy = () => enFecha.format(new Date())

const haceDias = (dias) => {
  /* Al mediodía y no a medianoche: restar días desde las 00:00 con un cambio
     de horario en el medio puede caer en el día anterior. */
  const d = new Date(`${hoy()}T12:00:00${OFFSET}`)
  d.setDate(d.getDate() - dias)
  return enFecha.format(d)
}

const arranque = (fecha) => `${fecha}T00:00:00${OFFSET}`
const cierre = (fecha) => `${fecha}T23:59:59.999${OFFSET}`

/* Un rango siempre resuelto: sin fechas, el último mes. Que el modelo pueda
   omitirlas evita que invente un "desde" cuando la pregunta no lo tenía. */
const rango = ({ desde, hasta } = {}) => ({
  desde: desde || haceDias(30),
  hasta: hasta || hoy(),
})

const tope = (n, maximo = 50) => Math.min(Math.max(Number(n) || 20, 1), maximo)

/* El modelo tiende a pedir el cliente y su historial en la misma vuelta, y
   como todavía no tiene el id se lo inventa. Postgres respondería con un error
   de sintaxis de UUID que no le dice nada; esto le dice exactamente qué hacer
   y la vuelta siguiente sale bien. */
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

const exigirId = (valor, comoObtenerlo) => {
  if (!UUID.test(String(valor || '').trim()))
    throw new Error(
      `«${valor}» no es un id válido. Primero llamá a ${comoObtenerlo} y usá el id que devuelve, tal cual.`
    )
  return valor.trim()
}

/* ------------------------------------------------------------ herramientas
   Cada una es una consulta cerrada. El modelo elige cuál llamar y con qué
   argumentos; qué columnas salen y de qué tabla, no lo decide él. */

const herramientas = [
  {
    type: 'function',
    function: {
      name: 'buscar_productos',
      description:
        'Busca artículos del stock por marca, medida, código, categoría o descripción. ' +
        'Devuelve precio, costo, stock actual y mínimo. Usala para "cuántas cubiertas 205/55 hay", ' +
        '"a cuánto está tal marca", "qué falta reponer".',
      parameters: {
        type: 'object',
        properties: {
          texto: { type: 'string', description: 'Marca, medida, código o palabra suelta. Vacío devuelve todo.' },
          solo_faltantes: {
            type: 'boolean',
            description: 'Solo los que están en o por debajo del stock mínimo.',
          },
          limite: { type: 'integer', description: 'Cuántos devolver (máximo 50).' },
        },
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'resumen_stock',
      description:
        'Foto del inventario entero: cuántos artículos, cuántas unidades, cuánto vale a costo y a precio de venta, ' +
        'y qué está por debajo del mínimo.',
      parameters: { type: 'object', properties: {} },
    },
  },
  {
    type: 'function',
    function: {
      name: 'resumen_ventas',
      description:
        'Números de ventas de un período: total facturado, cantidad de ventas, ticket promedio, ' +
        'apertura por medio de pago, ranking de vendedores y lo más vendido. Solo cuenta ventas confirmadas.',
      parameters: {
        type: 'object',
        properties: {
          desde: { type: 'string', description: 'Fecha AAAA-MM-DD. Si falta, hace 30 días.' },
          hasta: { type: 'string', description: 'Fecha AAAA-MM-DD. Si falta, hoy.' },
        },
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'listar_ventas',
      description:
        'Las ventas una por una, con cliente, vendedor, medio de pago y total. Para cuando preguntan por ventas puntuales ' +
        'y no por el total del período.',
      parameters: {
        type: 'object',
        properties: {
          desde: { type: 'string', description: 'Fecha AAAA-MM-DD.' },
          hasta: { type: 'string', description: 'Fecha AAAA-MM-DD.' },
          estado: {
            type: 'string',
            enum: ['cotizacion', 'confirmada', 'anulada'],
            description: 'Si falta, trae todas.',
          },
          limite: { type: 'integer' },
        },
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'listar_ordenes',
      description:
        'Órdenes del taller con vehículo, patente, cliente, mecánico, estado, falla reportada y total del plan de trabajo. ' +
        'Para "qué hay en el taller", "qué está trabajando fulano", "qué quedó sin entregar".',
      parameters: {
        type: 'object',
        properties: {
          estado: {
            type: 'string',
            enum: ['pendiente', 'en_proceso', 'control_calidad', 'terminada', 'entregada'],
            description: 'Si falta, trae todas menos las entregadas.',
          },
          incluir_entregadas: { type: 'boolean' },
          limite: { type: 'integer' },
        },
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'buscar_clientes',
      description:
        'Busca clientes por nombre, teléfono, documento o CUIT, con sus vehículos y su condición frente a ARCA.',
      parameters: {
        type: 'object',
        properties: {
          texto: { type: 'string', description: 'Parte del nombre, teléfono, documento o CUIT.' },
          limite: { type: 'integer' },
        },
        required: ['texto'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'historial_cliente',
      description:
        'Todo lo de un cliente: sus vehículos, sus órdenes de taller y sus ventas. Pasale el id que devuelve buscar_clientes.',
      parameters: {
        type: 'object',
        properties: { cliente_id: { type: 'string', description: 'UUID del cliente.' } },
        required: ['cliente_id'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'historial_vehiculo',
      description:
        'El historial de un auto por su patente: cada visita, qué se le hizo, quién lo atendió y cuánto se cobró.',
      parameters: {
        type: 'object',
        properties: { patente: { type: 'string' } },
        required: ['patente'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'listar_comprobantes',
      description:
        'Facturación: comprobantes con su tipo, estado, número, CAE y total. Para "qué falta facturar", ' +
        '"cuánto se emitió este mes", "qué quedó pendiente de CAE".',
      parameters: {
        type: 'object',
        properties: {
          estado: { type: 'string', enum: ['pendiente', 'emitido', 'anulado'] },
          desde: { type: 'string', description: 'Fecha AAAA-MM-DD.' },
          hasta: { type: 'string', description: 'Fecha AAAA-MM-DD.' },
          limite: { type: 'integer' },
        },
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'comisiones',
      description:
        'Lo que se le debe hoy a cada uno del equipo: base generada desde la última liquidación, porcentaje y monto.',
      parameters: { type: 'object', properties: {} },
    },
  },
  {
    type: 'function',
    function: {
      name: 'estado_caja',
      description:
        'La caja: si hay un turno abierto, con cuánto se abrió, cuánto efectivo entró y cuánto debería haber. ' +
        'Más los últimos cierres con su diferencia entre lo esperado y lo contado.',
      parameters: { type: 'object', properties: {} },
    },
  },
  {
    type: 'function',
    function: {
      name: 'equipo',
      description: 'El personal: nombre, rol, si está activo y su porcentaje de comisión.',
      parameters: { type: 'object', properties: {} },
    },
  },
  {
    type: 'function',
    function: {
      name: 'garantias',
      description: 'Reclamos de garantía sobre trabajos hechos, con el motivo, la orden y cómo se resolvieron.',
      parameters: {
        type: 'object',
        properties: { estado: { type: 'string', enum: ['pendiente', 'resuelta', 'rechazada'] } },
      },
    },
  },
]

/* Un error de Supabase no puede reventar la vuelta: el modelo tiene que poder
   leer "esto falló" y decírselo a Ángel en castellano. */
const pedir = async (consulta) => {
  const { data, error } = await consulta
  if (error) throw new Error(error.message)
  return data ?? []
}

const suma = (filas, campo) => filas.reduce((t, f) => t + Number(f[campo] || 0), 0)

const ejecutores = {
  async buscar_productos(sb, { texto, solo_faltantes, limite }) {
    let q = sb
      .from('productos')
      .select('codigo, categoria, marca, medida, descripcion, precio, costo, stock, stock_minimo, activo')
      .eq('activo', true)
      .order('stock', { ascending: true })
      .limit(tope(limite))

    if (texto?.trim()) {
      const t = `%${texto.trim()}%`
      q = q.or(
        `marca.ilike.${t},medida.ilike.${t},codigo.ilike.${t},categoria.ilike.${t},descripcion.ilike.${t}`
      )
    }

    const filas = await pedir(q)
    return solo_faltantes ? filas.filter((p) => p.stock <= p.stock_minimo) : filas
  },

  async resumen_stock(sb) {
    const filas = await pedir(
      sb.from('productos').select('marca, medida, precio, costo, stock, stock_minimo').eq('activo', true)
    )

    const faltantes = filas.filter((p) => p.stock <= p.stock_minimo)

    return {
      articulos: filas.length,
      unidades: filas.reduce((t, p) => t + p.stock, 0),
      valor_a_costo: filas.reduce((t, p) => t + p.stock * Number(p.costo), 0),
      valor_a_precio_venta: filas.reduce((t, p) => t + p.stock * Number(p.precio), 0),
      articulos_bajo_minimo: faltantes.length,
      faltantes: faltantes
        .sort((a, b) => a.stock - b.stock)
        .slice(0, 20)
        .map((p) => ({ marca: p.marca, medida: p.medida, stock: p.stock, minimo: p.stock_minimo })),
    }
  },

  async resumen_ventas(sb, args) {
    const { desde, hasta } = rango(args)

    const filas = await pedir(
      sb
        .from('ventas')
        .select(
          'total, medio_pago, creada_en, vendedor:perfiles(nombre), ' +
            'venta_items(cantidad, precio_unitario, descripcion, producto:productos(marca, medida, categoria))'
        )
        .eq('estado', 'confirmada')
        .gte('creada_en', arranque(desde))
        .lte('creada_en', cierre(hasta))
        .limit(500)
    )

    /* Los agrupados se arman acá y no en la base a propósito: son tres vueltas
       sobre como mucho quinientas filas, y meterlos en Postgres obligaría a
       una función nueva por cada corte que a Ángel se le ocurra pedir. */
    const porClave = (clave, importe) =>
      Object.entries(
        filas.reduce((acc, v) => {
          const k = clave(v)
          acc[k] = (acc[k] || 0) + importe(v)
          return acc
        }, {})
      )
        .map(([nombre, total]) => ({ nombre, total }))
        .sort((a, b) => b.total - a.total)

    const articulos = {}
    for (const v of filas) {
      for (const i of v.venta_items ?? []) {
        const nombre = i.producto
          ? `${i.producto.marca} ${i.producto.medida}`.trim()
          : i.descripcion || 'Sin detalle'
        const a = (articulos[nombre] ??= { nombre, unidades: 0, total: 0 })
        a.unidades += Number(i.cantidad)
        a.total += Number(i.cantidad) * Number(i.precio_unitario)
      }
    }

    const total = suma(filas, 'total')

    return {
      periodo: { desde, hasta },
      ventas: filas.length,
      total,
      ticket_promedio: filas.length ? Math.round(total / filas.length) : 0,
      por_medio_de_pago: porClave((v) => v.medio_pago || 'sin especificar', (v) => Number(v.total)),
      por_vendedor: porClave((v) => v.vendedor?.nombre || 'sin asignar', (v) => Number(v.total)),
      mas_vendidos: Object.values(articulos)
        .sort((a, b) => b.total - a.total)
        .slice(0, 10),
    }
  },

  async listar_ventas(sb, args) {
    const { desde, hasta } = rango(args)

    let q = sb
      .from('ventas')
      .select('creada_en, estado, total, medio_pago, notas, cliente:clientes(nombre), vendedor:perfiles(nombre)')
      .gte('creada_en', arranque(desde))
      .lte('creada_en', cierre(hasta))
      .order('creada_en', { ascending: false })
      .limit(tope(args?.limite))

    if (args?.estado) q = q.eq('estado', args.estado)

    return { periodo: { desde, hasta }, ventas: await pedir(q) }
  },

  async listar_ordenes(sb, args = {}) {
    let q = sb
      .from('ordenes')
      .select(
        'creada_en, cerrada_en, estado, vehiculo, patente, kilometraje, falla_reportada, diagnostico, ' +
          'hallazgos, total, medio_pago, proximo_service, cliente:clientes(nombre, telefono), ' +
          'mecanico:perfiles!ordenes_mecanico_id_fkey(nombre)'
      )
      .order('creada_en', { ascending: false })
      .limit(tope(args.limite, 60))

    if (args.estado) q = q.eq('estado', args.estado)
    else if (!args.incluir_entregadas) q = q.neq('estado', 'entregada')

    return await pedir(q)
  },

  async buscar_clientes(sb, { texto, limite }) {
    const t = `%${(texto || '').trim()}%`
    return await pedir(
      sb
        .from('clientes')
        .select(
          'id, nombre, telefono, email, documento, cuit, domicilio, condicion_iva, creado_en, ' +
            'vehiculos(marca, modelo, anio, patente)'
        )
        .or(`nombre.ilike.${t},telefono.ilike.${t},documento.ilike.${t},cuit.ilike.${t},email.ilike.${t}`)
        .limit(tope(limite, 25))
    )
  },

  async historial_cliente(sb, args) {
    const cliente_id = exigirId(args?.cliente_id, 'buscar_clientes')

    const [cliente, ordenes, ventas] = await Promise.all([
      pedir(
        sb
          .from('clientes')
          .select('id, nombre, telefono, cuit, condicion_iva, vehiculos(marca, modelo, anio, patente)')
          .eq('id', cliente_id)
      ),
      pedir(
        sb
          .from('ordenes')
          .select(
            'creada_en, estado, vehiculo, patente, kilometraje, falla_reportada, diagnostico, total, ' +
              'proximo_service, mecanico:perfiles!ordenes_mecanico_id_fkey(nombre), ' +
              'orden_items(tipo, descripcion, cantidad, precio_unitario)'
          )
          .eq('cliente_id', cliente_id)
          .order('creada_en', { ascending: false })
          .limit(20)
      ),
      pedir(
        sb
          .from('ventas')
          .select('creada_en, estado, total, medio_pago')
          .eq('cliente_id', cliente_id)
          .order('creada_en', { ascending: false })
          .limit(20)
      ),
    ])

    return {
      cliente: cliente[0] ?? null,
      ordenes,
      ventas,
      total_gastado: suma(
        ventas.filter((v) => v.estado === 'confirmada'),
        'total'
      ),
    }
  },

  async historial_vehiculo(sb, { patente }) {
    const limpia = (patente || '').trim().toUpperCase()

    /* Se busca por el texto de la orden y no por la ficha del vehículo: la
       orden guarda la patente tal como entró ese día, y es la que coincide
       con lo que Ángel tiene escrito en el papel. */
    return await pedir(
      sb
        .from('ordenes')
        .select(
          'creada_en, cerrada_en, estado, vehiculo, patente, kilometraje, falla_reportada, diagnostico, ' +
            'hallazgos, total, proximo_service, cliente:clientes(nombre, telefono), ' +
            'mecanico:perfiles!ordenes_mecanico_id_fkey(nombre), ' +
            'orden_items(tipo, descripcion, cantidad, precio_unitario)'
        )
        .ilike('patente', limpia)
        .order('creada_en', { ascending: false })
        .limit(25)
    )
  },

  async listar_comprobantes(sb, args = {}) {
    let q = sb
      .from('comprobantes')
      .select(
        'fecha, tipo, estado, punto_venta, numero, cliente_nombre, cliente_cuit, neto, iva, total, cae, cae_vencimiento'
      )
      .order('creado_en', { ascending: false })
      .limit(tope(args.limite, 60))

    if (args.estado) q = q.eq('estado', args.estado)
    if (args.desde) q = q.gte('fecha', args.desde)
    if (args.hasta) q = q.lte('fecha', args.hasta)

    const filas = await pedir(q)

    return {
      comprobantes: filas,
      total_listado: suma(filas, 'total'),
      pendientes: filas.filter((c) => c.estado === 'pendiente').length,
    }
  },

  async comisiones(sb) {
    return await pedir(sb.rpc('comisiones_pendientes'))
  },

  async estado_caja(sb) {
    const cajas = await pedir(
      sb
        .from('cajas')
        .select(
          'id, abierta_en, cerrada_en, monto_inicial, monto_contado, notas, ' +
            'abierta_por:perfiles!cajas_abierta_por_fkey(nombre)'
        )
        .order('abierta_en', { ascending: false })
        .limit(6)
    )

    /* El efectivo del turno lo calcula la base: es la misma función que usa la
       pantalla de Caja, así que el número que dé el asistente y el que ve el
       mostrador son el mismo por construcción. */
    const conEfectivo = await Promise.all(
      cajas.map(async (c) => {
        const { data } = await sb.rpc('efectivo_de_caja', { p_caja: c.id })
        const efectivo = Number(data || 0)
        const esperado = Number(c.monto_inicial) + efectivo
        return {
          abierta_en: c.abierta_en,
          cerrada_en: c.cerrada_en,
          abierta_por: c.abierta_por?.nombre ?? null,
          monto_inicial: Number(c.monto_inicial),
          efectivo_cobrado: efectivo,
          esperado_en_cajon: esperado,
          contado: c.cerrada_en ? Number(c.monto_contado) : null,
          diferencia: c.cerrada_en ? Number(c.monto_contado) - esperado : null,
          notas: c.notas,
        }
      })
    )

    return {
      turno_abierto: conEfectivo.find((c) => !c.cerrada_en) ?? null,
      ultimos_cierres: conEfectivo.filter((c) => c.cerrada_en),
    }
  },

  async equipo(sb) {
    return await pedir(
      sb.from('perfiles').select('nombre, rol, activo, telefono, email, comision_pct').order('rol')
    )
  },

  async garantias(sb, args = {}) {
    let q = sb
      .from('garantias')
      .select(
        'creada_en, motivo, estado, resolucion, resuelta_en, ' +
          'orden:ordenes(vehiculo, patente, cliente:clientes(nombre), mecanico:perfiles!ordenes_mecanico_id_fkey(nombre))'
      )
      .order('creada_en', { ascending: false })
      .limit(30)

    if (args.estado) q = q.eq('estado', args.estado)
    return await pedir(q)
  },
}

/* ------------------------------------------------------------- instrucción
   Lo que el modelo sabe sin preguntarle a nadie: cómo funciona el negocio.
   Las reglas del circuito están acá porque la mitad de lo que se consulta no
   es un dato sino un "¿cómo se hace esto?", y para eso no hay tabla. */

const INSTRUCCION = `Sos el asistente de Neumáticos y Servicios Pérez, un taller y gomería en Argentina.
Trabajás para Ángel, el dueño. Conocés el sistema de gestión de punta a punta y contestás como un
empleado de confianza que lo usa todos los días: directo, en castellano rioplatense, sin vueltas.

Hoy es ${hoy()}.

CÓMO FUNCIONA EL NEGOCIO

Roles: gerencia (Ángel, ve todo), vendedor (mostrador: stock, ventas, clientes, caja, facturación,
recibe y entrega vehículos) y mecánico (taller: toma órdenes, las trabaja, no toca importes ni datos
del cliente).

Circuito del taller — una orden pasa por cinco etapas y no se saltea ninguna, la base lo impide:
1. pendiente: recepción carga cliente, vehículo, patente, kilometraje, la falla reportada y asigna mecánico.
2. en_proceso: el taller la toma. Sin mecánico asignado no arranca. Se cargan hallazgos, diagnóstico y fotos.
3. control_calidad: se revisan cuatro puntos — aceite, presión de neumáticos, frenos y luces.
4. terminada: pasó el control. Sin los cuatro puntos tildados no se llega acá.
5. entregada: se entrega el vehículo con su medio de pago y próximo service. En ese solo paso se cierra
   la orden, se genera la venta, se descuenta el stock de los repuestos y queda armado el comprobante.
   Una orden entregada no se reabre.

El plan de trabajo (mano de obra y repuestos con precio) es aparte y opcional: se carga cuando se sabe
qué lleva y es lo que se factura al entregar. Una orden entregada sin plan no genera venta.

Facturación — la venta y el comprobante son dos cosas distintas. La venta es el movimiento interno
(mueve stock y estadísticas, la cierra el mostrador); el comprobante es el papel del cliente, lo numera
ARCA y lo emite administración, que puede hacerlo más tarde. Estados del comprobante: pendiente (armado,
esperando el CAE, todavía corregible), emitido (con número, CAE y vencimiento; queda congelado) y anulado.
Al Responsable Inscripto le va Factura A con IVA discriminado; al resto, Factura B con el IVA adentro.
Sin CUIT no hay A posible. Hoy el CAE se carga a mano desde el portal de ARCA porque falta el certificado
digital. Los precios del sistema son finales, con IVA incluido.

Ventas: una venta nace como cotización y no mueve stock; recién al confirmarla se descuenta el inventario,
y si se anula se repone. El total lo calcula la base, no la pantalla.

Comisiones: cada vendedor y mecánico tiene un porcentaje. Al vendedor se le mide sobre las ventas
confirmadas; al mecánico, solo sobre la mano de obra de órdenes ya entregadas. Se cuenta lo generado
desde la última liquidación. Liquidar cierra el tramo y solo lo hace gerencia.

Caja: un turno de mostrador, uno solo abierto a la vez. Se abre con lo que hay en el cajón y se cierra
contando. Lo que importa es la diferencia entre lo esperado y lo contado. Solo cuenta el efectivo: una
transferencia no está en el cajón.

Garantías: el cliente vuelve porque lo que se arregló falló. Cuelgan de la orden original.

CÓMO CONTESTÁS

- Si la pregunta es sobre datos del sistema, usá las herramientas. Nunca inventes un número ni una fecha.
- Un id de cliente NO se inventa nunca. Si una herramienta pide un id, llamá primero a la que lo devuelve,
  esperá el resultado y recién en la vuelta siguiente usalo. Nunca pidas dos herramientas encadenadas en
  la misma vuelta: la segunda todavía no tiene con qué trabajar.
- Sí podés pedir varias herramientas juntas cuando son independientes entre sí (stock y caja, por ejemplo).
- Si una herramienta vuelve vacía, decilo tal cual: "no hay nada cargado con eso". No rellenes.
- Montos en pesos, con separador de miles y sin decimales salvo que hagan falta: $1.250.000.
- Fechas en formato legible: "12 de agosto", "el martes pasado".
- Respuestas cortas. Si el dato entra en una línea, una línea. Listas o tablitas cuando son varios ítems.
- Cuando el número invite a una conclusión —falta stock, hay comprobantes sin emitir hace días, una caja
  cerró con diferencia— decila en una frase al final. Ángel quiere el dato y qué hacer con él.
- Si te preguntan cómo se hace algo en el sistema, explicalo con los pasos reales de las pantallas.
- Lo que no sabés o el sistema no guarda, se dice. No se estima.`

/* --------------------------------------------------------------- el handler */

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST')
    return res.status(405).json({ error: 'Usá POST.' })
  }

  const clave = process.env.GROQ_API_KEY
  const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL
  const anon = process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY

  if (!clave) return res.status(500).json({ error: 'Falta GROQ_API_KEY en el entorno del servidor.' })
  if (!url || !anon) return res.status(500).json({ error: 'Faltan las credenciales de Supabase en el servidor.' })

  const token = (req.headers.authorization || '').replace(/^Bearer /i, '')
  if (!token) return res.status(401).json({ error: 'Sesión no enviada.' })

  /* El cliente se arma con la clave anon y el token de quien pregunta, no con
     la service role: así cada consulta pasa por RLS igual que si la hiciera la
     pantalla. El servidor no gana permisos por ser servidor. */
  const sb = createClient(url, anon, {
    global: { headers: { Authorization: `Bearer ${token}` } },
    auth: { persistSession: false, autoRefreshToken: false },
  })

  const { data: quien, error: errorUsuario } = await sb.auth.getUser()
  if (errorUsuario || !quien?.user) return res.status(401).json({ error: 'Sesión vencida. Volvé a entrar.' })

  const { data: perfil } = await sb
    .from('perfiles')
    .select('nombre, rol, activo')
    .eq('id', quien.user.id)
    .maybeSingle()

  /* Puerta cerrada con llave: el asistente cruza ventas, comisiones y caja de
     todo el local. Que la pantalla sea solo para gerencia no alcanza, porque
     esta URL se puede llamar sin pantalla. */
  if (!perfil?.activo || perfil.rol !== 'gerencia')
    return res.status(403).json({ error: 'El asistente es solo para gerencia.' })

  const entrada = Array.isArray(req.body?.mensajes) ? req.body.mensajes : []
  if (!entrada.length) return res.status(400).json({ error: 'No mandaste ninguna pregunta.' })

  const conversacion = [
    { role: 'system', content: `${INSTRUCCION}\n\nQuien te pregunta es ${perfil.nombre} (gerencia).` },
    /* Solo las últimas doce: el historial entero de una charla larga se come
       la ventana de contexto y encarece cada vuelta sin agregar nada. */
    ...entrada.slice(-12).map((m) => ({
      role: m.rol === 'asistente' ? 'assistant' : 'user',
      content: String(m.texto ?? '').slice(0, 4000),
    })),
  ]

  const consultadas = []

  try {
    /* Cuatro vueltas alcanzan para la cadena más larga que se da en la
       práctica (buscar cliente → historial → comprobantes) y ponen un techo a
       lo que puede costar una sola pregunta. */
    for (let vuelta = 0; vuelta < 4; vuelta++) {
      const respuesta = await fetch(GROQ_URL, {
        method: 'POST',
        headers: { Authorization: `Bearer ${clave}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: MODELO,
          messages: conversacion,
          tools: herramientas,
          tool_choice: 'auto',
          temperature: 0.2,
          max_tokens: 1500,
        }),
      })

      if (!respuesta.ok) {
        const detalle = await respuesta.text()
        console.error('Groq respondió', respuesta.status, detalle)
        return res.status(502).json({
          error:
            respuesta.status === 401
              ? 'La clave de Groq no es válida.'
              : respuesta.status === 429
                ? 'Groq está limitando las consultas. Probá en un minuto.'
                : 'El servicio de IA no respondió bien. Probá de nuevo.',
        })
      }

      const datos = await respuesta.json()
      const mensaje = datos.choices?.[0]?.message
      if (!mensaje) return res.status(502).json({ error: 'Respuesta vacía del servicio de IA.' })

      const llamadas = mensaje.tool_calls ?? []
      if (!llamadas.length)
        return res.status(200).json({
          texto: mensaje.content || 'No supe qué contestar a eso.',
          consultadas,
        })

      conversacion.push(mensaje)

      /* En paralelo: son consultas independientes y esperarlas de a una
         duplica el tiempo de respuesta cuando el modelo pide dos juntas. */
      const resultados = await Promise.all(
        llamadas.map(async (llamada) => {
          const nombre = llamada.function?.name
          let contenido

          try {
            const ejecutor = ejecutores[nombre]
            if (!ejecutor) throw new Error(`No existe la herramienta ${nombre}.`)

            const args = llamada.function.arguments ? JSON.parse(llamada.function.arguments) : {}
            if (!consultadas.includes(nombre)) consultadas.push(nombre)
            contenido = JSON.stringify(await ejecutor(sb, args))
          } catch (err) {
            console.error(`Herramienta ${nombre} falló:`, err)
            /* El error vuelve como resultado y no como excepción: el modelo lo
               lee y le explica a Ángel qué no se pudo consultar, en vez de
               dejar la pantalla con un cartel rojo genérico. */
            contenido = JSON.stringify({ error: err.message })
          }

          return { role: 'tool', tool_call_id: llamada.id, name: nombre, content: contenido }
        })
      )

      conversacion.push(...resultados)
    }

    return res.status(200).json({
      texto: 'Di muchas vueltas buscando eso y no llegué a una respuesta. Probá preguntándolo más puntual.',
      consultadas,
    })
  } catch (err) {
    console.error('Asistente:', err)
    return res.status(500).json({ error: 'Algo falló consultando el sistema. Probá de nuevo.' })
  }
}
