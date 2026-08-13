import { useState } from 'react'
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip as TooltipRecharts,
  XAxis,
  YAxis,
} from 'recharts'
import {
  Boxes,
  ClipboardList,
  Contact,
  Download,
  HandCoins,
  Receipt,
  Share2,
  Wallet,
  Wrench,
} from 'lucide-react'
import { eachDayOfInterval, format, startOfDay, subDays } from 'date-fns'
import { es } from 'date-fns/locale'
import { useConsulta } from '../hooks/useConsulta'
import { supabase } from '../lib/supabase'
import { numero, plata } from '../lib/formato'
import { ETAPAS, etapaDe } from '../lib/taller'
import { Aviso, Boton, Cargando, Encabezado, Metrica, Segmentado, Tabla, Tarjeta } from '../components/UI'
import {
  GRIS_EJE,
  GRIS_FONDO,
  GRIS_LINEA,
  MARCA,
  PanelGrafico,
  Tooltip,
  ejeComun,
} from '../components/Grafico'

const periodos = [
  { valor: 1, texto: 'Hoy' },
  { valor: 7, texto: '7 días' },
  { valor: 30, texto: '30 días' },
  { valor: 365, texto: 'Año' },
]

export default function Estadisticas() {
  const [dias, setDias] = useState(30)

  const { datos, cargando, error } = useConsulta(async () => {
    const desde = startOfDay(subDays(new Date(), dias - 1)).toISOString()

    /* La columna `categoria` es reciente: si la base todavía no la tiene,
       se reintenta sin ella en vez de dejar la pantalla vacía. */
    const conCategoria = async (select, sinCategoria) => {
      const r = await select()
      if (!r.error) return r
      if (r.error.message?.toLowerCase().includes('categoria')) return sinCategoria()
      return r
    }

    /* `!inner` es obligatorio para que los filtros sobre `ventas` apliquen:
       sin él PostgREST devuelve el ítem igual, con ventas en null, y las
       cotizaciones y los meses viejos se cuelan en el total. */
    const items = (campos) => () =>
      supabase
        .from('venta_items')
        .select(`cantidad, precio_unitario, productos(${campos}), ventas!inner(creada_en, estado)`)
        .eq('ventas.estado', 'confirmada')
        .gte('ventas.creada_en', desde)

    const [ventas, ordenes, equipo, productos, ventasDetalle, manoDeObra, clientes] =
      await Promise.all([
      supabase
        .from('ventas')
        .select('id, total, creada_en, estado, vendedor_id, perfiles!ventas_vendedor_id_fkey(nombre)')
        .eq('estado', 'confirmada')
        .gte('creada_en', desde),
      supabase
        .from('ordenes')
        /* Sin embeber `perfiles`: `ordenes` la referencia cuatro veces y la
           consulta saldría ambigua. El mecánico se resuelve más abajo contra
           la vista `equipo`. */
        .select('id, vehiculo, patente, estado, total, notas, creada_en, mecanico_id')
        .gte('creada_en', desde),
      /* `perfiles` y no `equipo`: hace falta el porcentaje de comisión, que la
         vista no expone. Esta pantalla es solo de gerencia, y RLS le devuelve
         el equipo entero; a cualquier otro le devolvería una fila. */
      supabase.from('perfiles').select('id, nombre, rol, comision_pct'),
      conCategoria(
        () => supabase.from('productos').select('stock, costo, categoria').eq('activo', true),
        () => supabase.from('productos').select('stock, costo').eq('activo', true)
      ),
      conCategoria(items('marca, medida, categoria'), items('marca, medida')),
      /* La comisión del mecánico sale de la mano de obra, no del total de la
         orden: los repuestos no los vende, los coloca. Mismo criterio que
         `comisiones_pendientes()` en la base, para que los dos números
         coincidan cuando alguien los compare. */
      supabase
        .from('orden_items')
        .select('cantidad, precio_unitario, ordenes!inner(mecanico_id, estado, cerrada_en)')
        .eq('tipo', 'servicio')
        .eq('ordenes.estado', 'entregada')
        .gte('ordenes.cerrada_en', desde),
      supabase.from('clientes').select('id', { count: 'exact', head: true }),
    ])

    /* Devolver el error entero, no un booleano: el hook lee `.message`, y un
       `true` suelto dejaba el cartel vacío — que es la pantalla en blanco. */
    const fallo = [ventas, ordenes, equipo, productos, ventasDetalle, manoDeObra, clientes]
      .find((r) => r.error)?.error
    if (fallo) return { error: fallo }

    const nombre = new Map(equipo.data.map((p) => [p.id, p.nombre]))

    return {
      data: {
        ventas: ventas.data,
        ordenes: ordenes.data.map((o) => ({
          ...o,
          mecanico: o.mecanico_id ? { nombre: nombre.get(o.mecanico_id) } : null,
        })),
        equipo: equipo.data,
        productos: productos.data,
        ventasDetalle: ventasDetalle.data,
        manoDeObra: manoDeObra.data,
        totalClientes: clientes.count ?? 0,
      },
    }
  }, [dias])

  if (cargando) return <Cargando texto="Calculando…" alto="min-h-[60vh]" />
  if (error) return <Aviso>{error}</Aviso>
  if (!datos) return <Aviso>Ocurrió un error inesperado al cargar las estadísticas.</Aviso>

  const { ventas, ordenes, equipo, productos, ventasDetalle, manoDeObra, totalClientes } =
    datos

  /* Los rankings del período. La comisión se calcula con el porcentaje que
     rige hoy: es una proyección de lo que se va a pagar, no un recibo. Lo ya
     liquidado, con su porcentaje congelado, vive en Comisiones. */
  const pctDe = (id) => Number(equipo.find((p) => p.id === id)?.comision_pct ?? 0)
  const nombreDe = (id) => equipo.find((p) => p.id === id)?.nombre ?? 'Sin asignar'

  const rankingVendedores = Object.values(
    ventas.reduce((acc, v) => {
      const fila = (acc[v.vendedor_id] ??= { id: v.vendedor_id, base: 0, cantidad: 0 })
      fila.base += Number(v.total)
      fila.cantidad += 1
      return acc
    }, {})
  )
    .map((f) => ({ ...f, nombre: nombreDe(f.id), comision: (f.base * pctDe(f.id)) / 100 }))
    .sort((a, b) => b.base - a.base)

  const rankingMecanicos = Object.values(
    manoDeObra.reduce((acc, i) => {
      const id = i.ordenes?.mecanico_id
      if (!id) return acc
      const fila = (acc[id] ??= { id, base: 0, ordenes: new Set() })
      fila.base += Number(i.cantidad) * Number(i.precio_unitario)
      return acc
    }, {})
  )
    .map((f) => ({
      ...f,
      nombre: nombreDe(f.id),
      /* Los trabajos se cuentan sobre las órdenes entregadas del período y no
         sobre los renglones: una orden con tres servicios es un trabajo. */
      cantidad: ordenes.filter(
        (o) => o.mecanico_id === f.id && o.estado === 'entregada'
      ).length,
      comision: (f.base * pctDe(f.id)) / 100,
    }))
    .sort((a, b) => b.base - a.base)

  const comisionesAPagar =
    rankingVendedores.reduce((a, f) => a + f.comision, 0) +
    rankingMecanicos.reduce((a, f) => a + f.comision, 0)

  const facturado = ventas.reduce((a, v) => a + Number(v.total), 0)
  const ticket = ventas.length ? facturado / ventas.length : 0
  const inventario = productos.reduce((a, p) => a + p.stock * Number(p.costo), 0)
  const inventarioCubiertas = productos
    .filter((p) => p.categoria === 'Cubierta')
    .reduce((a, p) => a + p.stock * Number(p.costo), 0)
  const inventarioRepuestos = productos
    .filter((p) => p.categoria && p.categoria !== 'Cubierta')
    .reduce((a, p) => a + p.stock * Number(p.costo), 0)
  /* El taller es la otra mitad del negocio: lo que entra por órdenes no
     aparece en `ventas` hasta que se entrega, así que se mide aparte. */
  const entregadas = ordenes.filter((o) => o.estado === 'entregada')
  const abiertas = ordenes.filter((o) => o.estado !== 'entregada')
  const facturadoTaller = entregadas.reduce((a, o) => a + Number(o.total), 0)
  const sinAsignar = abiertas.filter((o) => !o.mecanico_id).length
  const unidadesVendidas = datos.ventasDetalle.reduce((a, item) => a + item.cantidad, 0)
  const articlesPorVenta = ventas.length ? unidadesVendidas / ventas.length : 0

  const hoy = format(new Date(), 'yyyy-MM-dd')
  const ventasHoy = ventas.filter((v) => format(new Date(v.creada_en), 'yyyy-MM-dd') === hoy)
  const ordenesHoy = ordenes.filter((o) => format(new Date(o.creada_en), 'yyyy-MM-dd') === hoy)

  /* Serie diaria completa, con los días sin ventas en cero: si se saltaran,
     el eje mentiría sobre el ritmo de facturación. */
  const porDia = eachDayOfInterval({
    start: startOfDay(subDays(new Date(), dias - 1)),
    end: new Date(),
  }).map((d) => {
    const clave = format(d, 'yyyy-MM-dd')
    const total = ventas
      .filter((v) => format(new Date(v.creada_en), 'yyyy-MM-dd') === clave)
      .reduce((a, v) => a + Number(v.total), 0)
    return { dia: format(d, 'd MMM', { locale: es }), total }
  })

  /* El UUID entero ensancha la tabla hasta empujar las columnas que importan
     fuera de la vista. Ocho caracteres alcanzan para cotejar contra la orden;
     el CSV se lleva el identificador completo. */
  const corto = (id) => (id ? String(id).slice(0, 8) : '—')

  const agrupar = (filas, obtener) => {
    const mapa = new Map()
    filas.forEach((f) => {
      const clave = obtener(f) ?? 'Sin asignar'
      mapa.set(clave, (mapa.get(clave) ?? 0) + 1)
    })
    return [...mapa.entries()].map(([nombre, cantidad]) => ({ nombre, cantidad }))
  }

  const porVendedor = (() => {
    const mapa = new Map()
    ventas.forEach((v) => {
      const nombre = v.perfiles?.nombre ?? 'Sin asignar'
      mapa.set(nombre, (mapa.get(nombre) ?? 0) + Number(v.total))
    })
    return [...mapa.entries()]
      .map(([nombre, total]) => ({ nombre, total }))
      .sort((a, b) => b.total - a.total)
  })()

  const porMecanico = agrupar(ordenes, (o) => o.mecanico?.nombre).sort(
    (a, b) => b.cantidad - a.cantidad
  )

  /* Las etapas salen de ETAPAS y no de los datos: una columna vacía también
     dice algo —"no hay nada esperando"— y si se derivara de las filas
     desaparecería justo cuando importa verla en cero. */
  const porEtapa = ETAPAS.map((e) => ({
    etapa: e.texto,
    cantidad: ordenes.filter((o) => o.estado === e.valor).length,
  }))

  const porCategoria = (() => {
    const mapa = new Map()
    datos.ventasDetalle.forEach((item) => {
      const cat = item.productos?.categoria || 'Sin categoría'
      const total = Number(item.cantidad) * Number(item.precio_unitario)
      mapa.set(cat, (mapa.get(cat) ?? 0) + total)
    })
    return [...mapa.entries()]
      .map(([categoria, total]) => ({ categoria, total }))
      .sort((a, b) => b.total - a.total)
  })()

  const topProductos = (() => {
    const mapa = new Map()
    datos.ventasDetalle.forEach((item) => {
      const clave = `${item.productos?.marca ?? 'Sin marca'} ${item.productos?.medida ?? ''}`.trim()
      const total = Number(item.cantidad) * Number(item.precio_unitario)
      mapa.set(clave, (mapa.get(clave) ?? 0) + total)
    })
    return [...mapa.entries()]
      .map(([producto, total]) => ({ producto, total }))
      .sort((a, b) => b.total - a.total)
      .slice(0, 5)
  })()

  const generarCsv = () => {
    const filas = [
      ['Métrica', 'Valor'],
      ['Facturado', plata(facturado)],
      ['Ticket promedio', plata(ticket)],
      ['Ventas confirmadas', numero(ventas.length)],
      ['Ventas hoy', numero(ventasHoy.length)],
      ['Trabajos hoy', numero(ordenesHoy.length)],
      ['Unidades vendidas', numero(unidadesVendidas)],
      ['Artículos por venta', numero(articlesPorVenta.toFixed(2))],
      ['Órdenes entregadas', numero(entregadas.length)],
      ['Facturado en taller', plata(facturadoTaller)],
      ['Órdenes abiertas', numero(abiertas.length)],
      ['Órdenes sin mecánico asignado', numero(sinAsignar)],
      ['Valor de inventario', plata(inventario)],
      ['Inventario cubiertas', plata(inventarioCubiertas)],
      ['Inventario repuestos', plata(inventarioRepuestos)],
      [],
      ['Ventas del día'],
      ['Venta', 'Vendedor', 'Estado', 'Total', 'Hora'],
      ...ventasHoy.map((v) => [v.id ?? '—', v.perfiles?.nombre ?? '—', v.estado, plata(v.total), format(new Date(v.creada_en), 'HH:mm')]),
      [],
      ['Trabajos de taller del día'],
      ['Orden', 'Vehículo', 'Patente', 'Mecánico', 'Etapa', 'Importe'],
      ...ordenesHoy.map((o) => [
        o.id ?? '—',
        o.vehiculo || '—',
        o.patente || '—',
        o.mecanico?.nombre || 'Sin asignar',
        etapaDe(o.estado).texto,
        plata(o.total),
      ]),
      [],
      ['Ventas por vendedor'],
      ['Vendedor', 'Facturado'],
      ...porVendedor.map((v) => [v.nombre, plata(v.total)]),
      [],
      ['Ventas por categoría'],
      ['Categoría', 'Facturado'],
      ...porCategoria.map((c) => [c.categoria, plata(c.total)]),
      [],
      ['Órdenes por mecánico'],
      ['Mecánico', 'Órdenes'],
      ...porMecanico.map((m) => [m.nombre, numero(m.cantidad)]),
      [],
      ['Órdenes por etapa'],
      ['Etapa', 'Órdenes'],
      ...porEtapa.map((e) => [e.etapa, numero(e.cantidad)]),
      [],
      ['Top productos por facturación'],
      ['Producto', 'Facturado'],
      ...topProductos.map((p) => [p.producto, plata(p.total)]),
    ]

    return filas.map((fila) => fila.map((celda) => `"${String(celda ?? '').replace(/"/g, '""')}"`).join(',')).join('\n')
  }

  const bajarCsv = () => {
    const blob = new Blob([generarCsv()], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `estadisticas_${format(new Date(), 'yyyyMMdd_HHmm')}.csv`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
  }

  const compartirReporte = async () => {
    const texto = `Reporte de gestión:\nFacturado: ${plata(facturado)}\nTicket promedio: ${plata(ticket)}\nVentas hoy: ${numero(ventasHoy.length)}\nFacturado en taller: ${plata(facturadoTaller)}\nÓrdenes entregadas: ${numero(entregadas.length)}\nÓrdenes abiertas: ${numero(abiertas.length)}\nValor de inventario: ${plata(inventario)}`

    if (navigator.share) {
      await navigator.share({
        title: 'Reporte de estadísticas Pérez',
        text: texto,
      })
    } else {
      await navigator.clipboard.writeText(texto)
      alert('Resumen copiado al portapapeles. Podés pegarlo en tu chat o mail.')
    }
  }

  return (
    <>
      <Encabezado titulo="Estadísticas" detalle="Rendimiento del local para decidir con datos.">
        <div className="flex flex-wrap gap-2">
          <Boton variante="secundario" onClick={bajarCsv}>
            <Download size={16} /> Descargar CSV
          </Boton>
          <Boton variante="fantasma" onClick={compartirReporte}>
            <Share2 size={16} /> Compartir
          </Boton>
        </div>
      </Encabezado>

      {/* Un solo filtro arriba: alcanza a todos los gráficos de la vista. */}
      <div className="mb-6">
        <Segmentado
          etiqueta="Período"
          opciones={periodos}
          valor={dias}
          onCambio={setDias}
        />
      </div>

      <div className="cascada grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Metrica icono={Receipt} tono="marca" titulo="Facturado" valor={plata(facturado)} pie={`${ventas.length} ventas confirmadas`} />
        <Metrica icono={Wallet} titulo="Ticket promedio" valor={plata(ticket)} pie="Por venta confirmada" />
        <Metrica icono={Receipt} titulo="Ventas hoy" valor={numero(ventasHoy.length)} pie="Ventas confirmadas en el día" />
        <Metrica icono={Wrench} tono="marca" titulo="Facturado en taller" valor={plata(facturadoTaller)} pie={`${entregadas.length} órdenes entregadas`} />
        <Metrica
          icono={ClipboardList}
          tono={abiertas.length ? 'atencion' : 'conforme'}
          titulo="Órdenes abiertas"
          valor={numero(abiertas.length)}
          pie={sinAsignar ? `${sinAsignar} sin mecánico asignado` : 'Todas con mecánico'}
        />
        <Metrica icono={ClipboardList} titulo="Trabajos hoy" valor={numero(ordenesHoy.length)} pie="Órdenes abiertas en el día" />
        <Metrica icono={Boxes} titulo="Valor de inventario" valor={plata(inventario)} pie="Stock actual a costo" />
        <Metrica
          icono={HandCoins}
          titulo="Comisiones a pagar"
          valor={plata(comisionesAPagar)}
          pie="Vendedores y mecánicos del período"
        />
        <Metrica
          icono={Contact}
          titulo="Clientes registrados"
          valor={numero(totalClientes)}
          pie="En toda la base, no solo del período"
        />
      </div>

      <div className="mt-6 grid gap-4 xl:grid-cols-2">
        <Ranking
          titulo="Vendedores"
          filas={rankingVendedores}
          rotuloBase="Vendido"
          rotuloCantidad="Ventas"
        />
        <Ranking
          titulo="Mecánicos"
          filas={rankingMecanicos}
          rotuloBase="Mano de obra"
          rotuloCantidad="Trabajos"
        />
      </div>

      <div className="mt-6 grid gap-4 xl:grid-cols-2">
        <div className="xl:col-span-2">
          <PanelGrafico
            titulo="Facturación por día"
            detalle="Ventas confirmadas, en pesos."
            datos={porDia}
            columnas={['Día', 'Facturado']}
            filas={porDia.map((d) => [d.dia, plata(d.total)])}
          >
            <ResponsiveContainer width="100%" height={260}>
              <AreaChart data={porDia} margin={{ top: 8, right: 8, bottom: 0, left: 8 }}>
                <CartesianGrid stroke={GRIS_LINEA} vertical={false} />
                <XAxis dataKey="dia" {...ejeComun} interval="preserveStartEnd" minTickGap={24} />
                <YAxis {...ejeComun} width={64} tickFormatter={(v) => numero(v)} />
                <TooltipRecharts
                  cursor={{ stroke: GRIS_EJE }}
                  content={<Tooltip formato={plata} />}
                />
                <Area
                  type="monotone"
                  dataKey="total"
                  stroke={MARCA}
                  strokeWidth={2}
                  strokeLinejoin="round"
                  strokeLinecap="round"
                  fill={MARCA}
                  fillOpacity={0.1}
                  dot={false}
                  activeDot={{ r: 4, strokeWidth: 2, stroke: '#fff' }}
                />
              </AreaChart>
            </ResponsiveContainer>
          </PanelGrafico>
        </div>

        <PanelGrafico
          titulo="Ventas por vendedor"
          detalle="Facturación acumulada en el período."
          datos={porVendedor}
          columnas={['Vendedor', 'Facturado']}
          filas={porVendedor.map((v) => [v.nombre, plata(v.total)])}
        >
          <ResponsiveContainer width="100%" height={Math.max(200, porVendedor.length * 48)}>
            <BarChart data={porVendedor} layout="vertical" margin={{ top: 4, right: 16, bottom: 0, left: 8 }}>
              <CartesianGrid stroke={GRIS_LINEA} horizontal={false} />
              <XAxis type="number" {...ejeComun} tickFormatter={(v) => numero(v)} />
              <YAxis type="category" dataKey="nombre" {...ejeComun} width={110} />
              <TooltipRecharts cursor={{ fill: GRIS_FONDO }} content={<Tooltip formato={plata} />} />
              <Bar dataKey="total" fill={MARCA} barSize={24} radius={[0, 4, 4, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </PanelGrafico>

        <PanelGrafico
          titulo="En qué etapa está el trabajo"
          detalle="Órdenes del período por etapa del circuito."
          datos={porEtapa}
          columnas={['Etapa', 'Órdenes']}
          filas={porEtapa.map((e) => [e.etapa, numero(e.cantidad)])}
        >
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={porEtapa} margin={{ top: 8, right: 8, bottom: 0, left: 8 }}>
              <CartesianGrid stroke={GRIS_LINEA} vertical={false} />
              <XAxis dataKey="etapa" {...ejeComun} interval={0} />
              <YAxis {...ejeComun} width={40} allowDecimals={false} />
              <TooltipRecharts cursor={{ fill: GRIS_FONDO }} content={<Tooltip formato={numero} />} />
              <Bar dataKey="cantidad" fill={MARCA} barSize={40} radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </PanelGrafico>

        <PanelGrafico
          titulo="Productividad del taller"
          detalle="Órdenes tomadas por mecánico."
          datos={porMecanico}
          columnas={['Mecánico', 'Órdenes']}
          filas={porMecanico.map((m) => [m.nombre, numero(m.cantidad)])}
        >
          <ResponsiveContainer width="100%" height={Math.max(200, porMecanico.length * 48)}>
            <BarChart data={porMecanico} layout="vertical" margin={{ top: 4, right: 16, bottom: 0, left: 8 }}>
              <CartesianGrid stroke={GRIS_LINEA} horizontal={false} />
              <XAxis type="number" {...ejeComun} allowDecimals={false} />
              <YAxis type="category" dataKey="nombre" {...ejeComun} width={110} />
              <TooltipRecharts cursor={{ fill: GRIS_FONDO }} content={<Tooltip formato={numero} />} />
              <Bar dataKey="cantidad" fill={MARCA} barSize={24} radius={[0, 4, 4, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </PanelGrafico>
      </div>

      <div className="mt-6 grid gap-4 xl:grid-cols-2">
        <PanelGrafico
          titulo="Ventas del día"
          detalle="Ventas confirmadas con hora y vendedor."
          datos={ventasHoy}
          columnas={['Venta', 'Vendedor', 'Estado', 'Total', 'Hora']}
          filas={ventasHoy.map((v) => [
            corto(v.id),
            v.perfiles?.nombre ?? '—',
            v.estado,
            plata(v.total),
            format(new Date(v.creada_en), 'HH:mm'),
          ])}
        />

        <PanelGrafico
          titulo="Trabajos del taller hoy"
          detalle="Órdenes del día con vehículo, mecánico y estado."
          datos={ordenesHoy}
          columnas={['Orden', 'Vehículo', 'Patente', 'Mecánico', 'Etapa', 'Importe']}
          filas={ordenesHoy.map((o) => [
            corto(o.id),
            o.vehiculo || '—',
            o.patente || '—',
            o.mecanico?.nombre || 'Sin asignar',
            etapaDe(o.estado).texto,
            plata(o.total),
          ])}
        />
      </div>
    </>
  )
}

/* Quién vendió y quién trabajó, con lo que le toca. Es la misma tabla para los
   dos puestos porque es la misma pregunta: cuánto movió cada uno y cuánto se
   lleva. Solo cambian los rótulos. */
function Ranking({ titulo, filas, rotuloBase, rotuloCantidad }) {
  return (
    <section>
      <h2 className="display mb-3 text-base font-bold">{titulo}</h2>
      <Tarjeta>
        {!filas.length ? (
          <p className="px-4 py-6 text-sm text-acero-500">
            Sin movimiento en el período elegido.
          </p>
        ) : (
          <Tabla
            columnas={[
              'Nombre',
              { texto: rotuloCantidad, cifra: true },
              { texto: rotuloBase, cifra: true },
              { texto: 'Comisión', cifra: true },
            ]}
          >
            {filas.map((f) => (
              <tr
                key={f.id}
                className="rounded-xl bg-white shadow-sm sm:bg-transparent sm:shadow-none"
              >
                <td data-label="Nombre" className="px-4 py-2.5 font-medium">
                  {f.nombre}
                </td>
                <td data-label={rotuloCantidad} className="cifra px-4 py-2.5 text-acero-500">
                  {numero(f.cantidad)}
                </td>
                <td data-label={rotuloBase} className="cifra px-4 py-2.5">
                  {plata(f.base)}
                </td>
                <td data-label="Comisión" className="cifra px-4 py-2.5 font-semibold">
                  {plata(f.comision)}
                </td>
              </tr>
            ))}
          </Tabla>
        )}
      </Tarjeta>
    </section>
  )
}
