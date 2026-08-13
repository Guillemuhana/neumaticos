import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Check, FileText, Plus, Receipt, Trash2, Wrench } from 'lucide-react'
import { useAuth } from '../context/AuthProvider'
import { useConsulta } from '../hooks/useConsulta'
import { supabase } from '../lib/supabase'
import { fecha, plata } from '../lib/formato'
import { estadoDe } from '../lib/fiscal'
import { nombreVehiculo } from '../lib/vehiculos'
import BuscadorCliente from '../components/clientes/BuscadorCliente'
import SelectorVehiculo, { asegurarVehiculo } from '../components/clientes/SelectorVehiculo'
import {
  Aviso,
  Boton,
  Campo,
  Cargando,
  Encabezado,
  Etiqueta,
  Modal,
  Tabla,
  Tarjeta,
  Vacio,
  estiloInput,
} from '../components/UI'

const tonoEstado = { cotizacion: 'neutro', confirmada: 'conforme', anulada: 'atencion' }
const textoEstado = { cotizacion: 'Cotización', confirmada: 'Confirmada', anulada: 'Anulada' }

export default function Ventas() {
  const navigate = useNavigate()
  const [creando, setCreando] = useState(false)
  const [confirmando, setConfirmando] = useState(null)
  const [aprobando, setAprobando] = useState(null)
  const [aviso, setAviso] = useState('')

  /* Los comprobantes vienen aparte y se cruzan acá: la venta y el comprobante
     no comparten tabla, y `comprobantes` la lee solo administración. Las
     órdenes, por lo mismo: la cotización aprobada tiene un auto en el taller
     del otro lado, y desde acá se llega a él. */
  const { datos, cargando, error, recargar } = useConsulta(async () => {
    const [ventas, comprobantes, ordenes] = await Promise.all([
      supabase
        .from('ventas')
        .select('*, clientes(nombre), perfiles(nombre), vehiculos(marca, modelo, anio, patente), venta_items(cantidad)')
        .order('creada_en', { ascending: false })
        .limit(100),
      supabase.from('comprobantes').select('venta_id, estado'),
      supabase.from('ordenes').select('id, cotizacion_id, estado').not('cotizacion_id', 'is', null),
    ])

    const fallo = ventas.error || comprobantes.error || ordenes.error
    if (fallo) return { error: fallo }

    const porVenta = new Map(comprobantes.data.map((c) => [c.venta_id, c]))
    const porCotizacion = new Map(ordenes.data.map((o) => [o.cotizacion_id, o]))

    return {
      data: ventas.data.map((v) => ({
        ...v,
        comprobante: porVenta.get(v.id) ?? null,
        orden: porCotizacion.get(v.id) ?? null,
      })),
    }
  }, [])

  /* Aprobar es mandar el auto al taller con el trabajo ya acordado. La base
     hace la orden, le copia los renglones y sella quién aprobó, todo junto;
     acá solo queda llevar al usuario a la orden recién abierta. */
  const aprobar = async (datosDelTaller) => {
    setAviso('')
    const { data, error } = await supabase.rpc('aprobar_cotizacion', {
      p_venta: aprobando.id,
      p_mecanico: datosDelTaller.mecanico_id || null,
      p_kilometraje: datosDelTaller.kilometraje === '' ? null : Number(datosDelTaller.kilometraje),
      p_falla: datosDelTaller.falla_reportada || null,
      p_notas: datosDelTaller.notas || null,
    })

    setAprobando(null)
    if (error) return setAviso(error.message)
    navigate('/taller', { state: { orden: data } })
  }

  /* El error va al cartel de la pantalla y no a un `alert` del navegador: el
     diálogo del sistema frena todo, se ve de otra época y encima aparece con
     tipografía y botones que no son los de la app. */
  const cambiarEstado = async (venta, estado, medioPago = null) => {
    setAviso('')
    /* El medio de pago se guarda solo al confirmar: en una cotización todavía
       no se cobró nada, y es lo que después deja separar el efectivo del cajón
       al cerrar la caja. */
    const cambios = medioPago ? { estado, medio_pago: medioPago } : { estado }
    const { error } = await supabase.from('ventas').update(cambios).eq('id', venta.id)
    if (error) setAviso(error.message)
    setConfirmando(null)
    recargar()
  }

  /* Arma el comprobante y deja al usuario en Facturación, que es donde se
     carga el CAE: facturar sin ir a ARCA a continuación no sirve de nada. */
  const facturar = async (venta) => {
    setAviso('')
    const { error } = await supabase.rpc('facturar_venta', { p_venta: venta.id })
    if (error) return setAviso(error.message)
    navigate('/facturacion')
  }

  return (
    <>
      <Encabezado titulo="Ventas" detalle="Cotizaciones y comprobantes del local.">
        <Boton onClick={() => setCreando(true)}>
          <Plus size={16} /> Nueva venta
        </Boton>
      </Encabezado>

      {error && <Aviso>{error}</Aviso>}
      <Aviso>{aviso}</Aviso>

      <Tarjeta>
        {cargando ? (
          <Cargando texto="Buscando ventas…" alto="min-h-[40vh]" />
        ) : !datos?.length ? (
          <Vacio icono={Receipt} titulo="Todavía no hay ventas" detalle="Cargá la primera desde «Nueva venta»." />
        ) : (
          <Tabla
            columnas={['Fecha', 'Cliente', 'Vendedor', 'Ítems', 'Total', 'Estado', 'Comprobante', '']}
          >
            {datos.map((v) => (
              <tr key={v.id} className="hover:bg-concreto-50 rounded-xl bg-white shadow-sm sm:bg-transparent sm:shadow-none">
                <td data-label="Fecha" className="px-4 py-3 whitespace-nowrap text-acero-500">
                  {fecha(v.creada_en)}
                </td>
                <td data-label="Cliente" className="px-4 py-3 font-medium">
                  {v.clientes?.nombre ?? 'Consumidor final'}
                  {v.vehiculos && (
                    <span className="block text-xs font-normal text-acero-500">
                      {nombreVehiculo(v.vehiculos)}
                      {v.vehiculos.patente ? ` · ${v.vehiculos.patente}` : ''}
                    </span>
                  )}
                </td>
                <td data-label="Vendedor" className="px-4 py-3 text-acero-500">
                  {v.perfiles?.nombre ?? '—'}
                </td>
                <td data-label="Ítems" className="px-4 py-3 font-mono">
                  {v.venta_items?.length ?? 0}
                </td>
                <td data-label="Total" className="px-4 py-3 font-semibold tabular-nums">
                  {plata(v.total)}
                </td>
                <td data-label="Estado" className="px-4 py-3">
                  {/* Una cotización aprobada sigue siendo una cotización para
                      la base —se cobra al entregar el auto, no acá—, pero en
                      la lista tiene que leerse como lo que es: un trabajo que
                      ya está en el taller. */}
                  {v.aprobada_en ? (
                    <Etiqueta tono="marca">En el taller</Etiqueta>
                  ) : (
                    <Etiqueta tono={tonoEstado[v.estado]}>{textoEstado[v.estado]}</Etiqueta>
                  )}
                </td>
                <td data-label="Comprobante" className="px-4 py-3">
                  {v.comprobante ? (
                    <Etiqueta tono={estadoDe(v.comprobante.estado).tono}>
                      {estadoDe(v.comprobante.estado).texto}
                    </Etiqueta>
                  ) : (
                    <span className="text-acero-500">—</span>
                  )}
                </td>
                <td data-label="Acciones" className="px-4 py-3 text-right">
                  {/* El auto ya está adentro: lo único que queda por hacer con
                      esta cotización es ir a mirar cómo viene el trabajo. */}
                  {v.orden && (
                    <Boton
                      variante="fantasma"
                      className="px-2 py-1"
                      onClick={() => navigate('/taller', { state: { orden: v.orden.id } })}
                    >
                      <Wrench size={15} /> Ver la orden
                    </Boton>
                  )}

                  {/* Aprobar es para el trabajo que se hace sobre un auto; una
                      venta de mostrador no pasa por el taller y se cobra acá
                      nomás. Lo que separa una de otra es el vehículo. */}
                  {v.estado === 'cotizacion' && !v.aprobada_en && v.vehiculo_id && (
                    <Boton variante="fantasma" className="px-2 py-1" onClick={() => setAprobando(v)}>
                      <Wrench size={15} /> Aprobar y enviar al taller
                    </Boton>
                  )}

                  {v.estado === 'cotizacion' && !v.aprobada_en && (
                    <Boton variante="fantasma" className="px-2 py-1" onClick={() => setConfirmando(v)}>
                      <Check size={15} /> Confirmar
                    </Boton>
                  )}
                  {v.estado === 'confirmada' && !v.comprobante && (
                    <Boton variante="fantasma" className="px-2 py-1" onClick={() => facturar(v)}>
                      <FileText size={15} /> Facturar
                    </Boton>
                  )}
                  {/* Una venta ya facturada ante ARCA no se anula acá: hay un
                      comprobante con CAE dando vueltas, y eso se revierte con
                      una nota de crédito, que todavía no está. */}
                  {v.estado === 'confirmada' && v.comprobante?.estado !== 'emitido' && (
                    <Boton variante="fantasma" className="px-2 py-1" onClick={() => cambiarEstado(v, 'anulada')}>
                      Anular
                    </Boton>
                  )}
                </td>
              </tr>
            ))}
          </Tabla>
        )}
      </Tarjeta>

      {aprobando && (
        <AprobarCotizacion
          venta={aprobando}
          onCerrar={() => setAprobando(null)}
          onAprobar={aprobar}
        />
      )}

      {confirmando && (
        <CobrarVenta
          venta={confirmando}
          onCerrar={() => setConfirmando(null)}
          onConfirmar={(medio) => cambiarEstado(confirmando, 'confirmada', medio)}
        />
      )}

      {creando && (
        <NuevaVenta
          onCerrar={() => setCreando(false)}
          onGuardada={() => {
            setCreando(false)
            recargar()
          }}
        />
      )}
    </>
  )
}

function NuevaVenta({ onCerrar, onGuardada }) {
  const { sesion, rol } = useAuth()
  const [cliente, setCliente] = useState(null)
  /* El auto es opcional y es lo que decide de qué se trata la venta: con
     vehículo es un trabajo que puede ir al taller, sin vehículo es mostrador.
     Cuál de los dos es lo dice `id`: uno de los suyos o uno nuevo a medio
     cargar. */
  const [vehiculo, setVehiculo] = useState(null)
  const [notas, setNotas] = useState('')
  const [items, setItems] = useState([])
  const [vendedorId, setVendedorId] = useState(rol === 'vendedor' ? sesion.user.id : '')
  const [error, setError] = useState('')
  const [guardando, setGuardando] = useState(false)

  const { datos: productos } = useConsulta(
    () => supabase.from('productos').select('id, marca, medida, precio, stock').eq('activo', true).order('marca'),
    []
  )
  const { datos: vendedores } = useConsulta(
    () =>
      supabase
        .from('perfiles')
        .select('id, nombre')
        .eq('rol', 'vendedor')
        .eq('activo', true)
        .order('nombre'),
    []
  )

  const agregar = (producto) =>
    setItems((prev) =>
      prev.some((i) => i.producto_id === producto.id)
        ? prev.map((i) => (i.producto_id === producto.id ? { ...i, cantidad: i.cantidad + 1 } : i))
        : [
            ...prev,
            {
              producto_id: producto.id,
              nombre: `${producto.marca} ${producto.medida}`,
              precio_unitario: Number(producto.precio),
              cantidad: 1,
              stock: producto.stock,
            },
          ]
    )

  const total = items.reduce((a, i) => a + i.cantidad * i.precio_unitario, 0)

  const guardar = async (e) => {
    e.preventDefault()
    if (items.length === 0) return setError('Agregá al menos un artículo.')
    if (rol === 'gerencia' && !vendedorId) return setError('Elegí un vendedor para la venta.')

    setGuardando(true)

    /* El auto que entra por primera vez se da de alta acá y queda del cliente,
       igual que en la recepción: la próxima visita ya sale en la lista. */
    let vehiculo_id = null
    if (cliente && vehiculo) {
      const alta = await asegurarVehiculo(cliente, vehiculo)
      if (alta.error) {
        setError(alta.error)
        return setGuardando(false)
      }
      vehiculo_id = alta.vehiculo.id
    }

    const { data: venta, error: errVenta } = await supabase
      .from('ventas')
      .insert({
        cliente_id: cliente?.id ?? null,
        vehiculo_id,
        vendedor_id: rol === 'gerencia' ? vendedorId : sesion.user.id,
        notas: notas.trim() || null,
      })
      .select('id')
      .single()

    if (errVenta) {
      setError(errVenta.message)
      return setGuardando(false)
    }

    const { error: errItems } = await supabase.from('venta_items').insert(
      items.map((i) => ({
        venta_id: venta.id,
        producto_id: i.producto_id,
        cantidad: i.cantidad,
        precio_unitario: i.precio_unitario,
      }))
    )

    if (errItems) {
      setError(errItems.message)
      return setGuardando(false)
    }

    onGuardada()
  }

  return (
    <Modal titulo="Nueva venta" onCerrar={onCerrar}>
      <form onSubmit={guardar} className="space-y-4">
        <Campo etiqueta="Cliente">
          <BuscadorCliente
            cliente={cliente}
            opcional
            onElegir={(c) => {
              setCliente(c)
              /* Cambiar de cliente tiene que soltar el auto: si no, la
                 cotización saldría con el vehículo del cliente anterior. */
              setVehiculo(null)
            }}
          />
        </Campo>

        {/* El auto solo tiene sentido con un cliente detrás, y es lo que
            después deja mandar el trabajo al taller. Una venta de mostrador
            no lo necesita, así que no se pide. */}
        {cliente && (
          <Campo
            etiqueta="Vehículo"
            ayuda="Solo si el trabajo es sobre un auto. Es lo que permite mandarlo al taller cuando el cliente apruebe."
          >
            <SelectorVehiculo cliente={cliente} vehiculo={vehiculo} onElegir={setVehiculo} />
          </Campo>
        )}

        {rol === 'gerencia' && (
          <Campo etiqueta="Vendedor" ayuda="Elegí quién registró la venta.">
            <select
              className={estiloInput}
              value={vendedorId}
              onChange={(e) => setVendedorId(e.target.value)}
            >
              <option value="">Elegí un vendedor…</option>
              {vendedores?.map((v) => (
                <option key={v.id} value={v.id}>
                  {v.nombre}
                </option>
              ))}
            </select>
          </Campo>
        )}

        <Campo etiqueta="Agregar artículo">
          <select
            className={estiloInput}
            value=""
            onChange={(e) => {
              const p = productos?.find((x) => x.id === e.target.value)
              if (p) agregar(p)
            }}
          >
            <option value="">Elegí un artículo…</option>
            {productos?.map((p) => (
              <option key={p.id} value={p.id}>
                {p.marca} {p.medida} — {plata(p.precio)} (stock {p.stock})
              </option>
            ))}
          </select>
        </Campo>

        {items.length > 0 && (
          <ul className="divide-y divide-concreto-200 rounded-md border border-concreto-200">
            {items.map((i) => (
              <li key={i.producto_id} className="flex items-center gap-3 p-3">
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{i.nombre}</p>
                  <p className="font-mono text-xs text-acero-500">{plata(i.precio_unitario)} c/u</p>
                </div>
                <input
                  type="number"
                  min="1"
                  className="w-16 rounded border border-acero-200 px-2 py-1 text-sm"
                  value={i.cantidad}
                  onChange={(e) =>
                    setItems((prev) =>
                      prev.map((x) =>
                        x.producto_id === i.producto_id
                          ? { ...x, cantidad: Math.max(1, Number(e.target.value)) }
                          : x
                      )
                    )
                  }
                />
                <Boton
                  type="button"
                  variante="fantasma"
                  className="px-2 py-1"
                  aria-label={`Quitar ${i.nombre}`}
                  onClick={() =>
                    setItems((prev) => prev.filter((x) => x.producto_id !== i.producto_id))
                  }
                >
                  <Trash2 size={15} />
                </Boton>
              </li>
            ))}
          </ul>
        )}

        {items.some((i) => i.cantidad > i.stock) && (
          <Aviso tono="atencion">
            Hay ítems con cantidad mayor al stock. Se puede cotizar igual, pero al confirmar el
            stock queda en negativo.
          </Aviso>
        )}

        <Campo etiqueta="Notas">
          <input className={estiloInput} value={notas} onChange={(e) => setNotas(e.target.value)} />
        </Campo>

        <div className="flex items-center justify-between border-t border-concreto-200 pt-4">
          <span className="text-sm text-acero-500">Total</span>
          <span className="display text-xl font-bold tabular-nums">{plata(total)}</span>
        </div>

        <Aviso>{error}</Aviso>

        <div className="flex justify-end gap-2">
          <Boton type="button" variante="secundario" onClick={onCerrar}>
            Cancelar
          </Boton>
          <Boton type="submit" disabled={guardando}>
            {guardando ? 'Guardando…' : 'Guardar cotización'}
          </Boton>
        </div>
      </form>
    </Modal>
  )
}

/* El cliente dijo que sí. Lo que falta para que el auto entre al taller es lo
   mismo que se pregunta en la recepción, porque esto *es* la recepción: en
   qué kilometraje viene, qué dijo que le pasa y quién lo va a atender.

   El mecánico se puede dejar sin asignar —a veces el auto se deja y recién a
   la tarde se sabe quién lo agarra—, pero el trabajo no arranca sin él. */
function AprobarCotizacion({ venta, onCerrar, onAprobar }) {
  const [form, setForm] = useState({
    mecanico_id: '',
    kilometraje: '',
    falla_reportada: '',
    notas: '',
  })
  const [guardando, setGuardando] = useState(false)

  const { datos: mecanicos } = useConsulta(
    () =>
      supabase
        .from('equipo')
        .select('id, nombre')
        .eq('rol', 'mecanico')
        .eq('activo', true)
        .order('nombre'),
    []
  )

  const campo = (k) => ({
    value: form[k],
    onChange: (e) => setForm({ ...form, [k]: e.target.value }),
  })

  return (
    <Modal titulo="Aprobar y enviar al taller" onCerrar={onCerrar}>
      <div className="space-y-4">
        <p className="text-sm text-acero-500">
          {venta.clientes?.nombre} · {nombreVehiculo(venta.vehiculos)}
          {venta.vehiculos?.patente ? ` · ${venta.vehiculos.patente}` : ''} ·{' '}
          <span className="font-semibold text-caucho-900">{plata(venta.total)}</span>
        </p>

        <Campo etiqueta="Kilometraje">
          <input type="number" min="0" className={estiloInput} placeholder="82000" {...campo('kilometraje')} />
        </Campo>

        <Campo
          etiqueta="Qué pide el cliente"
          ayuda="Si lo dejás vacío, la orden arranca con las notas de la cotización."
        >
          <textarea rows={2} className={estiloInput} {...campo('falla_reportada')} />
        </Campo>

        <Campo etiqueta="Mecánico asignado">
          <select className={estiloInput} {...campo('mecanico_id')}>
            <option value="">Sin asignar</option>
            {mecanicos?.map((m) => (
              <option key={m.id} value={m.id}>
                {m.nombre}
              </option>
            ))}
          </select>
        </Campo>

        <Campo etiqueta="Notas de recepción">
          <input className={estiloInput} placeholder="Entrega llave de rueda" {...campo('notas')} />
        </Campo>

        <p className="text-xs text-acero-500">
          Se abre la orden con los ítems de la cotización ya cargados como plan de trabajo. El
          stock y el cobro se mueven al entregar el vehículo, no ahora.
        </p>

        <div className="flex justify-end gap-2">
          <Boton variante="secundario" onClick={onCerrar} disabled={guardando}>
            Cancelar
          </Boton>
          <Boton
            onClick={() => {
              setGuardando(true)
              onAprobar(form)
            }}
            disabled={guardando}
          >
            {guardando ? 'Abriendo la orden…' : 'Aprobar y enviar al taller'}
          </Boton>
        </div>
      </div>
    </Modal>
  )
}

/* Confirmar una venta es cobrarla: ahí se descuenta el stock y ahí se sabe con
   qué pagó el cliente. Preguntarlo acá y no en Facturación es lo que permite
   que el cierre de caja separe el efectivo del cajón de lo que entró por
   transferencia. */
const MEDIOS_PAGO = ['Efectivo', 'Transferencia', 'Débito', 'Crédito', 'Cuenta corriente']

function CobrarVenta({ venta, onCerrar, onConfirmar }) {
  const [medio, setMedio] = useState(venta.medio_pago ?? 'Efectivo')
  const [guardando, setGuardando] = useState(false)

  return (
    <Modal titulo="Confirmar venta" onCerrar={onCerrar}>
      <div className="space-y-4">
        <p className="text-sm text-acero-500">
          {venta.clientes?.nombre ?? 'Consumidor final'} ·{' '}
          <span className="font-semibold text-caucho-900">{plata(venta.total)}</span>
        </p>

        <Campo etiqueta="Medio de pago">
          <select className={estiloInput} value={medio} onChange={(e) => setMedio(e.target.value)}>
            {MEDIOS_PAGO.map((m) => (
              <option key={m} value={m}>
                {m}
              </option>
            ))}
          </select>
        </Campo>

        <p className="text-xs text-acero-500">
          Al confirmar se descuenta el stock de los artículos. Hasta ahora no se movió nada.
        </p>

        <div className="flex justify-end gap-2">
          <Boton variante="secundario" onClick={onCerrar} disabled={guardando}>
            Cancelar
          </Boton>
          <Boton
            onClick={() => {
              setGuardando(true)
              onConfirmar(medio)
            }}
            disabled={guardando}
          >
            {guardando ? 'Confirmando…' : 'Confirmar y cobrar'}
          </Boton>
        </div>
      </div>
    </Modal>
  )
}
