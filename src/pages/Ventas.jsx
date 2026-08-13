import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { domAnimation, LazyMotion, m, useReducedMotion } from 'motion/react'
import { Camera, Check, FileText, Plus, Receipt, Search, Trash2, Wrench, X } from 'lucide-react'
import { useAuth } from '../context/AuthProvider'
import { useConsulta } from '../hooks/useConsulta'
import { supabase } from '../lib/supabase'
import { subirFotoDeOrden } from '../lib/fotos'
import { fecha, numero, plata } from '../lib/formato'
import { estadoDe } from '../lib/fiscal'
import { nombreVehiculo } from '../lib/vehiculos'
import BuscadorCliente from '../components/clientes/BuscadorCliente'
import SelectorVehiculo, { asegurarVehiculo } from '../components/clientes/SelectorVehiculo'
import {
  Aviso,
  Boton,
  Campo,
  Encabezado,
  Esqueleto,
  Etiqueta,
  Modal,
  Tabla,
  Tarjeta,
  Vacio,
  estiloInput,
} from '../components/UI'

const tonoEstado = { cotizacion: 'neutro', confirmada: 'conforme', anulada: 'atencion' }
const textoEstado = { cotizacion: 'Cotización', confirmada: 'Confirmada', anulada: 'Anulada' }

/* La venta no tiene un solo estado, tiene dos que se leen juntos: el de la
   tabla y el de si el auto ya está en el taller. Se resuelve una vez acá y no
   en cada lugar que necesita saberlo. */
const etapaDe = (v) => (v.aprobada_en ? 'taller' : v.estado)

/* La misma curva del resto del sistema. El movimiento acá es mucho más
   contenido que en el login: esta es una pantalla de trabajo, y lo único que
   se anima es la entrada de las filas, para que al filtrar se vea que la
   lista se rehízo y no que parpadeó. */
const SUAVE = [0.22, 1, 0.36, 1]

/* Los filtros son las cuatro respuestas a «qué estoy buscando», en el orden en
   que una venta las atraviesa. `todas` primero porque es donde se cae al
   entrar. */
const FILTROS = [
  { valor: 'todas', texto: 'Todas' },
  { valor: 'cotizacion', texto: 'Cotizaciones' },
  { valor: 'taller', texto: 'En el taller' },
  { valor: 'confirmada', texto: 'Confirmadas' },
]

export default function Ventas() {
  const navigate = useNavigate()
  const { sesion } = useAuth()
  const [creando, setCreando] = useState(false)
  const [confirmando, setConfirmando] = useState(null)
  const [aprobando, setAprobando] = useState(null)
  const [aviso, setAviso] = useState('')
  const [busqueda, setBusqueda] = useState('')
  const [filtro, setFiltro] = useState('todas')
  const quieto = useReducedMotion()

  /* Los comprobantes vienen aparte y se cruzan acá: la venta y el comprobante
     no comparten tabla, y `comprobantes` la lee solo administración. Las
     órdenes, por lo mismo: la cotización aprobada tiene un auto en el taller
     del otro lado, y desde acá se llega a él. */
  const { datos, cargando, error, recargar } = useConsulta(async () => {
    const [ventas, comprobantes, ordenes] = await Promise.all([
      supabase
        .from('ventas')
        /* El vendedor va por su clave y no por el nombre de la tabla: desde que
           la cotización sella quién la aprobó, `ventas` apunta dos veces a
           `perfiles` y pedir `perfiles(nombre)` a secas no devuelve la lista,
           devuelve un error. */
        .select(
          '*, clientes(nombre), perfiles!ventas_vendedor_id_fkey(nombre), vehiculos(marca, modelo, anio, patente), venta_items(cantidad)'
        )
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

  const ventas = datos ?? []

  /* Buscar por lo que uno tiene a mano cuando busca una venta: el nombre que
     dijo el cliente por teléfono, o la patente que le leyó al auto. */
  const porTexto = useMemo(() => {
    const q = busqueda.trim().toLowerCase()
    if (!q) return ventas
    return ventas.filter((v) =>
      [v.clientes?.nombre, v.perfiles?.nombre, nombreVehiculo(v.vehiculos), v.vehiculos?.patente, v.notas]
        .filter(Boolean)
        .some((campo) => campo.toLowerCase().includes(q))
    )
  }, [ventas, busqueda])

  /* Los conteos salen de lo que ya filtró el texto, no del total: si prometen
     doce cotizaciones y el buscador dejó dos, el número miente. */
  const conteos = useMemo(() => {
    const base = { todas: porTexto.length, cotizacion: 0, taller: 0, confirmada: 0 }
    for (const v of porTexto) {
      const etapa = etapaDe(v)
      if (etapa in base) base[etapa] += 1
    }
    return base
  }, [porTexto])

  const filtradas = useMemo(
    () => (filtro === 'todas' ? porTexto : porTexto.filter((v) => etapaDe(v) === filtro)),
    [porTexto, filtro]
  )

  /* Lo que le importa a quien abre la pantalla: cuánto hay ofrecido sin
     respuesta y cuánto ya se cerró. Van en el mismo renglón del título. */
  const resumen = useMemo(() => {
    const abiertas = ventas.filter((v) => v.estado === 'cotizacion' && !v.aprobada_en)
    return {
      abiertas: abiertas.length,
      ofrecido: abiertas.reduce((a, v) => a + Number(v.total ?? 0), 0),
      enTaller: ventas.filter((v) => v.aprobada_en).length,
    }
  }, [ventas])

  const hayFiltro = busqueda.trim() !== '' || filtro !== 'todas'

  /* Aprobar es mandar el auto al taller con el trabajo ya acordado. La base
     hace la orden, le copia los renglones y sella quién aprobó, todo junto;
     acá solo queda subir las fotos de cómo entró y llevar al usuario a la
     orden recién abierta.

     Las fotos van después y no antes porque cuelgan de la orden, y la orden
     no existe hasta que la RPC responde. */
  const aprobar = async (datosDelTaller, fotos) => {
    setAviso('')
    const { data, error } = await supabase.rpc('aprobar_cotizacion', {
      p_venta: aprobando.id,
      p_mecanico: datosDelTaller.mecanico_id || null,
      p_kilometraje: datosDelTaller.kilometraje === '' ? null : Number(datosDelTaller.kilometraje),
      p_falla: datosDelTaller.falla_reportada || null,
      p_notas: datosDelTaller.notas || null,
    })

    if (error) {
      setAprobando(null)
      return setAviso(error.message)
    }

    /* De a una y no en paralelo: son fotos de varios MB desde un celular, y
       seis subidas simultáneas en el wifi del taller terminan más lento que en
       fila —además de dejar a medias las que fallan. */
    let falloFoto = ''
    for (const archivo of fotos) {
      const { error: fallo } = await subirFotoDeOrden({
        ordenId: data,
        archivo,
        momento: 'ingreso',
        subidaPor: sesion.user.id,
      })
      if (fallo) {
        falloFoto = fallo
        break
      }
    }

    setAprobando(null)

    /* Si las fotos fallaron no se navega: el aviso se perdería en el camino y
       el vendedor se iría creyendo que el auto quedó documentado. La orden ya
       está abierta —eso hay que decirlo— y desde la fila se llega a ella para
       sacarlas de nuevo. */
    if (falloFoto) {
      recargar()
      return setAviso(
        `La orden se abrió, pero las fotos no subieron: ${falloFoto} Entrá con «Ver la orden» y sacálas de nuevo.`
      )
    }

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
      {/* Título y resumen en un renglón, como en Stock: lo que se viene a
          mirar es la lista, no la cabecera. */}
      <Encabezado
        titulo="Ventas"
        resumen={
          <>
            {numero(resumen.abiertas)} sin responder ·{' '}
            <span className="font-medium text-caucho-700">{plata(resumen.ofrecido)}</span> ofrecido
            {resumen.enTaller > 0 && ` · ${numero(resumen.enTaller)} en el taller`}
          </>
        }
      >
        <Boton onClick={() => setCreando(true)}>
          <Plus size={16} /> Nueva venta
        </Boton>
      </Encabezado>

      <Tarjeta className="mb-3 p-3">
        <div className="relative">
          <Search
            size={16}
            className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-acero-400"
            aria-hidden="true"
          />
          <input
            className={`${estiloInput} pl-9 ${busqueda ? 'pr-10' : ''}`}
            placeholder="Buscar por cliente, vehículo, patente o vendedor…"
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
          />
          {busqueda && (
            <button
              type="button"
              onClick={() => setBusqueda('')}
              aria-label="Limpiar búsqueda"
              className="absolute right-2 top-1/2 -translate-y-1/2 rounded-lg p-1.5 text-acero-400 transition-colors hover:bg-concreto-100 hover:text-caucho-800"
            >
              <X size={15} />
            </button>
          )}
        </div>

        <div className="mt-2.5 flex flex-wrap items-center gap-1.5">
          {FILTROS.map((f) => (
            <Chip
              key={f.valor}
              activo={filtro === f.valor}
              cantidad={conteos[f.valor]}
              onClick={() => setFiltro(f.valor)}
            >
              {f.texto}
            </Chip>
          ))}
          {hayFiltro && (
            <button
              onClick={() => {
                setBusqueda('')
                setFiltro('todas')
              }}
              className="rounded-full px-3 py-1.5 text-sm font-medium text-acero-500 underline-offset-4 transition-colors hover:text-perez-700 hover:underline"
            >
              Limpiar
            </button>
          )}
        </div>
      </Tarjeta>

      {error && <Aviso>{error}</Aviso>}
      <Aviso>{aviso}</Aviso>

      <Tarjeta className="overflow-hidden">
        {cargando ? (
          <Esqueleto filas={8} />
        ) : filtradas.length === 0 ? (
          <Vacio
            icono={Receipt}
            titulo={hayFiltro ? 'Ninguna venta coincide' : 'Todavía no hay ventas'}
            detalle={
              hayFiltro
                ? 'Probá con otra búsqueda o quitá los filtros.'
                : 'Cargá la primera desde «Nueva venta».'
            }
          />
        ) : (
          <LazyMotion features={domAnimation}>
            <Tabla
              columnas={[
                'Fecha',
                'Cliente',
                { texto: 'Total', cifra: true },
                'Estado',
                { texto: '' },
              ]}
            >
              {filtradas.map((v, i) => {
                const etapa = etapaDe(v)
                const cotizaAbierta = etapa === 'cotizacion'

                return (
                  <m.tr
                    key={v.id}
                    /* Las filas llegan escalonadas, y solo las primeras: pasada
                       la docena el retardo acumulado se convierte en espera, y
                       lo que entra abajo ya está fuera de la vista. */
                    initial={quieto ? false : { opacity: 0, y: 6 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.28, ease: SUAVE, delay: Math.min(i, 12) * 0.025 }}
                    className="group bg-white transition-colors hover:bg-concreto-50 sm:bg-transparent"
                  >
                    <td data-label="Fecha" className="px-4 py-3 whitespace-nowrap text-acero-500">
                      {fecha(v.creada_en)}
                    </td>

                    <td data-label="Cliente" className="px-4 py-3">
                      <p className="font-semibold text-caucho-900">
                        {v.clientes?.nombre ?? 'Consumidor final'}
                      </p>
                      {/* El auto y el vendedor bajan a la segunda línea: eran
                          dos columnas que empujaban el importe fuera de la
                          vista y que nadie lee en horizontal. */}
                      <p className="truncate text-xs text-acero-500">
                        {v.vehiculos ? (
                          <>
                            {nombreVehiculo(v.vehiculos)}
                            {v.vehiculos.patente && (
                              <span className="font-mono"> · {v.vehiculos.patente}</span>
                            )}
                          </>
                        ) : (
                          'Mostrador'
                        )}
                        {v.perfiles?.nombre && ` · ${v.perfiles.nombre}`}
                      </p>
                    </td>

                    <td data-label="Total" className="cifra px-4 py-3">
                      <p className="font-semibold text-caucho-900">{plata(v.total)}</p>
                      <p className="text-xs text-acero-500">
                        {numero(v.venta_items?.length ?? 0)}{' '}
                        {v.venta_items?.length === 1 ? 'ítem' : 'ítems'}
                      </p>
                    </td>

                    <td data-label="Estado" className="px-4 py-3">
                      {/* Una cotización aprobada sigue siendo una cotización
                          para la base —se cobra al entregar el auto, no acá—,
                          pero en la lista tiene que leerse como lo que es: un
                          trabajo que ya está en el taller.

                          El comprobante deja de ser columna propia: es el
                          renglón de abajo del estado, y solo cuando existe. */}
                      {etapa === 'taller' ? (
                        <Etiqueta tono="marca">En el taller</Etiqueta>
                      ) : (
                        <Etiqueta tono={tonoEstado[v.estado]}>{textoEstado[v.estado]}</Etiqueta>
                      )}
                      {v.comprobante && (
                        <span className="mt-1 block text-xs text-acero-500">
                          {estadoDe(v.comprobante.estado).texto}
                        </span>
                      )}
                    </td>

                    {/* Una acción principal por fila y el resto en gris. Antes
                        una cotización con auto mostraba dos botones idénticos
                        —«Aprobar y enviar al taller» y «Confirmar»— y había que
                        leerlos para saber cuál era el camino habitual. */}
                    <td data-label="Acciones" className="px-4 py-3">
                      <div className="flex flex-wrap items-center gap-1.5 sm:justify-end">
                        {etapa === 'taller' && v.orden && (
                          <Boton
                            variante="secundario"
                            className="px-2.5 py-1.5"
                            onClick={() => navigate('/taller', { state: { orden: v.orden.id } })}
                          >
                            <Wrench size={15} /> Ver la orden
                          </Boton>
                        )}

                        {/* El taller es para el trabajo sobre un auto; una venta
                            de mostrador se cobra acá nomás. Lo que separa una de
                            otra es el vehículo. */}
                        {cotizaAbierta && v.vehiculo_id && (
                          <Boton className="px-2.5 py-1.5" onClick={() => setAprobando(v)}>
                            <Wrench size={15} /> Al taller
                          </Boton>
                        )}

                        {cotizaAbierta && (
                          <Boton
                            variante={v.vehiculo_id ? 'fantasma' : 'secundario'}
                            className="px-2.5 py-1.5"
                            onClick={() => setConfirmando(v)}
                          >
                            <Check size={15} /> Cobrar
                          </Boton>
                        )}

                        {v.estado === 'confirmada' && !v.comprobante && (
                          <Boton
                            variante="secundario"
                            className="px-2.5 py-1.5"
                            onClick={() => facturar(v)}
                          >
                            <FileText size={15} /> Facturar
                          </Boton>
                        )}

                        {/* Anular no se ofrece: se busca. Aparece al pasar por
                            la fila, y en el celular —donde no hay hover— queda
                            siempre visible.

                            Una venta ya facturada ante ARCA no se anula acá:
                            hay un comprobante con CAE dando vueltas, y eso se
                            revierte con una nota de crédito, que todavía no
                            está. */}
                        {v.estado === 'confirmada' && v.comprobante?.estado !== 'emitido' && (
                          <Boton
                            variante="fantasma"
                            className="px-2.5 py-1.5 sm:opacity-0 sm:transition-opacity sm:group-hover:opacity-100 sm:group-focus-within:opacity-100"
                            onClick={() => cambiarEstado(v, 'anulada')}
                          >
                            Anular
                          </Boton>
                        )}
                      </div>
                    </td>
                  </m.tr>
                )
              })}
            </Tabla>
          </LazyMotion>
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

/* Mismo chip que el de Stock: si dos pantallas filtran igual, tienen que
   verse igual. Lleva el conteo adentro porque un filtro que promete resultados
   y devuelve una lista vacía se siente roto. */
function Chip({ activo, cantidad, onClick, children }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={activo}
      className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-sm font-medium transition-all duration-200 ${
        activo
          ? 'border-perez-600 bg-perez-600 text-white shadow-sm shadow-perez-900/20'
          : 'border-concreto-200 bg-white text-caucho-700 hover:border-acero-300 hover:bg-concreto-50'
      }`}
    >
      {children}
      <span
        className={`rounded-full px-1.5 text-xs font-semibold tabular-nums ${
          activo ? 'bg-white/20 text-white' : 'bg-concreto-100 text-acero-500'
        }`}
      >
        {numero(cantidad)}
      </span>
    </button>
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
   qué kilometraje viene, qué dijo que le pasa, quién lo va a atender y cómo
   entró.

   El mecánico se puede dejar sin asignar —a veces el auto se deja y recién a
   la tarde se sabe quién lo agarra—, pero el trabajo no arranca sin él. */
function AprobarCotizacion({ venta, onCerrar, onAprobar }) {
  const [form, setForm] = useState({
    mecanico_id: '',
    kilometraje: '',
    falla_reportada: '',
    notas: '',
  })
  const [fotos, setFotos] = useState([])
  const entrada = useRef(null)
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

  /* Las miniaturas se miran desde la memoria del navegador: la foto todavía no
     subió a ningún lado —la orden no existe— y no tiene sentido subirla para
     poder verla si el vendedor puede cancelar. El ref es para poder soltar
     esas URLs al cerrar sin que el efecto se lleve puestas las vigentes. */
  const vivas = useRef(fotos)
  vivas.current = fotos
  useEffect(() => () => vivas.current.forEach((f) => URL.revokeObjectURL(f.vista)), [])

  const elegir = (evento) => {
    const nuevas = Array.from(evento.target.files ?? [])
    /* El input se limpia ya: sin esto, sacar dos veces la misma foto no
       dispara el change y la segunda no entra. */
    evento.target.value = ''
    setFotos((prev) => [
      ...prev,
      ...nuevas.map((archivo) => ({ archivo, vista: URL.createObjectURL(archivo) })),
    ])
  }

  const quitar = (foto) => {
    URL.revokeObjectURL(foto.vista)
    setFotos((prev) => prev.filter((f) => f !== foto))
  }

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

        {/* Cómo entró el auto, con el cliente todavía enfrente. Es la única
            ocasión: después el auto está adentro y el rayón ya no se puede
            fechar. Van al mismo lugar que las del taller —la orden que se
            abre acá— así que el mecánico las ve al levantar la ficha. */}
        <Campo
          etiqueta="Fotos de cómo entra"
          ayuda="Sacale unas vueltas antes de que entre. Es lo que resuelve la discusión si después aparece un daño."
        >
          <input
            ref={entrada}
            type="file"
            accept="image/*"
            capture="environment"
            multiple
            onChange={elegir}
            className="hidden"
          />

          {fotos.length > 0 && (
            <ul className="mb-2 grid grid-cols-3 gap-2 sm:grid-cols-4">
              {fotos.map((foto) => (
                <li key={foto.vista} className="relative">
                  <img
                    src={foto.vista}
                    alt=""
                    className="aspect-square w-full rounded-lg border border-concreto-200 object-cover"
                  />
                  <button
                    type="button"
                    onClick={() => quitar(foto)}
                    disabled={guardando}
                    aria-label="Quitar foto"
                    className="absolute -right-1.5 -top-1.5 rounded-full border border-concreto-200 bg-white p-1 text-acero-500 shadow-sm transition-colors hover:text-atencion-600"
                  >
                    <X size={13} />
                  </button>
                </li>
              ))}
            </ul>
          )}

          <Boton
            type="button"
            variante="secundario"
            onClick={() => entrada.current?.click()}
            disabled={guardando}
          >
            <Camera size={15} /> {fotos.length ? 'Sacar otra' : 'Sacar fotos'}
          </Boton>
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
              onAprobar(
                form,
                fotos.map((f) => f.archivo)
              )
            }}
            disabled={guardando}
          >
            {guardando
              ? fotos.length
                ? 'Subiendo las fotos…'
                : 'Abriendo la orden…'
              : 'Aprobar y enviar al taller'}
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
