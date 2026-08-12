/* El circuito de una orden, en un solo lugar: la pantalla, el panel y el
   panel de inicio leen de acá para no repetir la misma tabla de estados con
   tres redacciones distintas.

   Espeja el enum `estado_orden` y el trigger `validar_avance_orden` del
   esquema. Acá decide qué se muestra; quién puede hacerlo lo decide Postgres:
   si esta tabla se desalinea, la base rechaza el cambio igual. */

export const ETAPAS = [
  { valor: 'pendiente',       texto: 'Orden creada',       puesto: 'Taller',    tono: 'atencion' },
  { valor: 'en_proceso',      texto: 'En proceso',         puesto: 'Taller',    tono: 'marca' },
  { valor: 'control_calidad', texto: 'Control de calidad', puesto: 'Taller',    tono: 'atencion' },
  { valor: 'terminada',       texto: 'Listo para entrega', puesto: 'Recepción', tono: 'conforme' },
  { valor: 'entregada',       texto: 'Entregada',          puesto: '—',         tono: 'neutro' },
]

/* El tablero muestra el trabajo vivo. Lo entregado es historial y se consulta
   aparte: si no, la columna crece para siempre y tapa lo que hay que hacer. */
export const ETAPAS_ACTIVAS = ETAPAS.filter((e) => e.valor !== 'entregada')

export const etapaDe = (valor) => ETAPAS.find((e) => e.valor === valor) ?? ETAPAS[0]

/* El paso que sigue y quién lo da. `entregada` no se escribe a mano: pasa por
   la función `entregar_orden`, que además factura y descuenta el stock. */
const AVANCES = {
  pendiente:       { destino: 'en_proceso',      texto: 'Tomar y empezar',      roles: ['gerencia', 'mecanico'] },
  en_proceso:      { destino: 'control_calidad', texto: 'Mandar a control',     roles: ['gerencia', 'mecanico'] },
  control_calidad: { destino: 'terminada',       texto: 'Dar por listo',        roles: ['gerencia', 'mecanico'] },
  terminada:       { destino: 'entregada',       texto: 'Entregar y facturar',  roles: ['gerencia', 'vendedor'] },
}

export const avanceDe = (estado, rol) => {
  const paso = AVANCES[estado]
  return paso && paso.roles.includes(rol) ? paso : null
}

/* Los cuatro puntos de la revisión, en el orden en que se hacen sobre el auto.
   La lista vive acá porque la pantalla la dibuja y el trigger la exige: si un
   día se suma un quinto punto, se agrega en los dos lados o la base rechaza
   el avance, que es exactamente lo que tiene que pasar. */
export const CONTROLES = [
  { campo: 'control_aceite',     texto: 'Nivel de aceite' },
  { campo: 'control_neumaticos', texto: 'Presión de neumáticos' },
  { campo: 'control_frenos',     texto: 'Frenos' },
  { campo: 'control_luces',      texto: 'Luces' },
]

export const controlCompleto = (orden) => CONTROLES.every((c) => orden[c.campo])

/* El diagnóstico es del taller y se escribe mientras el auto está en el
   elevador. Después de entregado ya no: la orden es un comprobante. */
export const puedeEditarTrabajo = (orden, rol) =>
  ['gerencia', 'mecanico'].includes(rol) && orden.estado !== 'entregada'

/* El plan se carga en el mostrador y se puede completar hasta la entrega:
   recién ahí se sabe qué llevó de verdad el trabajo. Después es un
   comprobante y no se toca. */
export const puedeEditarPlan = (orden, rol) =>
  ['gerencia', 'vendedor'].includes(rol) && orden.estado !== 'entregada'

export const puedeEditarRecepcion = (orden, rol) =>
  ['gerencia', 'vendedor'].includes(rol) && orden.estado !== 'entregada'
