/* Cómo se nombra y se escribe un auto, en un solo lugar: lo usan el alta de la
   orden, la ficha del cliente y el listado del taller, y si cada uno armara el
   texto a su manera el mismo vehículo se leería distinto en cada pantalla. */

export const nombreVehiculo = (v) => [v?.marca, v?.modelo, v?.anio].filter(Boolean).join(' ')

/* La patente se guarda en mayúsculas y sin espacios. En el mostrador se tipea
   de las dos formas y el índice único de la base compara en mayúsculas: sin
   normalizar acá, "ab123cd" entraría como un auto distinto de "AB123CD". */
export const patenteNormal = (p) => (p ?? '').trim().toUpperCase().replace(/\s+/g, '') || null

/* Postgres devuelve la violación de índice único con su mensaje crudo, que
   nombra al índice y no al problema. Quien está en el mostrador necesita saber
   que ese auto ya está cargado, no cómo se llama la restricción. */
export function errorDeVehiculo(error) {
  if (error?.code === '23505')
    return 'Esa patente ya está cargada, en este cliente o en otro. Buscala antes de crearla de nuevo.'
  return error?.message ?? 'No se pudo guardar el vehículo.'
}
