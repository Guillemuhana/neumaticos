import { useState } from 'react'
import { ClipboardList, Plus } from 'lucide-react'
import { useAuth } from '../context/AuthProvider'
import { useConsulta } from '../hooks/useConsulta'
import { supabase } from '../lib/supabase'
import { desde } from '../lib/formato'
import {
  Aviso,
  Boton,
  Campo,
  Cargando,
  Encabezado,
  Etiqueta,
  Modal,
  Tarjeta,
  Vacio,
  estiloInput,
} from '../components/UI'

const estados = [
  { valor: 'pendiente', texto: 'Pendiente', tono: 'neutro' },
  { valor: 'en_proceso', texto: 'En proceso', tono: 'atencion' },
  { valor: 'terminada', texto: 'Terminada', tono: 'conforme' },
  { valor: 'entregada', texto: 'Entregada', tono: 'marca' },
]

const servicios = ['Alineación', 'Balanceo', 'Cambio de cubiertas', 'Rotación', 'Reparación', 'Tren delantero']

export default function Taller() {
  const [creando, setCreando] = useState(false)

  const { datos, cargando, error, recargar } = useConsulta(
    () =>
      supabase
        .from('ordenes')
        .select('*, clientes(nombre), perfiles(nombre)')
        .order('creada_en', { ascending: false })
        .limit(100),
    []
  )

  const mover = async (orden, estado) => {
    const cerrada_en = estado === 'entregada' ? new Date().toISOString() : null
    const { error } = await supabase.from('ordenes').update({ estado, cerrada_en }).eq('id', orden.id)
    if (error) alert(error.message)
    recargar()
  }

  return (
    <>
      <Encabezado titulo="Taller" detalle="Órdenes de trabajo y su avance.">
        <Boton onClick={() => setCreando(true)}>
          <Plus size={16} /> Nueva orden
        </Boton>
      </Encabezado>

      {error && <Aviso>{error}</Aviso>}

      {cargando ? (
        <Cargando texto="Buscando órdenes…" alto="min-h-[40vh]" />
      ) : !datos?.length ? (
        <Tarjeta>
          <Vacio icono={ClipboardList} titulo="No hay órdenes" detalle="Cargá la primera orden de trabajo." />
        </Tarjeta>
      ) : (
        /* Tablero por estado: el mecánico ve de un vistazo qué le falta. */
        <div className="grid gap-4 lg:grid-cols-4">
          {estados.map((col) => {
            const enColumna = datos.filter((o) => o.estado === col.valor)
            return (
              <section key={col.valor} className="space-y-3">
                <div className="flex items-center justify-between">
                  <h2 className="display text-sm font-bold uppercase tracking-wide">{col.texto}</h2>
                  <span className="font-mono text-xs text-acero-500">{enColumna.length}</span>
                </div>

                {enColumna.map((o) => (
                  <Tarjeta key={o.id} className="p-4">
                    <p className="font-semibold">{o.vehiculo}</p>
                    {o.patente && (
                      <p className="font-mono text-xs uppercase text-acero-500">{o.patente}</p>
                    )}
                    <p className="mt-2 text-sm text-acero-500">{o.clientes?.nombre ?? 'Sin cliente'}</p>

                    {o.servicios?.length > 0 && (
                      <div className="mt-2 flex flex-wrap gap-1">
                        {o.servicios.map((s) => (
                          <Etiqueta key={s}>{s}</Etiqueta>
                        ))}
                      </div>
                    )}

                    <p className="mt-3 text-xs text-acero-500">
                      {o.perfiles?.nombre ?? 'Sin asignar'} · {desde(o.creada_en)}
                    </p>

                    <select
                      className="mt-3 w-full rounded border border-acero-200 px-2 py-1.5 text-sm"
                      value={o.estado}
                      onChange={(e) => mover(o, e.target.value)}
                      aria-label={`Estado de ${o.vehiculo}`}
                    >
                      {estados.map((e) => (
                        <option key={e.valor} value={e.valor}>
                          {e.texto}
                        </option>
                      ))}
                    </select>
                  </Tarjeta>
                ))}
              </section>
            )
          })}
        </div>
      )}

      {creando && (
        <NuevaOrden
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

function NuevaOrden({ onCerrar, onGuardada }) {
  const { sesion, rol } = useAuth()
  const [form, setForm] = useState({ vehiculo: '', patente: '', cliente: '', notas: '' })
  const [elegidos, setElegidos] = useState([])
  const [error, setError] = useState('')
  const [guardando, setGuardando] = useState(false)

  const campo = (k) => ({
    value: form[k],
    onChange: (e) => setForm({ ...form, [k]: e.target.value }),
  })

  const guardar = async (e) => {
    e.preventDefault()
    setGuardando(true)
    setError('')

    let cliente_id = null
    const nombre = form.cliente.trim()
    if (nombre) {
      const { data: hallado } = await supabase
        .from('clientes')
        .select('id')
        .ilike('nombre', nombre)
        .maybeSingle()
      cliente_id = hallado?.id ?? null
    }

    const { error } = await supabase.from('ordenes').insert({
      cliente_id,
      mecanico_id: rol === 'mecanico' ? sesion.user.id : null,
      vehiculo: form.vehiculo.trim(),
      patente: form.patente.trim().toUpperCase() || null,
      servicios: elegidos,
      notas: form.notas.trim() || null,
    })

    if (error) {
      setError(error.message)
      setGuardando(false)
    } else onGuardada()
  }

  return (
    <Modal titulo="Nueva orden de trabajo" onCerrar={onCerrar}>
      <form onSubmit={guardar} className="space-y-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <Campo etiqueta="Vehículo">
            <input required className={estiloInput} placeholder="Ford Ranger 2019" {...campo('vehiculo')} />
          </Campo>
          <Campo etiqueta="Patente">
            <input className={`${estiloInput} uppercase`} placeholder="AB123CD" {...campo('patente')} />
          </Campo>
        </div>

        <Campo etiqueta="Cliente" ayuda="Tiene que estar cargado; si no, queda sin asociar.">
          <input className={estiloInput} {...campo('cliente')} />
        </Campo>

        <fieldset>
          <legend className="mb-1.5 text-sm font-medium text-caucho-800">Servicios</legend>
          <div className="flex flex-wrap gap-2">
            {servicios.map((s) => {
              const activo = elegidos.includes(s)
              return (
                <button
                  key={s}
                  type="button"
                  onClick={() =>
                    setElegidos((prev) => (activo ? prev.filter((x) => x !== s) : [...prev, s]))
                  }
                  className={`rounded-md border px-3 py-1.5 text-sm transition-colors ${
                    activo
                      ? 'border-perez-600 bg-perez-50 font-semibold text-perez-700'
                      : 'border-acero-200 bg-white text-caucho-800 hover:bg-concreto-100'
                  }`}
                >
                  {s}
                </button>
              )
            })}
          </div>
        </fieldset>

        <Campo etiqueta="Notas">
          <input className={estiloInput} {...campo('notas')} />
        </Campo>

        <Aviso>{error}</Aviso>

        <div className="flex justify-end gap-2">
          <Boton type="button" variante="secundario" onClick={onCerrar}>
            Cancelar
          </Boton>
          <Boton type="submit" disabled={guardando}>
            {guardando ? 'Guardando…' : 'Crear orden'}
          </Boton>
        </div>
      </form>
    </Modal>
  )
}
