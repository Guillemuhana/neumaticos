import { Car, Check, Plus } from 'lucide-react'
import { useConsulta } from '../../hooks/useConsulta'
import { supabase } from '../../lib/supabase'
import { errorDeVehiculo, nombreVehiculo, patenteNormal } from '../../lib/vehiculos'
import { Boton, Campo, estiloInput } from '../UI'

/* Los autos que ya tiene el cliente, primero; cargar uno nuevo, después. Ese
   orden es el que evita que el mismo Corolla entre cuatro veces con la patente
   escrita de cuatro maneras, que es lo que pasaba cuando el vehículo era un
   campo de texto en blanco en cada orden.

   Lo comparten el alta de la orden y la cotización: en el flujo que arranca
   por presupuesto, el auto se elige antes de que el auto exista en el taller,
   y lo que se cotiza depende de él —cuatro cubiertas para una Ranger no son
   las mismas que para un Corsa—. */
export default function SelectorVehiculo({ cliente, vehiculo, onElegir }) {
  const { datos, cargando } = useConsulta(
    () =>
      cliente
        ? supabase
            .from('vehiculos')
            .select('*')
            .eq('cliente_id', cliente.id)
            .order('creado_en', { ascending: false })
        : Promise.resolve({ data: [], error: null }),
    [cliente?.id]
  )

  if (!cliente) {
    return (
      <p className="rounded-lg border border-dashed border-acero-200 px-3 py-4 text-center text-sm text-acero-500">
        Elegí al cliente y acá aparecen sus vehículos.
      </p>
    )
  }

  /* Ya está resuelto: uno de los suyos, o uno nuevo a medio cargar. */
  if (vehiculo?.id) {
    return (
      <div className="flex items-center justify-between gap-3 rounded-lg border border-conforme-100 bg-conforme-50 px-3 py-2.5">
        <div className="min-w-0">
          <p className="flex items-center gap-1.5 text-sm font-semibold text-conforme-700">
            <Check size={14} aria-hidden="true" />
            {nombreVehiculo(vehiculo)}
          </p>
          <p className="truncate font-mono text-xs uppercase text-conforme-700/80">
            {vehiculo.patente || 'Sin patente'}
          </p>
        </div>
        <Boton type="button" variante="fantasma" className="px-2 py-1" onClick={() => onElegir(null)}>
          Cambiar
        </Boton>
      </div>
    )
  }

  if (vehiculo) {
    const campoNuevo = (k) => ({
      value: vehiculo[k] ?? '',
      onChange: (e) => onElegir({ ...vehiculo, [k]: e.target.value }),
    })

    return (
      <div className="space-y-3 rounded-lg border border-concreto-200 bg-concreto-50 p-3">
        <p className="text-menor font-semibold text-caucho-800">Vehículo nuevo</p>

        <div className="grid gap-3 sm:grid-cols-2">
          <Campo etiqueta="Marca">
            <input autoFocus className={estiloInput} placeholder="Ford" {...campoNuevo('marca')} />
          </Campo>
          <Campo etiqueta="Modelo">
            <input className={estiloInput} placeholder="Ranger 2019" {...campoNuevo('modelo')} />
          </Campo>
        </div>

        <Campo etiqueta="Patente" ayuda="Queda guardada en el cliente: la próxima visita ya no se tipea.">
          <input className={`${estiloInput} uppercase`} placeholder="AB123CD" {...campoNuevo('patente')} />
        </Campo>

        {datos?.length > 0 && (
          <Boton type="button" variante="fantasma" className="px-2 py-1" onClick={() => onElegir(null)}>
            Ver los que ya tiene
          </Boton>
        )}
      </div>
    )
  }

  const vehiculos = datos ?? []

  return (
    <div>
      {cargando ? (
        <p className="py-2 text-sm text-acero-500">Buscando sus vehículos…</p>
      ) : vehiculos.length > 0 ? (
        <ul className="mb-2 overflow-hidden rounded-lg border border-concreto-200">
          {vehiculos.map((v) => (
            <li key={v.id}>
              <button
                type="button"
                onClick={() => onElegir(v)}
                className="flex w-full items-center justify-between gap-3 border-b border-concreto-200 px-3 py-2 text-left last:border-b-0 hover:bg-concreto-50"
              >
                <span className="flex items-center gap-2 text-sm font-medium">
                  <Car size={15} className="shrink-0 text-acero-400" aria-hidden="true" />
                  {nombreVehiculo(v)}
                </span>
                <span className="font-mono text-xs uppercase text-acero-500">
                  {v.patente || '—'}
                </span>
              </button>
            </li>
          ))}
        </ul>
      ) : (
        <p className="mb-2 text-sm text-acero-500">
          Es la primera vez que trae un auto. Cargalo y queda asociado a él.
        </p>
      )}

      <Boton
        type="button"
        variante="secundario"
        onClick={() => onElegir({ marca: '', modelo: '', patente: '' })}
      >
        <Plus size={15} /> {vehiculos.length ? 'Otro vehículo' : 'Cargar vehículo'}
      </Boton>
    </div>
  )
}

/* Da de alta el auto nuevo si hace falta y devuelve el que quedó elegido. Lo
   comparten los dos formularios porque el alta tiene una trampa: si falla —una
   patente repetida es lo habitual— no se puede seguir, o el cliente termina
   con un auto fantasma en la ficha. */
export async function asegurarVehiculo(cliente, vehiculo) {
  if (!vehiculo?.marca?.trim()) return { error: 'Elegí el vehículo o cargá uno nuevo.' }
  if (vehiculo.id) return { vehiculo }

  const { data, error } = await supabase
    .from('vehiculos')
    .insert({
      cliente_id: cliente.id,
      marca: vehiculo.marca.trim(),
      modelo: vehiculo.modelo?.trim() || null,
      patente: patenteNormal(vehiculo.patente),
    })
    .select()
    .single()

  if (error) return { error: errorDeVehiculo(error) }
  return { vehiculo: data }
}
