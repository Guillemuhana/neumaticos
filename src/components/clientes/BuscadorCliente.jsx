import { useEffect, useState } from 'react'
import { Check, Search, UserPlus } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { Aviso, Boton, Campo, estiloInput } from '../UI'

/* Buscar por nombre, teléfono o documento, y dar de alta en el mismo lugar:
   en el mostrador nadie va a abrir otra pantalla con el cliente esperando.

   Vive acá y no adentro del alta de la orden porque la cotización identifica
   al cliente igual que la orden. Cuando eran dos, la venta lo buscaba por
   nombre con un `ilike` y creaba un cliente nuevo ante el menor tipeo
   distinto: «Perez SA» y «Pérez S.A.» terminaban siendo dos. */
export default function BuscadorCliente({ cliente, onElegir, opcional = false }) {
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

      {/* En el mostrador se venden cuatro cubiertas sin preguntarle el nombre a
          nadie. Eso es una venta a consumidor final y tiene que seguir siendo
          de dos toques, así que acá se puede no elegir a nadie. */}
      {opcional && (
        <p className="mt-1.5 text-xs text-acero-500">
          Dejalo vacío si es una venta a consumidor final.
        </p>
      )}

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

  /* No es un <form>: está adentro del formulario que lo usa, y anidar dos
     forms hace que Enter dispare el de afuera a medio cargar. */
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
      <p className="text-menor font-semibold text-caucho-800">Cliente nuevo</p>

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
