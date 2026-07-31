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
import { Boxes, ClipboardList, Download, Receipt, Share2, Wallet } from 'lucide-react'
import { eachDayOfInterval, format, startOfDay, subDays } from 'date-fns'
import { es } from 'date-fns/locale'
import { useConsulta } from '../hooks/useConsulta'
import { supabase } from '../lib/supabase'
import { numero, plata } from '../lib/formato'
import { Aviso, Boton, Cargando, Encabezado, Metrica } from '../components/UI'
import { MARCA, PanelGrafico, Tooltip, ejeComun } from '../components/Grafico'

const periodos = [
  { dias: 7, texto: '7 días' },
  { dias: 30, texto: '30 días' },
  { dias: 90, texto: '90 días' },
]

export default function Estadisticas() {
  const [dias, setDias] = useState(30)

  const { datos, cargando, error } = useConsulta(async () => {
    const desde = startOfDay(subDays(new Date(), dias - 1)).toISOString()

    const [ventas, ordenes, productos, ventasDetalle] = await Promise.all([
      supabase
        .from('ventas')
        .select('total, creada_en, perfiles(nombre)')
        .eq('estado', 'confirmada')
        .gte('creada_en', desde),
      supabase.from('ordenes').select('estado, creada_en, perfiles(nombre)').gte('creada_en', desde),
      supabase.from('productos').select('stock, costo, categoria').eq('activo', true),
      supabase
        .from('venta_items')
        .select('cantidad, precio_unitario, productos(marca, medida, categoria), ventas(creada_en, estado)')
        .eq('ventas.estado', 'confirmada')
        .gte('ventas.creada_en', desde),
    ])

    const fallo = ventas.error || ordenes.error || productos.error || ventasDetalle.error
    if (fallo) return { error: fallo }

    return {
      data: {
        ventas: ventas.data,
        ordenes: ordenes.data,
        productos: productos.data,
        ventasDetalle: ventasDetalle.data,
      },
    }
  }, [dias])

  if (cargando) return <Cargando texto="Calculando…" alto="min-h-[60vh]" />
  if (error) return <Aviso>{error}</Aviso>

  const { ventas, ordenes, productos, ventasDetalle } = datos

  const facturado = ventas.reduce((a, v) => a + Number(v.total), 0)
  const ticket = ventas.length ? facturado / ventas.length : 0
  const inventario = productos.reduce((a, p) => a + p.stock * Number(p.costo), 0)
  const inventarioCubiertas = productos
    .filter((p) => p.categoria === 'Cubierta')
    .reduce((a, p) => a + p.stock * Number(p.costo), 0)
  const inventarioRepuestos = productos
    .filter((p) => p.categoria === 'Repuesto')
    .reduce((a, p) => a + p.stock * Number(p.costo), 0)
  const entregadas = ordenes.filter((o) => o.estado === 'entregada').length
  const unidadesVendidas = datos.ventasDetalle.reduce((a, item) => a + item.cantidad, 0)
  const articlesPorVenta = ventas.length ? unidadesVendidas / ventas.length : 0

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

  const porMecanico = agrupar(ordenes, (o) => o.perfiles?.nombre).sort(
    (a, b) => b.cantidad - a.cantidad
  )

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
      ['Unidades vendidas', numero(unidadesVendidas)],
      ['Artículos por venta', numero(articlesPorVenta.toFixed(2))],
      ['Órdenes entregadas', numero(entregadas)],
      ['Valor de inventario', plata(inventario)],
      ['Inventario cubiertas', plata(inventarioCubiertas)],
      ['Inventario repuestos', plata(inventarioRepuestos)],
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
    const texto = `Reporte de gestión:\nFacturado: ${plata(facturado)}\nTicket promedio: ${plata(ticket)}\nÓrdenes entregadas: ${numero(entregadas)}\nValor de inventario: ${plata(inventario)}`

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
      <div className="mb-6 flex gap-1 rounded-md border border-concreto-200 bg-white p-1 w-fit">
        {periodos.map((p) => (
          <button
            key={p.dias}
            onClick={() => setDias(p.dias)}
            className={`rounded px-3 py-1.5 text-sm font-medium transition-colors ${
              dias === p.dias
                ? 'bg-perez-600 text-white'
                : 'text-acero-500 hover:bg-concreto-100 hover:text-caucho-800'
            }`}
          >
            {p.texto}
          </button>
        ))}
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Metrica icono={Receipt} tono="marca" titulo="Facturado" valor={plata(facturado)} pie={`${ventas.length} ventas confirmadas`} />
        <Metrica icono={Wallet} titulo="Ticket promedio" valor={plata(ticket)} pie="Por venta confirmada" />
        <Metrica icono={ClipboardList} tono="conforme" titulo="Órdenes entregadas" valor={numero(entregadas)} pie={`De ${ordenes.length} creadas`} />
        <Metrica icono={Boxes} titulo="Valor de inventario" valor={plata(inventario)} pie="Stock actual a costo" />
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
                <CartesianGrid stroke="#E5E7E2" vertical={false} />
                <XAxis dataKey="dia" {...ejeComun} interval="preserveStartEnd" minTickGap={24} />
                <YAxis {...ejeComun} width={64} tickFormatter={(v) => numero(v)} />
                <TooltipRecharts
                  cursor={{ stroke: '#AEB6C0' }}
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
              <CartesianGrid stroke="#E5E7E2" horizontal={false} />
              <XAxis type="number" {...ejeComun} tickFormatter={(v) => numero(v)} />
              <YAxis type="category" dataKey="nombre" {...ejeComun} width={110} />
              <TooltipRecharts cursor={{ fill: '#F2F3F0' }} content={<Tooltip formato={plata} />} />
              <Bar dataKey="total" fill={MARCA} barSize={24} radius={[0, 4, 4, 0]} />
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
              <CartesianGrid stroke="#E5E7E2" horizontal={false} />
              <XAxis type="number" {...ejeComun} allowDecimals={false} />
              <YAxis type="category" dataKey="nombre" {...ejeComun} width={110} />
              <TooltipRecharts cursor={{ fill: '#F2F3F0' }} content={<Tooltip formato={numero} />} />
              <Bar dataKey="cantidad" fill={MARCA} barSize={24} radius={[0, 4, 4, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </PanelGrafico>
      </div>
    </>
  )
}
