import { useEffect, useState } from 'react'
import { Check, Search, UserPlus } from 'lucide-react'
import { useAuth } from '../../context/AuthProvider'
import { supabase } from '../../lib/supabase'
import { Aviso, Boton, Campo, Modal, estiloInput } from '../UI'

/* Primer escritorio: llega el vehículo y recepción toma los datos.
   La orden nace en 'recepcion' y sin plan — valorizarla es trabajo de
   administración, y el esquema no deja saltearse ese paso. */

const VACIO = {
  vehiculo: '',
  patente: '',
  kilometraje: '',
  falla_reportada: '',
  notas: '',
}

export default function RecibirVehiculo({ onCerrar, onGuardada }) {
  const { sesion } = useAuth()
  const [form, setForm] = useState(VACIO)
  const [cliente, setCliente] = useState(null)
  const [error, setError] = useState('')
  const [guardando, setGuardando] = useState(false)

  const campo = (k) => ({
    value: form[k],
    onChange: (e) => setForm({ ...form, [k]: e.target.value }),
  })

  const guardar = async (e) => {
    e.preventDefault()
    if (!cliente) {
      setError('Identificá al cliente antes de recibir el vehículo.')
      return
    }

    setGuardando(true)
    setError('')

    const { error } = await supabase.from('ordenes').insert({
      cliente_id: cliente.id,
      recepcionista_id: sesion.user.id,
      vehiculo: form.vehiculo.trim(),
      patente: form.patente.trim().toUpperCase() || null,
      kilometraje: form.kilometraje === '' ? null : Number(form.kilometraje),
      falla_reportada: form.falla_reportada.trim() || null,
      notas: form.notas.trim() || null,
      estado: 'recepcion',
    })

    if (error) {
      setError(error.message)
      setGuardando(false)
    } else onGuardada()
  }

  return (
    <Modal titulo="Recibir vehículo" onCerrar={onCerrar}>
      <form onSubmit={guardar} className="space-y-4">
        <BuscadorCliente cliente={cliente} onElegir={setCliente} />

        <div className="grid gap-4 sm:grid-cols-2">
          <Campo etiqueta="Vehículo">
            <input required className={estiloInput} placeholder="Ford Ranger 2019" {...campo('vehiculo')} />
          </Campo>
          <Campo etiqueta="Patente">
            <input className={`${estiloInput} uppercase`} placeholder="AB123CD" {...campo('patente')} />
          </Campo>
        </div>

        <Campo etiqueta="Kilometraje">
          <input type="number" min="0" className={estiloInput} placeholder="82000" {...campo('kilometraje')} />
        </Campo>

        <Campo etiqueta="Falla reportada" ayuda="Lo que dice el cliente, con sus palabras.">
          <textarea
            rows={3}
            className={estiloInput}
            placeholder="Ruido en el tren delantero al doblar…"
            {...campo('falla_reportada')}
          />
        </Campo>

        <Campo etiqueta="Notas de recepción">
          <input className={estiloInput} placeholder="Entrega llave de rueda" {...campo('notas')} />
        </Campo>

        <Aviso>{error}</Aviso>

        <div className="flex justify-end gap-2">
          <Boton type="button" variante="secundario" onClick={onCerrar}>
            Cancelar
          </Boton>
          <Boton type="submit" disabled={guardando}>
            {guardando ? 'Guardando…' : 'Abrir orden'}
          </Boton>
        </div>
      </form>
    </Modal>
  )
}

/* Buscar por nombre, teléfono o documento, y dar de alta en el mismo lugar:
   en el mostrador nadie va a abrir otra pantalla con el cliente esperando. */
function BuscadorCliente({ cliente, onElegir }) {
  const [busqueda, setBusqueda] = useState('')
  const [resultados, setResultados] = useState([])
  const [buscando, setBuscando] = useState(false)
  const [alta, setAlta] = useState(null)
  const [error, setError] = useState('')

  useEffect(() => {
    const q = busqueda.trim()
    if (cliente || q.length < 2) {
      setResultados([])
      return
    }

    /* Espera a que pare de tipear: sin esto sale una consulta por tecla. */
    let vigente = true
    setBuscando(true)
    const id = setTimeout(async () => {
      const patron = `%${q}%`
      const { data, error } = await supabase
        .from('clientes')
        .select('id, nombre, telefono, documento')
        .or(`nombre.ilike.${patron},telefono.ilike.${patron},documento.ilike.${patron}`)
        .order('nombre')
        .limit(6)

      if (!vigente) return
      setError(error?.message ?? '')
      setResultados(data ?? [])
      setBuscando(false)
    }, 250)

    return () => {
      vigente = false
      clearTimeout(id)
    }
  }, [busqueda, cliente])

  if (cliente) {
    return (
      <div className="flex items-center justify-between gap-3 rounded-lg border border-conforme-100 bg-conforme-50 px-3 py-2.5">
        <div className="min-w-0">
          <p className="flex items-center gap-1.5 text-sm font-semibold text-conforme-700">
            <Check size={14} aria-hidden="true" />
            {cliente.nombre}
          </p>
          <p className="truncate text-xs text-conforme-700/80">
            {cliente.telefono || cliente.documento || 'Sin datos de contacto'}
          </p>
        </div>
        <Boton type="button" variante="fantasma" className="px-2 py-1" onClick={() => onElegir(null)}>
          Cambiar
        </Boton>
      </div>
    )
  }

  if (alta) {
    return (
      <AltaRapida
        inicial={alta}
        onCancelar={() => setAlta(null)}
        onCreado={(c) => {
          setAlta(null)
          onElegir(c)
        }}
      />
    )
  }

  return (
    <Campo etiqueta="Cliente" ayuda="Buscá por nombre, teléfono o documento.">
      <div className="relative">
        <Search
          size={16}
          className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-acero-500"
          aria-hidden="true"
        />
        <input
          className={`${estiloInput} pl-9`}
          placeholder="Pérez, 351…, 30111222"
          value={busqueda}
          onChange={(e) => setBusqueda(e.target.value)}
        />
      </div>

      {error && <p className="mt-1 text-xs text-perez-700">{error}</p>}

      {busqueda.trim().length >= 2 && (
        <div className="mt-2 overflow-hidden rounded-lg border border-concreto-200">
          {resultados.map((c) => (
            <button
              key={c.id}
              type="button"
              onClick={() => onElegir(c)}
              className="flex w-full items-center justify-between gap-3 border-b border-concreto-200 px-3 py-2 text-left last:border-b-0 hover:bg-concreto-50"
            >
              <span className="text-sm font-medium">{c.nombre}</span>
              <span className="font-mono text-xs text-acero-500">
                {c.telefono || c.documento || '—'}
              </span>
            </button>
          ))}

          <button
            type="button"
            onClick={() => setAlta({ nombre: busqueda.trim(), telefono: '', documento: '' })}
            className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm font-semibold text-perez-700 hover:bg-perez-50"
          >
            <UserPlus size={15} aria-hidden="true" />
            {buscando && !resultados.length ? 'Buscando…' : `Dar de alta “${busqueda.trim()}”`}
          </button>
        </div>
      )}
    </Campo>
  )
}

function AltaRapida({ inicial, onCancelar, onCreado }) {
  const [form, setForm] = useState(inicial)
  const [error, setError] = useState('')
  const [guardando, setGuardando] = useState(false)

  const campo = (k) => ({
    value: form[k],
    onChange: (e) => setForm({ ...form, [k]: e.target.value }),
  })

  /* No es un <form>: está adentro del formulario de la orden y anidar dos
     forms hace que Enter dispare el de afuera con la orden a medio cargar. */
  const crear = async () => {
    setGuardando(true)
    setError('')

    const { data, error } = await supabase
      .from('clientes')
      .insert({
        nombre: form.nombre.trim(),
        telefono: form.telefono.trim() || null,
        documento: form.documento.trim() || null,
      })
      .select('id, nombre, telefono, documento')
      .single()

    if (error) {
      setError(error.message)
      setGuardando(false)
    } else onCreado(data)
  }

  return (
    <div className="space-y-3 rounded-lg border border-concreto-200 bg-concreto-50 p-3">
      <p className="text-[0.8125rem] font-semibold text-caucho-800">Cliente nuevo</p>

      <Campo etiqueta="Nombre completo">
        <input className={estiloInput} {...campo('nombre')} />
      </Campo>
      <div className="grid gap-3 sm:grid-cols-2">
        <Campo etiqueta="Teléfono">
          <input className={estiloInput} {...campo('telefono')} />
        </Campo>
        <Campo etiqueta="Documento">
          <input className={estiloInput} {...campo('documento')} />
        </Campo>
      </div>

      <Aviso>{error}</Aviso>

      <div className="flex justify-end gap-2">
        <Boton type="button" variante="secundario" onClick={onCancelar}>
          Cancelar
        </Boton>
        <Boton type="button" onClick={crear} disabled={guardando || !form.nombre.trim()}>
          {guardando ? 'Creando…' : 'Crear y usar'}
        </Boton>
      </div>
    </div>
  )
}
