import { useState } from 'react'
import { useAuth } from '../../context/AuthProvider'
import { useConsulta } from '../../hooks/useConsulta'
import { supabase } from '../../lib/supabase'
import { nombreVehiculo } from '../../lib/vehiculos'
import BuscadorCliente from '../clientes/BuscadorCliente'
import SelectorVehiculo, { asegurarVehiculo } from '../clientes/SelectorVehiculo'
import { Aviso, Boton, Campo, Modal, estiloInput } from '../UI'

/* Alta de la orden, tal como pasa en el mostrador: quién es el cliente, qué
   vehículo dejó, qué dice que le pasa y quién lo va a atender.

   El mecánico se elige acá y no más adelante porque en el taller se decide
   apenas entra el auto. La orden nace en 'pendiente' y ya aparece en el
   tablero del taller: valorizarla se puede hacer después, desde el panel. */

const VACIO = {
  kilometraje: '',
  falla_reportada: '',
  notas: '',
}

export default function NuevaOrden({ clienteInicial = null, onCerrar, onGuardada }) {
  const { sesion } = useAuth()
  const [form, setForm] = useState(VACIO)
  /* Si se llega desde la ficha de un cliente, el paso 1 ya está resuelto. */
  const [cliente, setCliente] = useState(clienteInicial)
  /* El vehículo elegido de los que ya tiene el cliente, o el que se está
     cargando por primera vez. Cuál de los dos es lo dice `id`. */
  const [vehiculo, setVehiculo] = useState(null)
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
    if (!vehiculo?.marca?.trim()) {
      setError('Elegí el vehículo o cargá uno nuevo.')
      return
    }

    setGuardando(true)
    setError('')

    /* Un auto que entra por primera vez se da de alta acá y queda del cliente:
       la próxima visita ya sale en la lista y nadie vuelve a tipear la
       patente. Si el alta falla no se sigue: una orden sin vehículo cargado
       dejaría al cliente con un auto fantasma en la ficha. */
    const alta = await asegurarVehiculo(cliente, vehiculo)
    if (alta.error) {
      setError(alta.error)
      setGuardando(false)
      return
    }
    const elegido = alta.vehiculo

    const { data, error } = await supabase
      .from('ordenes')
      .insert({
        cliente_id: cliente.id,
        recepcionista_id: sesion.user.id,
        mecanico_id: mecanicoId || null,
        vehiculo_id: elegido.id,
        /* El texto se guarda igual, además del vínculo: es cómo entró el auto
           ese día. Si mañana se corrige la patente en la ficha, esta orden
           tiene que seguir diciendo lo que decía el papel que se firmó. */
        vehiculo: nombreVehiculo(elegido),
        patente: elegido.patente,
        kilometraje: form.kilometraje === '' ? null : Number(form.kilometraje),
        falla_reportada: form.falla_reportada.trim() || null,
        notas: form.notas.trim() || null,
        estado: 'pendiente',
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
          <BuscadorCliente
            cliente={cliente}
            onElegir={(c) => {
              setCliente(c)
              /* Cambiar de cliente tiene que soltar el auto: si no, la orden
                 saldría con el vehículo del cliente anterior. */
              setVehiculo(null)
            }}
          />
        </Paso>

        <Paso numero={2} titulo="Vehículo">
          <div className="space-y-3">
            <SelectorVehiculo cliente={cliente} vehiculo={vehiculo} onElegir={setVehiculo} />

            <Campo etiqueta="Kilometraje">
              <input type="number" min="0" className={estiloInput} placeholder="82000" {...campo('kilometraje')} />
            </Campo>

            <Campo
              etiqueta="Qué pide el cliente"
              ayuda="Lo que viene a resolver, con sus palabras. El detalle con precios se carga después."
            >
              <textarea
                rows={3}
                className={estiloInput}
                placeholder="Ruido en el tren delantero al doblar. Quiere alineación y balanceo."
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
            {guardando ? 'Creando…' : 'Crear y enviar al taller'}
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
        <span className="flex h-5 w-5 items-center justify-center rounded-full bg-caucho-950 text-micro font-bold text-white">
          {numero}
        </span>
        <h3 className="display text-sm font-bold">{titulo}</h3>
      </div>
      {children}
    </section>
  )
}
