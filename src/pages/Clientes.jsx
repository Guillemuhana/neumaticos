import { useMemo, useState } from 'react'
import { Search, Plus } from 'lucide-react'
import { useConsulta } from '../hooks/useConsulta'
import { supabase } from '../lib/supabase'
import { Aviso, Boton, Campo, Cargando, Encabezado, Modal, Tabla, Tarjeta, Vacio, estiloInput } from '../components/UI'

const vacio = { nombre: '', telefono: '', email: '', documento: '' }

export default function Clientes() {
  const [busqueda, setBusqueda] = useState('')
  const [editando, setEditando] = useState(null)

  const { datos, cargando, error, recargar } = useConsulta(
    () => supabase.from('clientes').select('*').order('nombre'),
    []
  )

  const filtrados = useMemo(() => {
    if (!datos) return []
    const q = busqueda.trim().toLowerCase()
    if (!q) return datos
    return datos.filter((c) =>
      `${c.nombre} ${c.telefono ?? ''} ${c.email ?? ''} ${c.documento ?? ''}`
        .toLowerCase()
        .includes(q)
    )
  }, [datos, busqueda])

  return (
    <>
      <Encabezado titulo="Clientes" detalle="Base de clientes del local.">
        <Boton onClick={() => setEditando(vacio)}>
          <Plus size={16} /> Nuevo cliente
        </Boton>
      </Encabezado>

      <div className="relative mb-4">
        <Search
          size={16}
          className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-acero-500"
          aria-hidden="true"
        />
        <input
          className={`${estiloInput} pl-9`}
          placeholder="Buscar cliente, teléfono o documento…"
          value={busqueda}
          onChange={(e) => setBusqueda(e.target.value)}
        />
      </div>

      {error && <Aviso>{error}</Aviso>}

      <Tarjeta>
        {cargando ? (
          <Cargando texto="Cargando clientes…" alto="min-h-[40vh]" />
        ) : filtrados.length === 0 ? (
          <Vacio
            icono={Search}
            titulo="No hay clientes"
            detalle={busqueda ? 'Probá con otra búsqueda.' : 'Cargá tu primer cliente.'}
          />
        ) : (
          <Tabla columnas={['Nombre', 'Teléfono', 'Email', 'Documento', '']}>
            {filtrados.map((c) => (
              <tr key={c.id} className="hover:bg-concreto-50 rounded-xl bg-white shadow-sm sm:bg-transparent sm:shadow-none">
                <td data-label="Nombre" className="px-4 py-3 font-medium">
                  {c.nombre}
                </td>
                <td data-label="Teléfono" className="px-4 py-3">
                  {c.telefono ?? '—'}
                </td>
                <td data-label="Email" className="px-4 py-3">
                  {c.email ?? '—'}
                </td>
                <td data-label="Documento" className="px-4 py-3 font-mono">
                  {c.documento ?? '—'}
                </td>
                <td data-label="Acciones" className="px-4 py-3 text-right">
                  <Boton variante="fantasma" className="px-2 py-1" onClick={() => setEditando(c)}>
                    Editar
                  </Boton>
                </td>
              </tr>
            ))}
          </Tabla>
        )}
      </Tarjeta>

      {editando && (
        <FormularioCliente
          cliente={editando}
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

function FormularioCliente({ cliente, onCerrar, onGuardado }) {
  const [form, setForm] = useState(cliente)
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
      nombre: form.nombre.trim(),
      telefono: form.telefono?.trim() || null,
      email: form.email?.trim() || null,
      documento: form.documento?.trim() || null,
    }

    const { error } = form.id
      ? await supabase.from('clientes').update(fila).eq('id', form.id)
      : await supabase.from('clientes').insert(fila)

    if (error) {
      setError(error.message)
      setGuardando(false)
    } else onGuardado()
  }

  return (
    <Modal titulo={form.id ? 'Editar cliente' : 'Nuevo cliente'} onCerrar={onCerrar}>
      <form onSubmit={guardar} className="space-y-4">
        <Campo etiqueta="Nombre completo">
          <input required className={estiloInput} {...campo('nombre')} />
        </Campo>
        <Campo etiqueta="Teléfono">
          <input className={estiloInput} {...campo('telefono')} />
        </Campo>
        <Campo etiqueta="Email">
          <input type="email" className={estiloInput} {...campo('email')} />
        </Campo>
        <Campo etiqueta="Documento">
          <input className={estiloInput} {...campo('documento')} />
        </Campo>

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
