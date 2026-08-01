import { useEffect, useState } from 'react'
import { Check, Search, UserPlus } from 'lucide-react'
import { useAuth } from '../../context/AuthProvider'
import { useConsulta } from '../../hooks/useConsulta'
import { supabase } from '../../lib/supabase'
import { Aviso, Boton, Campo, Modal, estiloInput } from '../UI'

/* Alta de la orden, tal como pasa en el mostrador: quién es el cliente, qué
   vehículo dejó, qué dice que le pasa y quién lo va a atender.

   El mecánico se elige acá y no más adelante porque en el taller se decide
   apenas entra el auto. La orden igual nace en 'recepcion': valorizarla es
   trabajo de administración y el esquema no deja saltearse ese paso. */

const VACIO = {
  vehiculo: '',
  patente: '',
  kilometraje: '',
  falla_reportada: '',
  notas: '',
}

export default function NuevaOrden({ clienteInicial = null, onCerrar, onGuardada }) {
  const { sesion } = useAuth()
  const [form, setForm] = useState(VACIO)
  /* Si se llega desde la ficha de un cliente, el paso 1 ya está resuelto. */
  const [cliente, setCliente] = useState(clienteInicial)
  const [mecanicoId, setMecanicoId] = useState('')
  const [error, setError] = useState('')
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

  const guardar = async (e) => {
    e.preventDefault()
    if (!cliente) {
      setError('Identificá al cliente antes de crear la orden.')
      return
    }

    setGuardando(true)
    setError('')

    const { data, error } = await supabase
      .from('ordenes')
      .insert({
        cliente_id: cliente.id,
        recepcionista_id: sesion.user.id,
        mecanico_id: mecanicoId || null,
        vehiculo: form.vehiculo.trim(),
        patente: form.patente.trim().toUpperCase() || null,
        kilometraje: form.kilometraje === '' ? null : Number(form.kilometraje),
        falla_reportada: form.falla_reportada.trim() || null,
        notas: form.notas.trim() || null,
        estado: 'recepcion',
      })
      .select('id')
      .single()

    if (error) {
      setError(error.message)
      setGuardando(false)
    } else onGuardada(data.id)
  }

  return (
    <Modal titulo="Nueva orden de trabajo" onCerrar={onCerrar}>
      <form onSubmit={guardar} className="space-y-5">
        <Paso numero={1} titulo="Cliente">
          <BuscadorCliente cliente={cliente} onElegir={setCliente} />
        </Paso>

        <Paso numero={2} titulo="Vehículo">
          <div className="space-y-3">
            <div className="grid gap-3 sm:grid-cols-2">
              <Campo etiqueta="Vehículo">
                <input
                  required
                  className={estiloInput}
                  placeholder="Ford Ranger 2019"
                  {...campo('vehiculo')}
                />
              </Campo>
              <Campo etiqueta="Patente">
                <input
                  className={`${estiloInput} uppercase`}
                  placeholder="AB123CD"
                  {...campo('patente')}
                />
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
          </div>
        </Paso>

        <Paso numero={3} titulo="Taller">
          <Campo
            etiqueta="Mecánico asignado"
            ayuda="Podés dejarlo sin asignar y elegirlo después, pero el trabajo no arranca sin mecánico."
          >
            <select
              className={estiloInput}
              value={mecanicoId}
              onChange={(e) => setMecanicoId(e.target.value)}
            >
              <option value="">Sin asignar</option>
              {mecanicos?.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.nombre}
                </option>
              ))}
            </select>
          </Campo>

          {mecanicos && mecanicos.length === 0 && (
            <p className="mt-2 text-xs text-atencion-700">
              No hay nadie con rol mecánico activo. Gerencia lo da de alta desde Personal.
            </p>
          )}
        </Paso>

        <Aviso>{error}</Aviso>

        <div className="flex justify-end gap-2">
          <Boton type="button" variante="secundario" onClick={onCerrar}>
            Cancelar
          </Boton>
          <Boton type="submit" disabled={guardando}>
            {guardando ? 'Creando…' : 'Crear orden'}
          </Boton>
        </div>
      </form>
    </Modal>
  )
}

/* Numerar los bloques es la diferencia entre "un formulario largo" y "tres
   cosas que tengo que completar". */
function Paso({ numero, titulo, children }) {
  return (
    <section>
      <div className="mb-2 flex items-center gap-2">
        <span className="flex h-5 w-5 items-center justify-center rounded-full bg-caucho-950 text-[0.6875rem] font-bold text-white">
          {numero}
        </span>
        <h3 className="display text-sm font-bold">{titulo}</h3>
      </div>
      {children}
    </section>
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
    if (cliente || alta || q.length < 2) {
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
  }, [busqueda, cliente, alta])

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

  const escrito = busqueda.trim()

  return (
    <div>
      {/* Buscar y dar de alta conviven: el cliente nuevo no tiene que
          descubrirse escribiendo un nombre que no va a encontrar. */}
      <div className="flex gap-2">
        <div className="relative flex-1">
          <Search
            size={16}
            className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-acero-500"
            aria-hidden="true"
          />
          <input
            className={`${estiloInput} pl-9`}
            placeholder="Buscar por nombre, teléfono o documento…"
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
          />
        </div>
        <Boton
          type="button"
          variante="secundario"
          className="shrink-0"
          onClick={() => setAlta({ nombre: escrito, telefono: '', documento: '' })}
        >
          <UserPlus size={16} /> Nuevo
        </Boton>
      </div>

      {error && <p className="mt-1 text-xs text-perez-700">{error}</p>}

      {escrito.length >= 2 && (
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

          {!resultados.length && (
            <p className="px-3 py-2 text-sm text-acero-500">
              {buscando ? 'Buscando…' : `Nadie coincide con “${escrito}”. Dalo de alta con “Nuevo”.`}
            </p>
          )}
        </div>
      )}
    </div>
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
        <input autoFocus className={estiloInput} {...campo('nombre')} />
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
