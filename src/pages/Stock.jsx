import { useMemo, useState } from 'react'
import { Boxes, Plus, Search } from 'lucide-react'
import { useAuth } from '../context/AuthProvider'
import { useConsulta } from '../hooks/useConsulta'
import { supabase } from '../lib/supabase'
import { plata } from '../lib/formato'
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

const vacio = { codigo: '', marca: '', medida: '', precio: '', costo: '', stock: '', stock_minimo: '4' }

export default function Stock() {
  const { puede } = useAuth()
  const [busqueda, setBusqueda] = useState('')
  const [editando, setEditando] = useState(null)

  const { datos, cargando, error, recargar } = useConsulta(
    () => supabase.from('productos').select('*').eq('activo', true).order('marca'),
    []
  )

  const filtrados = useMemo(() => {
    if (!datos) return []
    const q = busqueda.trim().toLowerCase()
    if (!q) return datos
    return datos.filter((p) =>
      `${p.marca} ${p.medida} ${p.codigo ?? ''} ${p.descripcion ?? ''}`.toLowerCase().includes(q)
    )
  }, [datos, busqueda])

  const gestiona = puede('gerencia')

  return (
    <>
      <Encabezado titulo="Stock" detalle="Neumáticos y repuestos disponibles.">
        {gestiona && (
          <Boton onClick={() => setEditando(vacio)}>
            <Plus size={16} /> Nuevo artículo
          </Boton>
        )}
      </Encabezado>

      <div className="relative mb-4">
        <Search
          size={16}
          className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-acero-500"
          aria-hidden="true"
        />
        <input
          className={`${estiloInput} pl-9`}
          placeholder="Buscar por marca, medida o código…"
          value={busqueda}
          onChange={(e) => setBusqueda(e.target.value)}
        />
      </div>

      {error && <Aviso>{error}</Aviso>}

      <Tarjeta>
        {cargando ? (
          <Cargando texto="Leyendo inventario…" alto="min-h-[40vh]" />
        ) : filtrados.length === 0 ? (
          <Vacio
            icono={Boxes}
            titulo="No hay artículos"
            detalle={busqueda ? 'Probá con otra búsqueda.' : 'Cargá el primer artículo del inventario.'}
          />
        ) : (
          <Tabla columnas={['Artículo', 'Medida', 'Precio', 'Stock', ...(gestiona ? [''] : [])]}>
            {filtrados.map((p) => {
              const critico = p.stock <= p.stock_minimo
              return (
                <tr key={p.id} className="hover:bg-concreto-50">
                  <td className="px-4 py-3">
                    <p className="font-medium">{p.marca}</p>
                    {p.codigo && <p className="font-mono text-xs text-acero-500">{p.codigo}</p>}
                  </td>
                  <td className="px-4 py-3 font-mono">{p.medida}</td>
                  <td className="px-4 py-3 tabular-nums">{plata(p.precio)}</td>
                  <td className="px-4 py-3">
                    <span className="mr-2 font-mono font-semibold tabular-nums">{p.stock}</span>
                    {critico && <Etiqueta tono="atencion">reponer</Etiqueta>}
                  </td>
                  {gestiona && (
                    <td className="px-4 py-3 text-right">
                      <Boton variante="fantasma" className="px-2 py-1" onClick={() => setEditando(p)}>
                        Editar
                      </Boton>
                    </td>
                  )}
                </tr>
              )
            })}
          </Tabla>
        )}
      </Tarjeta>

      {editando && (
        <FormularioProducto
          producto={editando}
          onCerrar={() => setEditando(null)}
          onGuardado={() => {
            setEditando(null)
            recargar()
          }}
        />
      )}
    </>
  )
}

function FormularioProducto({ producto, onCerrar, onGuardado }) {
  const [form, setForm] = useState(producto)
  const [error, setError] = useState('')
  const [guardando, setGuardando] = useState(false)

  const campo = (k) => ({
    value: form[k] ?? '',
    onChange: (e) => setForm({ ...form, [k]: e.target.value }),
  })

  const guardar = async (e) => {
    e.preventDefault()
    setGuardando(true)
    setError('')

    const fila = {
      codigo: form.codigo?.trim() || null,
      marca: form.marca.trim(),
      medida: form.medida.trim(),
      precio: Number(form.precio) || 0,
      costo: Number(form.costo) || 0,
      stock: Number(form.stock) || 0,
      stock_minimo: Number(form.stock_minimo) || 0,
    }

    const { error } = form.id
      ? await supabase.from('productos').update(fila).eq('id', form.id)
      : await supabase.from('productos').insert(fila)

    if (error) {
      setError(error.message)
      setGuardando(false)
    } else onGuardado()
  }

  return (
    <Modal titulo={form.id ? 'Editar artículo' : 'Nuevo artículo'} onCerrar={onCerrar}>
      <form onSubmit={guardar} className="space-y-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <Campo etiqueta="Marca">
            <input required className={estiloInput} placeholder="Pirelli" {...campo('marca')} />
          </Campo>
          <Campo etiqueta="Medida">
            <input required className={estiloInput} placeholder="205/55 R16" {...campo('medida')} />
          </Campo>
          <Campo etiqueta="Código" ayuda="Opcional, interno o del proveedor">
            <input className={estiloInput} {...campo('codigo')} />
          </Campo>
          <Campo etiqueta="Stock">
            <input type="number" min="0" className={estiloInput} {...campo('stock')} />
          </Campo>
          <Campo etiqueta="Precio de venta">
            <input type="number" min="0" step="0.01" className={estiloInput} {...campo('precio')} />
          </Campo>
          <Campo etiqueta="Costo">
            <input type="number" min="0" step="0.01" className={estiloInput} {...campo('costo')} />
          </Campo>
          <Campo etiqueta="Stock mínimo" ayuda="Debajo de este número avisa el panel">
            <input type="number" min="0" className={estiloInput} {...campo('stock_minimo')} />
          </Campo>
        </div>

        <Aviso>{error}</Aviso>

        <div className="flex justify-end gap-2">
          <Boton type="button" variante="secundario" onClick={onCerrar}>
            Cancelar
          </Boton>
          <Boton type="submit" disabled={guardando}>
            {guardando ? 'Guardando…' : 'Guardar'}
          </Boton>
        </div>
      </form>
    </Modal>
  )
}
