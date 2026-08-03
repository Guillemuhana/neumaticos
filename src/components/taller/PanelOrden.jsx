import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowRight, FileText, Plus, Trash2 } from 'lucide-react'
import { useAuth } from '../../context/AuthProvider'
import { useConsulta } from '../../hooks/useConsulta'
import { supabase } from '../../lib/supabase'
import { fecha, numero, plata } from '../../lib/formato'
import { estadoDe, numeroComprobante, tipoDe } from '../../lib/fiscal'
import { avanceDe, etapaDe, puedeEditarPlan, puedeEditarRecepcion } from '../../lib/taller'
import { Aviso, Boton, Campo, Cargando, Etiqueta, Modal, estiloInput } from '../UI'

/* La orden completa, con lo que cada puesto necesita ver y solo lo que puede
   tocar. Los permisos se calculan de nuevo en Postgres: acá se ocultan
   botones para no ofrecer lo imposible, no para proteger nada. */

export default function PanelOrden({ orden, onCerrar, onCambio }) {
  const { sesion, rol } = useAuth()
  const [error, setError] = useState('')
  const [trabajando, setTrabajando] = useState(false)

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

  const avanzar = async () => {
    setTrabajando(true)
    setError('')

    if (paso.destino === 'entregada') {
      const { error } = await supabase.rpc('entregar_orden', { p_orden: orden.id })
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

        <Trazabilidad orden={orden} />

        <Aviso>{error}</Aviso>

        <div className="flex flex-wrap justify-end gap-2 border-t border-concreto-200 pt-4">
          <Boton variante="secundario" onClick={onCerrar}>
            Cerrar
          </Boton>
          {paso ? (
            <Boton onClick={avanzar} disabled={trabajando}>
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
        <h3 className="text-[0.8125rem] font-bold uppercase tracking-wide text-acero-500">{titulo}</h3>
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
    </Bloque>
  )
}
