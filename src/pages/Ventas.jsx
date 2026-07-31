import { useState } from 'react'
import { Check, Plus, Receipt, Trash2 } from 'lucide-react'
import { useAuth } from '../context/AuthProvider'
import { useConsulta } from '../hooks/useConsulta'
import { supabase } from '../lib/supabase'
import { fecha, plata } from '../lib/formato'
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
  const [creando, setCreando] = useState(false)

  const { datos, cargando, error, recargar } = useConsulta(
    () =>
      supabase
        .from('ventas')
        .select('*, clientes(nombre), perfiles(nombre), venta_items(cantidad)')
        .order('creada_en', { ascending: false })
        .limit(100),
    []
  )

  const cambiarEstado = async (venta, estado) => {
    const { error } = await supabase.from('ventas').update({ estado }).eq('id', venta.id)
    if (error) alert(error.message)
    recargar()
  }

  return (
    <>
      <Encabezado titulo="Ventas" detalle="Cotizaciones y comprobantes del local.">
        <Boton onClick={() => setCreando(true)}>
          <Plus size={16} /> Nueva venta
        </Boton>
      </Encabezado>

      {error && <Aviso>{error}</Aviso>}

      <Tarjeta>
        {cargando ? (
          <Cargando texto="Buscando ventas…" alto="min-h-[40vh]" />
        ) : !datos?.length ? (
          <Vacio icono={Receipt} titulo="Todavía no hay ventas" detalle="Cargá la primera desde «Nueva venta»." />
        ) : (
          <Tabla columnas={['Fecha', 'Cliente', 'Vendedor', 'Ítems', 'Total', 'Estado', '']}>
            {datos.map((v) => (
              <tr key={v.id} className="hover:bg-concreto-50 rounded-xl bg-white shadow-sm sm:bg-transparent sm:shadow-none">
                <td data-label="Fecha" className="px-4 py-3 whitespace-nowrap text-acero-500">
                  {fecha(v.creada_en)}
                </td>
                <td data-label="Cliente" className="px-4 py-3 font-medium">
                  {v.clientes?.nombre ?? 'Consumidor final'}
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
                  <Etiqueta tono={tonoEstado[v.estado]}>{textoEstado[v.estado]}</Etiqueta>
                </td>
                <td data-label="Acciones" className="px-4 py-3 text-right">
                  {v.estado === 'cotizacion' && (
                    <Boton variante="fantasma" className="px-2 py-1" onClick={() => cambiarEstado(v, 'confirmada')}>
                      <Check size={15} /> Confirmar
                    </Boton>
                  )}
                  {v.estado === 'confirmada' && (
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
  const [cliente, setCliente] = useState('')
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

    /* Cliente por nombre: si no existe se crea. Sin esto, cargar una venta
       obligaría a dar de alta el cliente en otra pantalla primero. */
    let cliente_id = null
    const nombre = cliente.trim()
    if (nombre) {
      const { data: hallado } = await supabase
        .from('clientes')
        .select('id')
        .ilike('nombre', nombre)
        .maybeSingle()

      if (hallado) cliente_id = hallado.id
      else {
        const { data: nuevo, error: errCliente } = await supabase
          .from('clientes')
          .insert({ nombre })
          .select('id')
          .single()
        if (errCliente) {
          setError(errCliente.message)
          return setGuardando(false)
        }
        cliente_id = nuevo.id
      }
    }

    const { data: venta, error: errVenta } = await supabase
      .from('ventas')
      .insert({
        cliente_id,
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
        <Campo etiqueta="Cliente" ayuda="Si no existe, se crea. Vacío = consumidor final.">
          <input
            className={estiloInput}
            placeholder="Juan Pérez"
            value={cliente}
            onChange={(e) => setCliente(e.target.value)}
          />
        </Campo>

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
