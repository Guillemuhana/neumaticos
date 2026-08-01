import { AlertTriangle, ClipboardList, Package, Plus, Receipt, TrendingUp } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthProvider'
import { useConsulta } from '../hooks/useConsulta'
import { supabase } from '../lib/supabase'
import { plata } from '../lib/formato'
import { Aviso, Boton, Cargando, Encabezado, Metrica, Tarjeta } from '../components/UI'

const inicioDelDia = () => {
  const d = new Date()
  d.setHours(0, 0, 0, 0)
  return d.toISOString()
}

export default function Inicio() {
  const navigate = useNavigate()
  const { perfil, rol } = useAuth()

  const { datos, cargando, error } = useConsulta(async () => {
    const desde = inicioDelDia()

    const [ventas, bajoStock, ordenes] = await Promise.all([
      supabase
        .from('ventas')
        .select('total, estado, creada_en')
        .eq('estado', 'confirmada')
        .gte('creada_en', desde),
      supabase.from('productos').select('id, marca, medida, stock, stock_minimo').eq('activo', true),
      supabase.from('ordenes').select('id, estado'),
    ])

    const primerError = ventas.error || bajoStock.error || ordenes.error
    if (primerError) return { error: primerError }

    return {
      data: {
        ventasHoy: ventas.data,
        criticos: bajoStock.data.filter((p) => p.stock <= p.stock_minimo),
        ordenes: ordenes.data,
      },
    }
  }, [])

  if (cargando) return <Cargando texto="Armando el panel…" alto="min-h-[60vh]" />
  if (error) return <Aviso>{error}</Aviso>

  const facturado = datos.ventasHoy.reduce((a, v) => a + Number(v.total), 0)
  /* Todo lo que entró y todavía no salió: mientras no esté entregada, el
     vehículo sigue en el taller aunque nadie le esté poniendo las manos. */
  const abiertas = datos.ordenes.filter((o) => o.estado !== 'entregada')
  const esperandoPlan = datos.ordenes.filter((o) => o.estado === 'recepcion')

  return (
    <>
      <Encabezado
        titulo={`Hola, ${perfil?.nombre?.split(' ')[0] ?? ''}`}
        detalle="Lo que está pasando hoy en el local."
      >
        {/* Todo empieza cuando entra un cliente: el arranque del circuito va
            acá, en la primera pantalla, y no escondido dentro de Taller. */}
        {rol !== 'mecanico' && (
          <Boton onClick={() => navigate('/taller', { state: { nueva: true } })}>
            <Plus size={16} /> Nueva orden de trabajo
          </Boton>
        )}
      </Encabezado>

      <div className="cascada grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Metrica
          icono={Receipt}
          tono="marca"
          titulo="Facturado hoy"
          valor={plata(facturado)}
          pie={`${datos.ventasHoy.length} venta(s) confirmada(s)`}
          onClick={() => navigate('/ventas')}
          className="cursor-pointer"
        />
        <Metrica
          icono={ClipboardList}
          titulo="Vehículos en taller"
          valor={abiertas.length}
          pie={
            esperandoPlan.length
              ? `${esperandoPlan.length} esperando presupuesto`
              : 'Órdenes sin entregar'
          }
          tono={esperandoPlan.length ? 'atencion' : 'neutro'}
          onClick={() => navigate('/taller')}
          className="cursor-pointer"
        />
        <Metrica
          icono={Package}
          titulo="Órdenes terminadas"
          valor={datos.ordenes.filter((o) => o.estado === 'terminada').length}
          tono="conforme"
          pie="Listas para entregar"
          onClick={() => navigate('/taller')}
          className="cursor-pointer"
        />
        <Metrica
          icono={AlertTriangle}
          tono={datos.criticos.length ? 'atencion' : 'neutro'}
          titulo="Stock crítico"
          valor={datos.criticos.length}
          pie="Artículos en el mínimo o debajo"
          onClick={() => navigate('/stock')}
          className="cursor-pointer"
        />
      </div>

      {datos.criticos.length > 0 && rol !== 'mecanico' && (
        <Tarjeta className="mt-6 p-5">
          <div className="mb-3 flex items-center gap-2">
            <TrendingUp size={18} className="text-atencion-600" aria-hidden="true" />
            <h2 className="display font-bold">Hay que reponer</h2>
          </div>
          <ul className="divide-y divide-concreto-200">
            {datos.criticos.slice(0, 6).map((p) => (
              <li key={p.id} className="flex items-center justify-between py-2 text-sm">
                <span>
                  {p.marca} <span className="font-mono text-acero-500">{p.medida}</span>
                </span>
                <span className="font-mono font-semibold text-atencion-600">
                  {p.stock} / mín {p.stock_minimo}
                </span>
              </li>
            ))}
          </ul>
        </Tarjeta>
      )}
    </>
  )
}
