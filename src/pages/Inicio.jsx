import { useState } from 'react'
import {
  AlertTriangle,
  BellRing,
  ClipboardList,
  HandCoins,
  Package,
  Plus,
  Receipt,
  ShieldAlert,
  TrendingUp,
  Wrench,
} from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthProvider'
import { useConsulta } from '../hooks/useConsulta'
import { supabase } from '../lib/supabase'
import { fechaCorta, hora, numero, plata } from '../lib/formato'
import { etapaDe } from '../lib/taller'
import {
  Aviso,
  Boton,
  Campo,
  Cargando,
  Encabezado,
  Etiqueta,
  Metrica,
  Tabla,
  Tarjeta,
  Vacio,
  estiloInput,
} from '../components/UI'

/* La primera pantalla no es la misma para los tres puestos, porque el día no
   empieza igual: gerencia mira el local, el vendedor mira lo que vendió y el
   mecánico mira lo que tiene para hacer. Una pantalla común obligaba a cada
   uno a saltearse dos tercios de lo que ve.

   Lo que no cambia es de dónde salen los números: RLS ya devuelve las ventas
   propias al vendedor y las de todos a gerencia, así que la misma consulta
   dice lo correcto para cada uno sin un `if` de por medio. */

const inicioDelDia = () => {
  const d = new Date()
  d.setHours(0, 0, 0, 0)
  return d.toISOString()
}

const inicioDelMes = () => {
  const d = new Date()
  d.setDate(1)
  d.setHours(0, 0, 0, 0)
  return d.toISOString()
}

export default function Inicio() {
  const { perfil, rol } = useAuth()
  const navigate = useNavigate()

  return (
    <>
      <Encabezado
        titulo={`Hola, ${perfil?.nombre?.split(' ')[0] ?? ''}`}
        detalle={
          rol === 'mecanico'
            ? 'Lo que tenés en el taller.'
            : rol === 'vendedor'
              ? 'Cómo viene tu día.'
              : 'Lo que está pasando hoy en el local.'
        }
      >
        {/* Todo empieza cuando entra un cliente: el arranque del circuito va
            acá, en la primera pantalla, y no escondido dentro de Taller. */}
        {rol !== 'mecanico' && (
          <Boton onClick={() => navigate('/taller', { state: { nueva: true } })}>
            <Plus size={16} /> Nueva orden de trabajo
          </Boton>
        )}
      </Encabezado>

      {rol === 'mecanico' ? <DiaMecanico /> : rol === 'vendedor' ? <DiaVendedor /> : <PanelLocal />}
    </>
  )
}

/* ------------------------------------------------------------- vendedor */

function DiaVendedor() {
  const { perfil } = useAuth()
  const navigate = useNavigate()

  const { datos, cargando, error, recargar } = useConsulta(async () => {
    const [hoy, mes, recordatorios] = await Promise.all([
      supabase
        .from('ventas')
        .select('id, total, creada_en, clientes(nombre)')
        .eq('estado', 'confirmada')
        .gte('creada_en', inicioDelDia())
        .order('creada_en', { ascending: false }),
      supabase
        .from('ventas')
        .select('total')
        .eq('estado', 'confirmada')
        .gte('creada_en', inicioDelMes()),
      /* RLS ya devuelve solo los propios: la agenda de otro no le sirve a
         nadie más que a esa persona. */
      supabase
        .from('recordatorios')
        .select('*, clientes(nombre)')
        .eq('hecho', false)
        .order('para', { nullsFirst: false }),
    ])

    const fallo = hoy.error || mes.error || recordatorios.error
    if (fallo) return { error: fallo }

    return { data: { hoy: hoy.data, mes: mes.data, recordatorios: recordatorios.data } }
  }, [])

  if (cargando) return <Cargando texto="Armando tu día…" alto="min-h-[40vh]" />
  if (error) return <Aviso>{error}</Aviso>

  const pct = Number(perfil?.comision_pct ?? 0)
  const vendidoHoy = datos.hoy.reduce((a, v) => a + Number(v.total), 0)
  const vendidoMes = datos.mes.reduce((a, v) => a + Number(v.total), 0)

  return (
    <>
      <div className="cascada grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Metrica icono={Receipt} tono="marca" titulo="Vendido hoy" valor={plata(vendidoHoy)} pie={`${datos.hoy.length} venta(s)`} />
        <Metrica
          icono={HandCoins}
          titulo="Comisión del día"
          valor={plata((vendidoHoy * pct) / 100)}
          pie={pct ? `${pct}% de lo vendido` : 'Sin porcentaje asignado'}
          onClick={() => navigate('/comisiones')}
          className="cursor-pointer"
        />
        <Metrica icono={TrendingUp} titulo="Vendido en el mes" valor={plata(vendidoMes)} pie={`${datos.mes.length} venta(s)`} />
        <Metrica
          icono={BellRing}
          tono={datos.recordatorios.length ? 'atencion' : 'neutro'}
          titulo="Recordatorios"
          valor={numero(datos.recordatorios.length)}
          pie="Pendientes tuyos"
        />
      </div>

      <section className="mt-6">
        <h2 className="display mb-3 text-base font-bold">Tus ventas de hoy</h2>
        <Tarjeta>
          {!datos.hoy.length ? (
            <Vacio
              icono={Receipt}
              titulo="Todavía no vendiste hoy"
              detalle="Las ventas confirmadas aparecen acá apenas se cierran."
            />
          ) : (
            <Tabla columnas={['Hora', 'Cliente', { texto: 'Monto', cifra: true }]}>
              {datos.hoy.map((v) => (
                <tr key={v.id} className="rounded-xl bg-white shadow-sm sm:bg-transparent sm:shadow-none">
                  <td data-label="Hora" className="px-4 py-2.5 text-acero-500">
                    {hora(v.creada_en)}
                  </td>
                  <td data-label="Cliente" className="px-4 py-2.5 font-medium">
                    {v.clientes?.nombre ?? 'Consumidor final'}
                  </td>
                  <td data-label="Monto" className="cifra px-4 py-2.5 font-semibold">
                    {plata(v.total)}
                  </td>
                </tr>
              ))}
            </Tabla>
          )}
        </Tarjeta>
      </section>

      <Recordatorios lista={datos.recordatorios} onCambio={recargar} />
    </>
  )
}

/* La agenda del mostrador: llamar a alguien, avisar que llegó un repuesto,
   recordar un service. Se carga desde acá porque es donde se mira, y no en una
   pantalla aparte a la que habría que acordarse de entrar. */
function Recordatorios({ lista, onCambio }) {
  const { sesion } = useAuth()
  const [tarea, setTarea] = useState('')
  const [para, setPara] = useState('')
  const [error, setError] = useState('')
  const [guardando, setGuardando] = useState(false)

  const agregar = async (e) => {
    e.preventDefault()
    if (!tarea.trim()) return

    setGuardando(true)
    setError('')
    const { error } = await supabase.from('recordatorios').insert({
      perfil_id: sesion.user.id,
      tarea: tarea.trim(),
      para: para || null,
    })

    if (error) setError(error.message)
    else {
      setTarea('')
      setPara('')
      onCambio()
    }
    setGuardando(false)
  }

  const marcar = async (r) => {
    const { error } = await supabase.from('recordatorios').update({ hecho: true }).eq('id', r.id)
    if (error) setError(error.message)
    else onCambio()
  }

  return (
    <section className="mt-6">
      <h2 className="display mb-3 text-base font-bold">Tus recordatorios</h2>
      <Tarjeta className="p-4">
        <Aviso>{error}</Aviso>

        <form onSubmit={agregar} className="mb-3 flex flex-wrap items-end gap-2">
          <div className="min-w-0 flex-1">
            <Campo etiqueta="Tarea">
              <input
                className={estiloInput}
                placeholder="Llamar a Gómez, llegaron las cubiertas"
                value={tarea}
                onChange={(e) => setTarea(e.target.value)}
              />
            </Campo>
          </div>
          <Campo etiqueta="Para el">
            <input
              type="date"
              className={estiloInput}
              value={para}
              onChange={(e) => setPara(e.target.value)}
            />
          </Campo>
          <Boton type="submit" disabled={guardando || !tarea.trim()}>
            <Plus size={15} /> Agregar
          </Boton>
        </form>

        {!lista.length ? (
          <p className="py-2 text-sm text-acero-500">No tenés nada pendiente.</p>
        ) : (
          <ul className="divide-y divide-concreto-200">
            {lista.map((r) => (
              <li key={r.id} className="flex items-center gap-3 py-2">
                <input
                  type="checkbox"
                  checked={false}
                  onChange={() => marcar(r)}
                  aria-label={`Marcar como hecho: ${r.tarea}`}
                  className="h-4 w-4 shrink-0 accent-perez-600"
                />
                <span className="min-w-0 flex-1 text-sm text-caucho-900">
                  {r.tarea}
                  {r.clientes?.nombre && (
                    <span className="text-acero-500"> · {r.clientes.nombre}</span>
                  )}
                </span>
                {r.para && (
                  <span className="shrink-0 text-xs text-acero-500">{fechaCorta(r.para)}</span>
                )}
              </li>
            ))}
          </ul>
        )}
      </Tarjeta>
    </section>
  )
}

/* ------------------------------------------------------------- mecánico */

function DiaMecanico() {
  const { perfil, sesion } = useAuth()
  const navigate = useNavigate()

  const { datos, cargando, error } = useConsulta(async () => {
    const [mias, manoDeObra] = await Promise.all([
      supabase
        .from('ordenes')
        .select('id, vehiculo, patente, estado, creada_en, cerrada_en, falla_reportada, clientes(nombre)')
        .eq('mecanico_id', sesion.user.id)
        .order('creada_en', { ascending: false })
        .limit(100),
      /* La comisión sale de la mano de obra de lo entregado en el mes, igual
         que la calcula la base: si acá se contara el total de la orden, el
         número no coincidiría con el de la pantalla de Comisiones. */
      supabase
        .from('orden_items')
        .select('cantidad, precio_unitario, ordenes!inner(mecanico_id, estado, cerrada_en)')
        .eq('tipo', 'servicio')
        .eq('ordenes.mecanico_id', sesion.user.id)
        .eq('ordenes.estado', 'entregada')
        .gte('ordenes.cerrada_en', inicioDelMes()),
      /* Los trabajos propios que volvieron. Se filtra por el mecánico de la
         orden y no por quien cargó el reclamo: lo que importa es de quién era
         el trabajo que falló. */
      supabase
        .from('garantias')
        .select('id, motivo, creada_en, ordenes!inner(vehiculo, patente, mecanico_id, clientes(nombre))')
        .eq('estado', 'pendiente')
        .eq('ordenes.mecanico_id', sesion.user.id)
        .order('creada_en', { ascending: false }),
    ])

    const fallo = mias.error || manoDeObra.error || garantias.error
    if (fallo) return { error: fallo }

    return { data: { mias: mias.data, manoDeObra: manoDeObra.data, garantias: garantias.data } }
  }, [sesion.user.id])

  if (cargando) return <Cargando texto="Buscando tus trabajos…" alto="min-h-[40vh]" />
  if (error) return <Aviso>{error}</Aviso>

  const pct = Number(perfil?.comision_pct ?? 0)
  const abiertas = datos.mias.filter((o) => o.estado !== 'entregada')
  const enControl = abiertas.filter((o) => o.estado === 'control_calidad')
  const delMes = datos.mias.filter(
    (o) => o.estado === 'entregada' && o.cerrada_en && o.cerrada_en >= inicioDelMes()
  )
  const base = datos.manoDeObra.reduce((a, i) => a + Number(i.cantidad) * Number(i.precio_unitario), 0)

  return (
    <>
      <div className="cascada grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Metrica
          icono={Wrench}
          tono={abiertas.length ? 'atencion' : 'conforme'}
          titulo="Trabajos abiertos"
          valor={numero(abiertas.length)}
          pie="Órdenes tuyas sin entregar"
          onClick={() => navigate('/taller')}
          className="cursor-pointer"
        />
        <Metrica
          icono={ClipboardList}
          titulo="En control de calidad"
          valor={numero(enControl.length)}
          pie="Esperando la revisión"
          onClick={() => navigate('/taller')}
          className="cursor-pointer"
        />
        <Metrica
          icono={Package}
          tono="conforme"
          titulo="Entregados en el mes"
          valor={numero(delMes.length)}
          pie="Vehículos que salieron"
        />
        <Metrica
          icono={ShieldAlert}
          tono={datos.garantias.length ? 'atencion' : 'neutro'}
          titulo="Garantías pendientes"
          valor={numero(datos.garantias.length)}
          pie="Trabajos tuyos que volvieron"
        />
        <Metrica
          icono={HandCoins}
          titulo="Comisión del mes"
          valor={plata((base * pct) / 100)}
          pie={pct ? `${pct}% de la mano de obra` : 'Sin porcentaje asignado'}
          onClick={() => navigate('/comisiones')}
          className="cursor-pointer"
        />
      </div>

      <section className="mt-6">
        <h2 className="display mb-3 text-base font-bold">Lo que tenés en el taller</h2>
        <Tarjeta>
          {!abiertas.length ? (
            <Vacio
              icono={Wrench}
              titulo="No tenés trabajos abiertos"
              detalle="Cuando recepción te asigne una orden, va a aparecer acá."
            />
          ) : (
            <Tabla columnas={['Vehículo', 'Cliente', 'Problema', 'Estado']}>
              {abiertas.map((o) => (
                <tr
                  key={o.id}
                  onClick={() => navigate('/taller')}
                  className="cursor-pointer rounded-xl bg-white shadow-sm hover:bg-concreto-50 sm:bg-transparent sm:shadow-none"
                >
                  <td data-label="Vehículo" className="px-4 py-2.5 font-medium">
                    {o.vehiculo}
                    {o.patente && (
                      <span className="ml-2 font-mono text-xs uppercase text-acero-500">
                        {o.patente}
                      </span>
                    )}
                  </td>
                  <td data-label="Cliente" className="px-4 py-2.5 text-acero-500">
                    {o.clientes?.nombre ?? '—'}
                  </td>
                  <td data-label="Problema" className="max-w-xs truncate px-4 py-2.5 text-acero-500">
                    {o.falla_reportada ?? '—'}
                  </td>
                  <td data-label="Estado" className="px-4 py-2.5">
                    <Etiqueta tono={etapaDe(o.estado).tono}>{etapaDe(o.estado).texto}</Etiqueta>
                  </td>
                </tr>
              ))}
            </Tabla>
          )}
        </Tarjeta>
      </section>

      {datos.garantias.length > 0 && (
        <section className="mt-6">
          <h2 className="display mb-3 text-base font-bold">Garantías pendientes</h2>
          <Tarjeta>
            <Tabla columnas={['Vehículo', 'Cliente', 'Motivo']}>
              {datos.garantias.map((g) => (
                <tr
                  key={g.id}
                  className="rounded-xl bg-white shadow-sm sm:bg-transparent sm:shadow-none"
                >
                  <td data-label="Vehículo" className="px-4 py-2.5 font-medium">
                    {g.ordenes?.vehiculo}
                    {g.ordenes?.patente && (
                      <span className="ml-2 font-mono text-xs uppercase text-acero-500">
                        {g.ordenes.patente}
                      </span>
                    )}
                  </td>
                  <td data-label="Cliente" className="px-4 py-2.5 text-acero-500">
                    {g.ordenes?.clientes?.nombre ?? '—'}
                  </td>
                  <td data-label="Motivo" className="px-4 py-2.5">
                    {g.motivo}
                  </td>
                </tr>
              ))}
            </Tabla>
          </Tarjeta>
        </section>
      )}
    </>
  )
}

/* ------------------------------------------------------------- gerencia */

function PanelLocal() {
  const navigate = useNavigate()

  const { datos, cargando, error } = useConsulta(async () => {
    const [ventas, bajoStock, ordenes] = await Promise.all([
      supabase
        .from('ventas')
        .select('total, estado, creada_en')
        .eq('estado', 'confirmada')
        .gte('creada_en', inicioDelDia()),
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

  if (cargando) return <Cargando texto="Armando el panel…" alto="min-h-[40vh]" />
  if (error) return <Aviso>{error}</Aviso>

  const facturado = datos.ventasHoy.reduce((a, v) => a + Number(v.total), 0)
  /* Todo lo que entró y todavía no salió: mientras no esté entregada, el
     vehículo sigue en el taller aunque nadie le esté poniendo las manos. */
  const abiertas = datos.ordenes.filter((o) => o.estado !== 'entregada')
  const esperandoTaller = datos.ordenes.filter((o) => o.estado === 'pendiente')

  return (
    <>
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
            esperandoTaller.length
              ? `${esperandoTaller.length} sin empezar`
              : 'Órdenes sin entregar'
          }
          tono={esperandoTaller.length ? 'atencion' : 'neutro'}
          onClick={() => navigate('/taller')}
          className="cursor-pointer"
        />
        <Metrica
          icono={Package}
          titulo="Listos para entrega"
          valor={datos.ordenes.filter((o) => o.estado === 'terminada').length}
          tono="conforme"
          pie="Pasaron el control de calidad"
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

      {datos.criticos.length > 0 && (
        /* El banner de stock bajo que pidió el cliente: fondo rosa pálido y
           título en mayúsculas, separado de las tarjetas para que se lea como
           un aviso y no como un dato más. */
        <section className="mt-6 rounded-xl border border-atencion-100 bg-atencion-50 p-5">
          <div className="mb-3 flex items-center gap-2">
            <TrendingUp size={16} className="text-atencion-700" aria-hidden="true" />
            <h2 className="text-micro font-bold uppercase tracking-wider text-atencion-700">
              Reporte de stock
            </h2>
          </div>
          <p className="mb-3 text-sm text-caucho-900">
            {datos.criticos.length === 1
              ? 'Hay un artículo en el mínimo o por debajo.'
              : `Hay ${datos.criticos.length} artículos en el mínimo o por debajo.`}
          </p>
          <ul className="divide-y divide-atencion-100">
            {datos.criticos.slice(0, 6).map((p) => (
              <li key={p.id} className="flex items-center justify-between py-2 text-sm">
                <span>
                  {p.marca} <span className="font-mono text-acero-500">{p.medida}</span>
                </span>
                <span className="font-mono font-semibold text-atencion-700">
                  {p.stock} / mín {p.stock_minimo}
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}
    </>
  )
}
