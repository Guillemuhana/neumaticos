import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Search, Plus, Wrench } from 'lucide-react'
import { useConsulta } from '../hooks/useConsulta'
import { supabase } from '../lib/supabase'
import { CONDICIONES_IVA, condicionDe, cuitFormateado, cuitValido } from '../lib/fiscal'
import { Aviso, Boton, Campo, Cargando, Encabezado, Modal, Tabla, Tarjeta, Vacio, estiloInput } from '../components/UI'

const vacio = {
  nombre: '',
  telefono: '',
  email: '',
  documento: '',
  cuit: '',
  domicilio: '',
  condicion_iva: 'consumidor_final',
}

export default function Clientes() {
  const navigate = useNavigate()
  const [busqueda, setBusqueda] = useState('')
  const [editando, setEditando] = useState(null)

  /* El alta de un cliente casi nunca es un fin en sí mismo: viene alguien con
     el auto. Desde acá se sigue derecho a la orden, con el cliente ya puesto. */
  const abrirOrden = (cliente) => navigate('/taller', { state: { nueva: true, cliente } })

  const { datos, cargando, error, recargar } = useConsulta(
    () => supabase.from('clientes').select('*').order('nombre'),
    []
  )

  const filtrados = useMemo(() => {
    if (!datos) return []
    const q = busqueda.trim().toLowerCase()
    if (!q) return datos
    return datos.filter((c) =>
      `${c.nombre} ${c.telefono ?? ''} ${c.email ?? ''} ${c.documento ?? ''} ${c.cuit ?? ''}`
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
          <Tabla columnas={['Nombre', 'Teléfono', 'Email', 'CUIT / Documento', 'Frente al IVA', '']}>
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
                {/* El CUIT tapa al documento porque es el que se factura; el
                    documento queda de respaldo para el consumidor final. */}
                <td data-label="CUIT / Documento" className="px-4 py-3 font-mono">
                  {c.cuit ? cuitFormateado(c.cuit) : c.documento ?? '—'}
                </td>
                <td data-label="Frente al IVA" className="px-4 py-3 text-acero-500">
                  {condicionDe(c.condicion_iva).texto}
                </td>
                <td data-label="Acciones" className="px-4 py-3 text-right">
                  <div className="flex justify-end gap-1">
                    <Boton
                      variante="secundario"
                      className="px-2 py-1"
                      onClick={() => abrirOrden(c)}
                    >
                      <Wrench size={14} /> Nueva orden
                    </Boton>
                    <Boton variante="fantasma" className="px-2 py-1" onClick={() => setEditando(c)}>
                      Editar
                    </Boton>
                  </div>
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
          onGuardado={(creado, seguirAOrden) => {
            setEditando(null)
            if (seguirAOrden) abrirOrden(creado)
            else recargar()
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

  /* `seguirAOrden` viaja como argumento y no por estado: si se guardara con
     setState, el submit leería el valor anterior y el botón haría lo que
     hizo el de al lado la vez pasada. */
  const cuitCargado = form.cuit?.trim() ?? ''
  const cuitMal = cuitCargado && !cuitValido(cuitCargado)
  const condicion = condicionDe(form.condicion_iva)

  const guardar = async (e, seguirAOrden = false) => {
    e.preventDefault()

    /* Se avisa acá y no al facturar: un CUIT mal tipeado recién se descubre
       cuando ARCA rechaza el comprobante, y para entonces el cliente ya se
       fue con el auto. */
    if (cuitMal) return setError('El CUIT no es válido: revisá el dígito verificador.')

    setGuardando(true)
    setError('')

    const fila = {
      nombre: form.nombre.trim(),
      telefono: form.telefono?.trim() || null,
      email: form.email?.trim() || null,
      documento: form.documento?.trim() || null,
      cuit: cuitCargado || null,
      domicilio: form.domicilio?.trim() || null,
      condicion_iva: form.condicion_iva ?? 'consumidor_final',
    }

    const { data, error } = form.id
      ? await supabase.from('clientes').update(fila).eq('id', form.id).select().single()
      : await supabase.from('clientes').insert(fila).select().single()

    if (error) {
      setError(error.message)
      setGuardando(false)
    } else onGuardado(data, seguirAOrden)
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

        {/* Lo que hace falta para facturarle. Va abajo y sin obligar nada: en
            el mostrador el cliente está esperando con el auto, y esto se puede
            completar después, antes de emitir el comprobante. */}
        <fieldset className="space-y-4 rounded-lg border border-concreto-200 p-3">
          <legend className="px-1 text-menor font-bold uppercase tracking-wide text-acero-500">
            Facturación
          </legend>

          <Campo
            etiqueta="Condición frente al IVA"
            ayuda="Decide la letra del comprobante: al Responsable Inscripto le va Factura A."
          >
            <select className={estiloInput} {...campo('condicion_iva')}>
              {CONDICIONES_IVA.map((c) => (
                <option key={c.valor} value={c.valor}>
                  {c.texto}
                </option>
              ))}
            </select>
          </Campo>

          <Campo
            etiqueta="CUIT"
            ayuda={
              cuitMal
                ? 'Dígito verificador incorrecto.'
                : condicion.exigeCuit
                  ? 'Obligatorio para esta condición.'
                  : null
            }
          >
            <input className={estiloInput} placeholder="20-12345678-9" {...campo('cuit')} />
          </Campo>

          <Campo etiqueta="Domicilio">
            <input className={estiloInput} {...campo('domicilio')} />
          </Campo>
        </fieldset>

        <Aviso>{error}</Aviso>

        <div className="flex flex-wrap justify-end gap-2">
          <Boton type="button" variante="secundario" onClick={onCerrar}>
            Cancelar
          </Boton>
          <Boton type="submit" variante={form.id ? 'primario' : 'secundario'} disabled={guardando}>
            {guardando ? 'Guardando…' : 'Guardar'}
          </Boton>
          {/* El caso normal en el mostrador: se carga al cliente porque llegó
              con el auto, así que el camino largo es guardar y nada más. */}
          {!form.id && (
            <Boton
              type="button"
              disabled={guardando || !form.nombre.trim()}
              onClick={(e) => guardar(e, true)}
            >
              <Wrench size={15} /> Guardar y crear orden
            </Boton>
          )}
        </div>
      </form>
    </Modal>
  )
}
