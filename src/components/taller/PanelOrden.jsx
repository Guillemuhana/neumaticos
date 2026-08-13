import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowRight, FileText, Plus, Trash2 } from 'lucide-react'
import { useAuth } from '../../context/AuthProvider'
import { useConsulta } from '../../hooks/useConsulta'
import { supabase } from '../../lib/supabase'
import { fecha, fechaCorta, numero, plata } from '../../lib/formato'
import { estadoDe, numeroComprobante, tipoDe } from '../../lib/fiscal'
import {
  CONTROLES,
  avanceDe,
  controlCompleto,
  etapaDe,
  puedeEditarPlan,
  puedeEditarRecepcion,
  puedeEditarTrabajo,
} from '../../lib/taller'
import FotosVehiculo from './FotosVehiculo'
import { Aviso, Boton, Campo, Cargando, Etiqueta, Modal, estiloInput } from '../UI'

/* La orden completa, con lo que cada puesto necesita ver y solo lo que puede
   tocar. Los permisos se calculan de nuevo en Postgres: acá se ocultan
   botones para no ofrecer lo imposible, no para proteger nada. */

export default function PanelOrden({ orden, onCerrar, onCambio }) {
  const { sesion, rol } = useAuth()
  const [error, setError] = useState('')
  const [trabajando, setTrabajando] = useState(false)
  /* La entrega pide dos datos más —cómo pagó y cuándo vuelve— así que en vez
     de avanzar de una abre su formulario. El resto de los pasos siguen siendo
     un solo clic: pedir confirmación en cada etapa cansa y no protege nada. */
  const [entregando, setEntregando] = useState(false)

  const etapa = etapaDe(orden.estado)
  const paso = avanceDe(orden.estado, rol)
  const editaPlan = puedeEditarPlan(orden, rol)

  const items = useConsulta(
    () =>
      supabase
        .from('orden_items')
        .select('*, productos(marca, medida, stock)')
        .eq('orden_id', orden.id)
        .order('tipo'),
    [orden.id]
  )

  const total = useMemo(
    () => (items.datos ?? []).reduce((a, i) => a + Number(i.cantidad) * Number(i.precio_unitario), 0),
    [items.datos]
  )

  const refrescar = () => {
    items.recargar()
    onCambio()
  }

  const avanzar = async (entrega = null) => {
    setTrabajando(true)
    setError('')

    if (paso.destino === 'entregada') {
      const { error } = await supabase.rpc('entregar_orden', {
        p_orden: orden.id,
        p_medio_pago: entrega?.medio_pago || null,
        p_proximo_service: entrega?.proximo_service || null,
      })
      if (error) setError(error.message)
      else {
        onCambio()
        onCerrar()
        return
      }
    } else {
      const cambios = { estado: paso.destino }

      /* El mecánico que arranca el trabajo se queda con la orden: el trigger
         exige un responsable antes de pasar a 'en_proceso'. */
      if (paso.destino === 'en_proceso' && !orden.mecanico_id && rol === 'mecanico') {
        cambios.mecanico_id = sesion.user.id
      }
      const { error } = await supabase.from('ordenes').update(cambios).eq('id', orden.id)
      if (error) setError(error.message)
      else {
        onCambio()
        onCerrar()
        return
      }
    }

    setTrabajando(false)
  }

  return (
    <Modal titulo={orden.vehiculo} onCerrar={onCerrar}>
      <div className="space-y-5">
        <div className="flex flex-wrap items-center gap-2">
          <Etiqueta tono={etapa.tono}>{etapa.texto}</Etiqueta>
          {orden.patente && (
            <span className="font-mono text-xs uppercase text-acero-500">{orden.patente}</span>
          )}
          <span className="text-xs text-acero-500">
            {orden.clientes?.nombre ?? 'Sin cliente'}
            {orden.clientes?.telefono ? ` · ${orden.clientes.telefono}` : ''}
          </span>
        </div>

        <Recepcion orden={orden} editable={puedeEditarRecepcion(orden, rol)} onGuardado={onCambio} />

        {/* La saca cualquiera de los tres: recepción cuando recibe el auto y
            el mecánico mientras trabaja. Una orden entregada ya no admite
            fotos —lo dice RLS—, así que ahí solo se miran. */}
        <FotosVehiculo orden={orden} editable={orden.estado !== 'entregada'} />

        {/* Lo que encontró el taller. Aparece recién cuando el auto entró al
            elevador: en una orden que todavía nadie tocó sería un formulario
            vacío pidiendo que lo llenen. */}
        {orden.estado !== 'pendiente' && (
          <Trabajo
            orden={orden}
            editable={puedeEditarTrabajo(orden, rol)}
            onGuardado={onCambio}
          />
        )}

        {['en_proceso', 'control_calidad', 'terminada', 'entregada'].includes(orden.estado) && (
          <ControlCalidad
            orden={orden}
            editable={
              puedeEditarTrabajo(orden, rol) &&
              ['en_proceso', 'control_calidad'].includes(orden.estado)
            }
            onGuardado={onCambio}
          />
        )}

        {/* Lo que apareció de más, con el auto ya en el elevador. Va antes del
            plan porque es lo que puede cambiarlo. */}
        {orden.estado !== 'pendiente' && <Hallazgos orden={orden} rol={rol} />}

        <Plan
          orden={orden}
          items={items}
          total={total}
          editable={editaPlan}
          onCambio={refrescar}
        />

        {/* Recepción también asigna: es quien recibe el auto y sabe quién está
            libre. RLS deja escribir la orden a los dos roles. */}
        {['gerencia', 'vendedor'].includes(rol) && orden.estado !== 'entregada' && (
          <AsignarMecanico orden={orden} onGuardado={onCambio} />
        )}

        {/* Entregar deja el comprobante armado; acá se ve en qué quedó sin
            tener que ir a buscarlo. El mecánico no lo ve: RLS no le devuelve
            los comprobantes, así que ni siquiera se consulta. */}
        {['gerencia', 'vendedor'].includes(rol) && orden.venta_id && (
          <Comprobante ventaId={orden.venta_id} />
        )}

        {/* El reclamo cuelga de la orden entregada, no del cliente: lo que se
            discute es *este* trabajo, y desde acá salen solos el vehículo, el
            mecánico que lo hizo y las fotos de cómo entró y cómo salió. */}
        {orden.estado === 'entregada' && <Garantias orden={orden} rol={rol} />}

        <Trazabilidad orden={orden} />

        <Aviso>{error}</Aviso>

        {entregando && (
          <Entrega
            orden={orden}
            trabajando={trabajando}
            onCancelar={() => setEntregando(false)}
            onConfirmar={avanzar}
          />
        )}

        <div className="flex flex-wrap justify-end gap-2 border-t border-concreto-200 pt-4">
          <Boton variante="secundario" onClick={onCerrar}>
            Cerrar
          </Boton>
          {paso ? (
            <Boton
              onClick={() => (paso.destino === 'entregada' ? setEntregando(true) : avanzar())}
              /* El control incompleto frena el paso en la base igual; acá se
                 deshabilita para que no haya que descubrirlo con un error. */
              disabled={
                trabajando ||
                entregando ||
                (paso.destino === 'terminada' && !controlCompleto(orden))
              }
              title={
                paso.destino === 'terminada' && !controlCompleto(orden)
                  ? 'Completá los cuatro puntos del control de calidad.'
                  : undefined
              }
            >
              {trabajando ? 'Guardando…' : paso.texto} <ArrowRight size={15} />
            </Boton>
          ) : (
            orden.estado !== 'entregada' && (
              <p className="self-center text-xs text-acero-500">
                Esperando a {etapa.puesto.toLowerCase()}.
              </p>
            )
          )}
        </div>
      </div>
    </Modal>
  )
}

function Bloque({ titulo, children, accion }) {
  return (
    <section className="rounded-lg border border-concreto-200">
      <div className="flex items-center justify-between gap-2 border-b border-concreto-200 px-3 py-2">
        <h3 className="text-menor font-bold uppercase tracking-wide text-acero-500">{titulo}</h3>
        {accion}
      </div>
      <div className="p-3">{children}</div>
    </section>
  )
}

function Dato({ etiqueta, children }) {
  return (
    <div>
      <p className="text-xs text-acero-500">{etiqueta}</p>
      <p className="text-sm text-caucho-900">{children || '—'}</p>
    </div>
  )
}

function Recepcion({ orden, editable, onGuardado }) {
  const [editando, setEditando] = useState(false)
  const [form, setForm] = useState({
    kilometraje: orden.kilometraje ?? '',
    falla_reportada: orden.falla_reportada ?? '',
    notas: orden.notas ?? '',
  })
  const [error, setError] = useState('')
  const [guardando, setGuardando] = useState(false)

  const campo = (k) => ({
    value: form[k],
    onChange: (e) => setForm({ ...form, [k]: e.target.value }),
  })

  const guardar = async () => {
    setGuardando(true)
    setError('')

    const { error } = await supabase
      .from('ordenes')
      .update({
        kilometraje: form.kilometraje === '' ? null : Number(form.kilometraje),
        falla_reportada: form.falla_reportada.trim() || null,
        notas: form.notas.trim() || null,
      })
      .eq('id', orden.id)

    if (error) setError(error.message)
    else {
      setEditando(false)
      onGuardado()
    }
    setGuardando(false)
  }

  return (
    <Bloque
      titulo="Recepción"
      accion={
        editable && !editando ? (
          <Boton variante="fantasma" className="px-2 py-1" onClick={() => setEditando(true)}>
            Editar
          </Boton>
        ) : null
      }
    >
      {editando ? (
        <div className="space-y-3">
          <Campo etiqueta="Kilometraje">
            <input type="number" min="0" className={estiloInput} {...campo('kilometraje')} />
          </Campo>
          <Campo etiqueta="Qué pide el cliente">
            <textarea rows={3} className={estiloInput} {...campo('falla_reportada')} />
          </Campo>
          <Campo etiqueta="Notas">
            <input className={estiloInput} {...campo('notas')} />
          </Campo>

          <Aviso>{error}</Aviso>

          <div className="flex justify-end gap-2">
            <Boton variante="secundario" onClick={() => setEditando(false)}>
              Cancelar
            </Boton>
            <Boton onClick={guardar} disabled={guardando}>
              {guardando ? 'Guardando…' : 'Guardar'}
            </Boton>
          </div>
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          <Dato etiqueta="Kilometraje">
            {orden.kilometraje != null ? `${numero(orden.kilometraje)} km` : null}
          </Dato>
          <Dato etiqueta="Recibió">{orden.recepcionista?.nombre}</Dato>
          <div className="sm:col-span-2">
            <Dato etiqueta="Qué pide el cliente">{orden.falla_reportada}</Dato>
          </div>
          {orden.notas && (
            <div className="sm:col-span-2">
              <Dato etiqueta="Notas">{orden.notas}</Dato>
            </div>
          )}
        </div>
      )}
    </Bloque>
  )
}

/* Lo que el cliente dijo está arriba, en Recepción. Esto es lo otro: lo que el
   auto tenía de verdad. Son dos campos y no uno porque no son lo mismo —el
   hallazgo es lo que se ve, el diagnóstico es qué lo explica— y separarlos es
   lo que después sostiene un adicional frente al cliente. */
function Trabajo({ orden, editable, onGuardado }) {
  const [editando, setEditando] = useState(false)
  const [form, setForm] = useState({
    hallazgos: orden.hallazgos ?? '',
    diagnostico: orden.diagnostico ?? '',
  })
  const [error, setError] = useState('')
  const [guardando, setGuardando] = useState(false)

  const campo = (k) => ({
    value: form[k],
    onChange: (e) => setForm({ ...form, [k]: e.target.value }),
  })

  const guardar = async () => {
    setGuardando(true)
    setError('')

    const { error } = await supabase
      .from('ordenes')
      .update({
        hallazgos: form.hallazgos.trim() || null,
        diagnostico: form.diagnostico.trim() || null,
      })
      .eq('id', orden.id)

    if (error) setError(error.message)
    else {
      setEditando(false)
      onGuardado()
    }
    setGuardando(false)
  }

  return (
    <Bloque
      titulo="Diagnóstico del taller"
      accion={
        editable && !editando ? (
          <Boton variante="fantasma" className="px-2 py-1" onClick={() => setEditando(true)}>
            {orden.hallazgos || orden.diagnostico ? 'Editar' : 'Cargar'}
          </Boton>
        ) : null
      }
    >
      {editando ? (
        <div className="space-y-3">
          <Campo etiqueta="Hallazgos" ayuda="Lo que apareció al revisar el vehículo.">
            <textarea
              rows={3}
              className={estiloInput}
              placeholder="Rótulas con juego. Amortiguadores traseros sulfatados."
              {...campo('hallazgos')}
            />
          </Campo>
          <Campo etiqueta="Diagnóstico" ayuda="Qué lo explica y qué hay que hacer.">
            <textarea
              rows={3}
              className={estiloInput}
              placeholder="El ruido viene del tren delantero. Hay que cambiar las dos rótulas y alinear."
              {...campo('diagnostico')}
            />
          </Campo>

          <Aviso>{error}</Aviso>

          <div className="flex justify-end gap-2">
            <Boton variante="secundario" onClick={() => setEditando(false)}>
              Cancelar
            </Boton>
            <Boton onClick={guardar} disabled={guardando}>
              {guardando ? 'Guardando…' : 'Guardar'}
            </Boton>
          </div>
        </div>
      ) : (
        <div className="space-y-3">
          <Dato etiqueta="Hallazgos">{orden.hallazgos}</Dato>
          <Dato etiqueta="Diagnóstico">{orden.diagnostico}</Dato>
        </div>
      )}
    </Bloque>
  )
}

/* La revisión antes de avisarle al cliente. Cada punto se guarda solo al
   tildarlo: es una lista que se completa con el auto delante y guardar al
   final obligaría a volver a la pantalla con las manos sucias. */
function ControlCalidad({ orden, editable, onGuardado }) {
  const [error, setError] = useState('')
  const [guardando, setGuardando] = useState('')

  const marcar = async (campo, valor) => {
    setGuardando(campo)
    setError('')

    const { error } = await supabase
      .from('ordenes')
      .update({ [campo]: valor })
      .eq('id', orden.id)

    if (error) setError(error.message)
    else onGuardado()
    setGuardando('')
  }

  const listos = CONTROLES.filter((c) => orden[c.campo]).length

  return (
    <Bloque titulo="Control de calidad">
      <ul className="space-y-1">
        {CONTROLES.map((c) => (
          <li key={c.campo}>
            <label
              className={`flex items-center gap-2.5 rounded-md px-1 py-1.5 text-sm ${
                editable ? 'cursor-pointer hover:bg-concreto-50' : ''
              }`}
            >
              <input
                type="checkbox"
                checked={Boolean(orden[c.campo])}
                disabled={!editable || guardando === c.campo}
                onChange={(e) => marcar(c.campo, e.target.checked)}
                className="h-4 w-4 shrink-0 accent-perez-600"
              />
              <span className={orden[c.campo] ? 'text-caucho-900' : 'text-acero-500'}>
                {c.texto}
              </span>
            </label>
          </li>
        ))}
      </ul>

      <p className="mt-2 border-t border-concreto-200 pt-2 text-xs text-acero-500">
        {listos === CONTROLES.length
          ? 'Revisión completa.'
          : `${listos} de ${CONTROLES.length}. El trabajo no pasa a listo hasta completarla.`}
      </p>

      <Aviso>{error}</Aviso>
    </Bloque>
  )
}

/* Lo último que se pregunta antes de que el auto se vaya. El medio de pago va
   acá y no en Facturación porque quien cobra es el que entrega, y el próximo
   service porque es el momento en que el cliente todavía está enfrente. */
const MEDIOS_PAGO = ['Efectivo', 'Transferencia', 'Débito', 'Crédito', 'Cuenta corriente']

function Entrega({ orden, trabajando, onCancelar, onConfirmar }) {
  const [medioPago, setMedioPago] = useState(orden.medio_pago ?? 'Efectivo')
  const [proximoService, setProximoService] = useState('')

  return (
    <div className="space-y-3 rounded-lg border border-concreto-200 bg-concreto-50 p-3">
      <p className="text-menor font-semibold text-caucho-800">Datos de la entrega</p>

      <div className="grid gap-3 sm:grid-cols-2">
        <Campo etiqueta="Medio de pago">
          <select
            className={estiloInput}
            value={medioPago}
            onChange={(e) => setMedioPago(e.target.value)}
          >
            {MEDIOS_PAGO.map((m) => (
              <option key={m} value={m}>
                {m}
              </option>
            ))}
          </select>
        </Campo>
        <Campo etiqueta="Próximo service" ayuda="Opcional. Queda en el historial del cliente.">
          <input
            type="date"
            className={estiloInput}
            value={proximoService}
            onChange={(e) => setProximoService(e.target.value)}
          />
        </Campo>
      </div>

      <p className="text-xs text-acero-500">
        Al confirmar se cierra la orden, se registra la venta, se descuenta el stock de los
        repuestos y queda el comprobante esperando en Facturación.
      </p>

      <div className="flex justify-end gap-2">
        <Boton variante="secundario" onClick={onCancelar} disabled={trabajando}>
          Cancelar
        </Boton>
        <Boton
          onClick={() =>
            onConfirmar({ medio_pago: medioPago, proximo_service: proximoService || null })
          }
          disabled={trabajando}
        >
          {trabajando ? 'Entregando…' : 'Confirmar entrega'}
        </Boton>
      </div>
    </div>
  )
}

function Plan({ orden, items, total, editable, onCambio }) {
  const [agregando, setAgregando] = useState(false)
  const [error, setError] = useState('')

  const borrar = async (item) => {
    const { error } = await supabase.from('orden_items').delete().eq('id', item.id)
    if (error) setError(error.message)
    else {
      setError('')
      onCambio()
    }
  }

  return (
    <Bloque
      titulo="Plan de trabajo"
      accion={
        editable && !agregando ? (
          <Boton variante="fantasma" className="px-2 py-1" onClick={() => setAgregando(true)}>
            <Plus size={14} /> Agregar
          </Boton>
        ) : null
      }
    >
      {items.cargando ? (
        <Cargando texto="Cargando el plan…" alto="min-h-[6rem]" />
      ) : (
        <>
          {items.error && <Aviso>{items.error}</Aviso>}

          {!items.datos?.length ? (
            <p className="py-2 text-sm text-acero-500">
              {editable
                ? 'Sin renglones todavía. Cargá la mano de obra y los repuestos cuando se sepan: se puede completar hasta la entrega.'
                : 'El mostrador todavía no cargó el detalle.'}
            </p>
          ) : (
            <ul className="divide-y divide-concreto-200">
              {items.datos.map((i) => (
                <li key={i.id} className="flex items-start gap-3 py-2">
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-caucho-900">{i.descripcion}</p>
                    <p className="text-xs text-acero-500">
                      {i.tipo === 'repuesto' ? 'Repuesto' : 'Mano de obra'} ·{' '}
                      {numero(i.cantidad)} × {plata(i.precio_unitario)}
                      {i.tipo === 'repuesto' && i.productos && i.productos.stock < i.cantidad && (
                        <span className="text-atencion-700"> · stock insuficiente ({i.productos.stock})</span>
                      )}
                    </p>
                  </div>
                  <p className="shrink-0 font-mono text-sm font-semibold">
                    {plata(Number(i.cantidad) * Number(i.precio_unitario))}
                  </p>
                  {editable && (
                    <button
                      onClick={() => borrar(i)}
                      aria-label={`Quitar ${i.descripcion}`}
                      className="shrink-0 rounded p-1 text-acero-400 transition-colors hover:bg-perez-50 hover:text-perez-700"
                    >
                      <Trash2 size={15} />
                    </button>
                  )}
                </li>
              ))}
            </ul>
          )}

          <div className="mt-2 flex items-center justify-between border-t border-concreto-200 pt-2">
            <span className="text-sm font-semibold text-caucho-800">Total</span>
            <span className="display text-base font-bold">{plata(total)}</span>
          </div>

          <Aviso>{error}</Aviso>

          {agregando && (
            <NuevoItem
              ordenId={orden.id}
              onCerrar={() => setAgregando(false)}
              onGuardado={() => {
                setAgregando(false)
                onCambio()
              }}
            />
          )}
        </>
      )}
    </Bloque>
  )
}

function NuevoItem({ ordenId, onCerrar, onGuardado }) {
  const [tipo, setTipo] = useState('servicio')
  const [productoId, setProductoId] = useState('')
  const [descripcion, setDescripcion] = useState('')
  const [cantidad, setCantidad] = useState('1')
  const [precio, setPrecio] = useState('')
  const [error, setError] = useState('')
  const [guardando, setGuardando] = useState(false)

  const { datos: productos } = useConsulta(
    () =>
      supabase
        .from('productos')
        .select('id, marca, medida, precio, stock')
        .eq('activo', true)
        .order('marca'),
    []
  )

  /* Elegir el repuesto trae su precio de lista; queda editable porque en el
     mostrador se hacen descuentos y el plan tiene que reflejar lo cobrado. */
  const elegirProducto = (id) => {
    setProductoId(id)
    const p = productos?.find((x) => x.id === id)
    if (p) {
      setDescripcion(`${p.marca} ${p.medida}`)
      setPrecio(String(p.precio))
    }
  }

  const cambiarTipo = (nuevo) => {
    setTipo(nuevo)
    setProductoId('')
    setDescripcion('')
    setPrecio('')
  }

  const guardar = async () => {
    setGuardando(true)
    setError('')

    const { error } = await supabase.from('orden_items').insert({
      orden_id: ordenId,
      tipo,
      producto_id: tipo === 'repuesto' ? productoId : null,
      descripcion: descripcion.trim(),
      cantidad: Number(cantidad),
      precio_unitario: Number(precio || 0),
    })

    if (error) {
      setError(error.message)
      setGuardando(false)
    } else onGuardado()
  }

  const listo =
    descripcion.trim() && Number(cantidad) > 0 && (tipo === 'servicio' || productoId)

  return (
    <div className="mt-3 space-y-3 rounded-lg border border-concreto-200 bg-concreto-50 p-3">
      <div className="flex gap-2">
        {[
          ['servicio', 'Mano de obra'],
          ['repuesto', 'Repuesto'],
        ].map(([valor, texto]) => (
          <button
            key={valor}
            type="button"
            onClick={() => cambiarTipo(valor)}
            className={`rounded-md border px-3 py-1.5 text-sm transition-colors ${
              tipo === valor
                ? 'border-perez-600 bg-perez-50 font-semibold text-perez-700'
                : 'border-acero-200 bg-white text-caucho-800 hover:bg-concreto-100'
            }`}
          >
            {texto}
          </button>
        ))}
      </div>

      {tipo === 'repuesto' ? (
        <Campo etiqueta="Producto" ayuda="Se descuenta del stock al entregar el vehículo.">
          <select
            className={estiloInput}
            value={productoId}
            onChange={(e) => elegirProducto(e.target.value)}
          >
            <option value="">Elegí un producto…</option>
            {productos?.map((p) => (
              <option key={p.id} value={p.id}>
                {p.marca} {p.medida} · {p.stock} en stock
              </option>
            ))}
          </select>
        </Campo>
      ) : (
        <Campo etiqueta="Trabajo">
          <input
            className={estiloInput}
            placeholder="Alineación y balanceo"
            value={descripcion}
            onChange={(e) => setDescripcion(e.target.value)}
          />
        </Campo>
      )}

      <div className="grid gap-3 sm:grid-cols-2">
        <Campo etiqueta={tipo === 'repuesto' ? 'Cantidad' : 'Horas'}>
          <input
            type="number"
            min={tipo === 'repuesto' ? '1' : '0.5'}
            step={tipo === 'repuesto' ? '1' : '0.5'}
            className={estiloInput}
            value={cantidad}
            onChange={(e) => setCantidad(e.target.value)}
          />
        </Campo>
        <Campo etiqueta="Precio unitario">
          <input
            type="number"
            min="0"
            className={estiloInput}
            value={precio}
            onChange={(e) => setPrecio(e.target.value)}
          />
        </Campo>
      </div>

      <Aviso>{error}</Aviso>

      <div className="flex justify-end gap-2">
        <Boton variante="secundario" onClick={onCerrar}>
          Cancelar
        </Boton>
        <Boton onClick={guardar} disabled={guardando || !listo}>
          {guardando ? 'Agregando…' : 'Agregar al plan'}
        </Boton>
      </div>
    </div>
  )
}

function AsignarMecanico({ orden, onGuardado }) {
  const [error, setError] = useState('')

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

  const asignar = async (id) => {
    const { error } = await supabase
      .from('ordenes')
      .update({ mecanico_id: id || null })
      .eq('id', orden.id)

    if (error) setError(error.message)
    else {
      setError('')
      onGuardado()
    }
  }

  return (
    <Bloque titulo="Taller">
      <Campo etiqueta="Mecánico asignado" ayuda="Sin mecánico, la orden no puede iniciarse.">
        <select
          className={estiloInput}
          value={orden.mecanico_id ?? ''}
          onChange={(e) => asignar(e.target.value)}
        >
          <option value="">Sin asignar</option>
          {mecanicos?.map((m) => (
            <option key={m.id} value={m.id}>
              {m.nombre}
            </option>
          ))}
        </select>
      </Campo>
      <Aviso>{error}</Aviso>
    </Bloque>
  )
}

/* El tramo que sigue a la entrega: la orden ya está cerrada y lo que queda es
   el papel. Muestra si ARCA ya lo autorizó y, si falta, lleva al escritorio
   donde se hace. */
function Comprobante({ ventaId }) {
  const navigate = useNavigate()

  const { datos, cargando, error } = useConsulta(
    () => supabase.from('comprobantes').select('*').eq('venta_id', ventaId).maybeSingle(),
    [ventaId]
  )

  if (cargando) return null

  return (
    <Bloque titulo="Comprobante">
      {error && <Aviso>{error}</Aviso>}

      {!datos ? (
        <p className="text-sm text-acero-500">
          La entrega no dejó comprobante: la orden se cerró sin renglones para facturar.
        </p>
      ) : (
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-sm font-medium text-caucho-900">
              {tipoDe(datos.tipo).texto}{' '}
              <span className="font-mono text-xs text-acero-500">{numeroComprobante(datos)}</span>
            </p>
            <p className="mt-1">
              <Etiqueta tono={estadoDe(datos.estado).tono}>{estadoDe(datos.estado).texto}</Etiqueta>
            </p>
          </div>
          <Boton variante="secundario" onClick={() => navigate('/facturacion')}>
            <FileText size={15} /> Ir a Facturación
          </Boton>
        </div>
      )}
    </Bloque>
  )
}

/* Quién hizo qué y cuándo. Es lo que se mira cuando un cliente discute una
   entrega o un importe, así que se muestra siempre, no solo al final. */
function Trazabilidad({ orden }) {
  const hitos = [
    ['Recibida', orden.creada_en, orden.recepcionista?.nombre],
    ['Iniciada', orden.iniciada_en, orden.mecanico?.nombre],
    ['Terminada', orden.terminada_en, orden.mecanico?.nombre],
    ['Entregada', orden.cerrada_en, null],
  ].filter(([, cuando]) => cuando)

  return (
    <Bloque titulo="Seguimiento">
      <ul className="space-y-1.5">
        {hitos.map(([texto, cuando, quien]) => (
          <li key={texto} className="flex flex-wrap items-baseline justify-between gap-x-3 text-sm">
            <span className="font-medium text-caucho-800">{texto}</span>
            <span className="text-xs text-acero-500">
              {fecha(cuando)}
              {quien ? ` · ${quien}` : ''}
            </span>
          </li>
        ))}
      </ul>

      {/* De dónde salió el trabajo. Una orden que nació de una cotización ya
          tenía el precio acordado con el cliente antes de que el auto entrara:
          si después se discute un importe, eso es lo primero que se mira. */}
      {orden.cotizacion_id && (
        <p className="mt-2 border-t border-concreto-200 pt-2 text-xs text-acero-500">
          El plan de trabajo salió de una cotización que el cliente aprobó.
        </p>
      )}

      {/* Lo que se definió al entregar. Va acá y no en un bloque propio porque
          es parte de cómo terminó esta orden, no algo que se pueda editar. */}
      {(orden.medio_pago || orden.proximo_service) && (
        <div className="mt-2 grid gap-3 border-t border-concreto-200 pt-2 sm:grid-cols-2">
          {orden.medio_pago && <Dato etiqueta="Medio de pago">{orden.medio_pago}</Dato>}
          {/* `fechaCorta` y no `fecha`: el próximo service es un día del
              calendario, y `fecha` le agregaría un "00:00" sin sentido. */}
          {orden.proximo_service && (
            <Dato etiqueta="Próximo service">{fechaCorta(orden.proximo_service)}</Dato>
          )}
        </div>
      )}
    </Bloque>
  )
}

/* El cliente vuelve diciendo que lo que se arregló falló. Lo carga el
   mostrador, que es quien recibe el reclamo, y le aparece al mecánico en su
   panel: el trabajo era suyo y tiene que enterarse sin que se lo cuenten. */
function Garantias({ orden, rol }) {
  const { sesion } = useAuth()
  const [motivo, setMotivo] = useState('')
  const [resolviendo, setResolviendo] = useState(null)
  const [resolucion, setResolucion] = useState('')
  const [error, setError] = useState('')
  const [guardando, setGuardando] = useState(false)

  const { datos, cargando, recargar } = useConsulta(
    () =>
      supabase
        .from('garantias')
        .select('*')
        .eq('orden_id', orden.id)
        .order('creada_en', { ascending: false }),
    [orden.id]
  )

  const registrar = async () => {
    setGuardando(true)
    setError('')

    const { error } = await supabase.from('garantias').insert({
      orden_id: orden.id,
      motivo: motivo.trim(),
      creada_por: sesion.user.id,
    })

    if (error) setError(error.message)
    else {
      setMotivo('')
      recargar()
    }
    setGuardando(false)
  }

  const cerrar = async (garantia, estado) => {
    setGuardando(true)
    setError('')

    const { error } = await supabase
      .from('garantias')
      .update({
        estado,
        resolucion: resolucion.trim(),
        resuelta_por: sesion.user.id,
        resuelta_en: new Date().toISOString(),
      })
      .eq('id', garantia.id)

    if (error) setError(error.message)
    else {
      setResolviendo(null)
      setResolucion('')
      recargar()
    }
    setGuardando(false)
  }

  const abiertas = (datos ?? []).filter((g) => g.estado === 'pendiente')
  const puedeRegistrar = ['gerencia', 'vendedor'].includes(rol)

  if (cargando) return null

  return (
    <Bloque titulo="Garantías">
      {!datos?.length ? (
        <p className="py-1 text-sm text-acero-500">
          {puedeRegistrar
            ? 'Sin reclamos. Si el cliente vuelve por este trabajo, registralo acá.'
            : 'Sin reclamos sobre este trabajo.'}
        </p>
      ) : (
        <ul className="mb-3 divide-y divide-concreto-200">
          {datos.map((g) => (
            <li key={g.id} className="py-2">
              <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
                <p className="text-sm text-caucho-900">{g.motivo}</p>
                <Etiqueta tono={g.estado === 'pendiente' ? 'atencion' : 'conforme'}>
                  {g.estado === 'pendiente'
                    ? 'Pendiente'
                    : g.estado === 'resuelta'
                      ? 'Resuelta'
                      : 'Rechazada'}
                </Etiqueta>
              </div>
              <p className="mt-0.5 text-xs text-acero-500">{fecha(g.creada_en)}</p>
              {g.resolucion && (
                <p className="mt-1 text-xs text-acero-500">Resolución: {g.resolucion}</p>
              )}

              {g.estado === 'pendiente' && resolviendo !== g.id && (
                <Boton
                  variante="secundario"
                  className="mt-2 px-2 py-1"
                  onClick={() => setResolviendo(g.id)}
                >
                  Resolver
                </Boton>
              )}

              {resolviendo === g.id && (
                <div className="mt-2 space-y-2">
                  <Campo
                    etiqueta="Qué se hizo"
                    ayuda="Queda escrito: es lo que hace falta si el cliente vuelve una tercera vez."
                  >
                    <textarea
                      rows={2}
                      className={estiloInput}
                      value={resolucion}
                      onChange={(e) => setResolucion(e.target.value)}
                    />
                  </Campo>
                  <div className="flex flex-wrap justify-end gap-2">
                    <Boton variante="secundario" onClick={() => setResolviendo(null)}>
                      Cancelar
                    </Boton>
                    <Boton
                      variante="peligro"
                      onClick={() => cerrar(g, 'rechazada')}
                      disabled={guardando || !resolucion.trim()}
                    >
                      No corresponde
                    </Boton>
                    <Boton
                      onClick={() => cerrar(g, 'resuelta')}
                      disabled={guardando || !resolucion.trim()}
                    >
                      Resuelta
                    </Boton>
                  </div>
                </div>
              )}
            </li>
          ))}
        </ul>
      )}

      {puedeRegistrar && !abiertas.length && (
        <div className="mt-2 space-y-2">
          <Campo etiqueta="Nuevo reclamo">
            <input
              className={estiloInput}
              placeholder="Volvió el ruido en el tren delantero"
              value={motivo}
              onChange={(e) => setMotivo(e.target.value)}
            />
          </Campo>
          <div className="flex justify-end">
            <Boton onClick={registrar} disabled={guardando || !motivo.trim()}>
              Registrar garantía
            </Boton>
          </div>
        </div>
      )}

      <Aviso>{error}</Aviso>
    </Bloque>
  )
}

/* Lo que el mecánico encuentra de más: una rótula gastada cuando el cliente
   vino por una alineación.

   No se arregla y después se avisa —así aparecen los adicionales que nadie
   aceptó— ni se frena el trabajo hasta que alguien pase por el taller. El
   taller lo informa, el mostrador llama al cliente y marca la respuesta, y
   queda escrito quién dijo qué: es lo único que sirve si después se discute
   el importe. */
function Hallazgos({ orden, rol }) {
  const { sesion } = useAuth()
  const [descripcion, setDescripcion] = useState('')
  const [estimado, setEstimado] = useState('')
  const [error, setError] = useState('')
  const [guardando, setGuardando] = useState(false)

  const { datos, cargando, recargar } = useConsulta(
    () =>
      supabase
        .from('orden_hallazgos')
        .select('*')
        .eq('orden_id', orden.id)
        .order('informado_en', { ascending: false }),
    [orden.id]
  )

  const informa = ['gerencia', 'mecanico'].includes(rol) && orden.estado !== 'entregada'
  const responde = ['gerencia', 'vendedor'].includes(rol) && orden.estado !== 'entregada'

  const informar = async () => {
    setGuardando(true)
    setError('')

    const { error } = await supabase.from('orden_hallazgos').insert({
      orden_id: orden.id,
      descripcion: descripcion.trim(),
      estimado: estimado === '' ? null : Number(estimado),
      informado_por: sesion.user.id,
    })

    if (error) setError(error.message)
    else {
      setDescripcion('')
      setEstimado('')
      recargar()
    }
    setGuardando(false)
  }

  const responder = async (hallazgo, estado) => {
    setGuardando(true)
    setError('')

    const { error } = await supabase
      .from('orden_hallazgos')
      .update({
        estado,
        respondido_por: sesion.user.id,
        respondido_en: new Date().toISOString(),
      })
      .eq('id', hallazgo.id)

    if (error) setError(error.message)
    else recargar()
    setGuardando(false)
  }

  if (cargando) return null
  if (!datos?.length && !informa) return null

  const tono = { informado: 'atencion', aprobado: 'conforme', rechazado: 'neutro' }
  const texto = { informado: 'Esperando al cliente', aprobado: 'Aprobado', rechazado: 'Rechazado' }

  return (
    <Bloque titulo="Hallazgos para aprobar">
      {!datos?.length ? (
        <p className="py-1 text-sm text-acero-500">
          Sin hallazgos informados. Si aparece algo que el cliente no pidió, cargalo acá antes de
          hacerlo.
        </p>
      ) : (
        <ul className="mb-3 divide-y divide-concreto-200">
          {datos.map((h) => (
            <li key={h.id} className="py-2">
              <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
                <p className="text-sm text-caucho-900">{h.descripcion}</p>
                <Etiqueta tono={tono[h.estado]}>{texto[h.estado]}</Etiqueta>
              </div>
              <p className="mt-0.5 text-xs text-acero-500">
                {fecha(h.informado_en)}
                {h.estimado != null && ` · estimado ${plata(h.estimado)}`}
              </p>

              {h.estado === 'informado' && responde && (
                <div className="mt-2 flex flex-wrap justify-end gap-2">
                  <Boton
                    variante="secundario"
                    className="px-2 py-1"
                    onClick={() => responder(h, 'rechazado')}
                    disabled={guardando}
                  >
                    El cliente dijo que no
                  </Boton>
                  <Boton
                    className="px-2 py-1"
                    onClick={() => responder(h, 'aprobado')}
                    disabled={guardando}
                  >
                    Aprobado
                  </Boton>
                </div>
              )}

              {h.estado === 'aprobado' && (
                <p className="mt-1 text-xs text-conforme-700">
                  Cargalo en el plan de trabajo para que se facture.
                </p>
              )}
            </li>
          ))}
        </ul>
      )}

      {informa && (
        <div className="mt-2 space-y-2">
          <Campo
            etiqueta="Nuevo hallazgo"
            ayuda="Requiere aprobación del cliente: el mostrador lo llama y responde acá."
          >
            <input
              className={estiloInput}
              placeholder="Rótula derecha con juego. Conviene cambiarla ahora."
              value={descripcion}
              onChange={(e) => setDescripcion(e.target.value)}
            />
          </Campo>
          <div className="flex flex-wrap items-end justify-between gap-2">
            <Campo etiqueta="Estimado (opcional)">
              <input
                type="number"
                min="0"
                className={`${estiloInput} w-40`}
                value={estimado}
                onChange={(e) => setEstimado(e.target.value)}
              />
            </Campo>
            <Boton onClick={informar} disabled={guardando || !descripcion.trim()}>
              Informar hallazgo
            </Boton>
          </div>
        </div>
      )}

      <Aviso>{error}</Aviso>
    </Bloque>
  )
}
