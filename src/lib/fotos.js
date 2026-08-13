import { achicar } from './imagen'
import { errorDeStorage, supabase } from './supabase'

/* Las fotos del vehículo se sacan en dos lugares: en la orden del taller y en
   el mostrador, cuando el vendedor recibe el auto para mandarlo al taller. Es
   la misma foto y termina en la misma fila, así que la subida vive acá y no
   duplicada en cada pantalla.

   Cuelgan siempre de una orden: lo que queda documentado es *este* ingreso, no
   el auto en abstracto. Por eso el mostrador solo puede sacarlas al aprobar la
   cotización, que es el instante en que la orden nace. */

export const BUCKET = 'vehiculos'

export const MOMENTOS = {
  ingreso: 'Cómo entró',
  trabajo: 'Durante el trabajo',
  entrega: 'Cómo se entregó',
}

/* El momento no se elige: lo dice el estado de la orden. Quien tiene el auto
   delante y el celular en la mano no debería tener que clasificar nada, y el
   90% de las veces la respuesta correcta es la obvia. */
export const momentoSegunEstado = (estado) =>
  estado === 'pendiente'
    ? 'ingreso'
    : estado === 'entregada' || estado === 'terminada'
      ? 'entrega'
      : 'trabajo'

/* Devuelve `{ error }` con el texto ya listo para mostrar, en vez de tirar: los
   dos usos suben varias fotos en fila y necesitan decidir si siguen o cortan. */
export async function subirFotoDeOrden({ ordenId, archivo, momento, subidaPor }) {
  const liviana = await achicar(archivo)
  const ruta = `${ordenId}/${crypto.randomUUID()}.jpg`

  const { error: errorSubida } = await supabase.storage
    .from(BUCKET)
    .upload(ruta, liviana, { cacheControl: '3600', contentType: liviana.type })

  if (errorSubida) return { error: errorDeStorage(errorSubida, BUCKET).message }

  const { error: errorFila } = await supabase.from('orden_fotos').insert({
    orden_id: ordenId,
    momento,
    ruta,
    subida_por: subidaPor,
  })

  /* Si la fila no entra, el archivo queda huérfano en el bucket: se borra acá
     para que no se acumule basura que nadie va a mirar. */
  if (errorFila) {
    await supabase.storage.from(BUCKET).remove([ruta])
    return { error: errorFila.message }
  }

  return {}
}
