/* El circuito de una orden, en un solo lugar: la pantalla, el panel y el
   panel de inicio leen de acá para no repetir la misma tabla de estados con
   tres redacciones distintas.

   Espeja el enum `estado_orden` y el trigger `validar_avance_orden` del
   esquema. Acá decide qué se muestra; quién puede hacerlo lo decide Postgres:
   si esta tabla se desalinea, la base rechaza el cambio igual. */

export const ETAPAS = [
  { valor: 'recepcion',     texto: 'Recepción',     puesto: 'Recepción',      tono: 'neutro' },
  { valor: 'presupuestada', texto: 'Presupuestada', puesto: 'Administración', tono: 'atencion' },
  { valor: 'aprobada',      texto: 'Aprobada',      puesto: 'Taller',         tono: 'marca' },
  { valor: 'en_proceso',    texto: 'En proceso',    puesto: 'Taller',         tono: 'atencion' },
  { valor: 'terminada',     texto: 'Terminada',     puesto: 'Recepción',      tono: 'conforme' },
  { valor: 'entregada',     texto: 'Entregada',     puesto: '—',              tono: 'neutro' },
]

/* El tablero muestra el trabajo vivo. Lo entregado es historial y se consulta
   aparte: si no, la columna crece para siempre y tapa lo que hay que hacer. */
export const ETAPAS_ACTIVAS = ETAPAS.filter((e) => e.valor !== 'entregada')

export const etapaDe = (valor) => ETAPAS.find((e) => e.valor === valor) ?? ETAPAS[0]

/* El paso que sigue y quién lo da. `entregada` no se escribe a mano: pasa por
   la función `entregar_orden`, que además factura y descuenta el stock. */
const AVANCES = {
  recepcion:     { destino: 'presupuestada', texto: 'Armar plan de trabajo',   roles: ['gerencia'] },
  presupuestada: { destino: 'aprobada',      texto: 'Registrar aprobación',    roles: ['gerencia', 'vendedor'] },
  aprobada:      { destino: 'en_proceso',    texto: 'Iniciar trabajo',         roles: ['gerencia', 'mecanico'] },
  en_proceso:    { destino: 'terminada',     texto: 'Marcar como terminada',   roles: ['gerencia', 'mecanico'] },
  terminada:     { destino: 'entregada',     texto: 'Entregar y facturar',     roles: ['gerencia', 'vendedor'] },
}

export const avanceDe = (estado, rol) => {
  const paso = AVANCES[estado]
  return paso && paso.roles.includes(rol) ? paso : null
}

/* Quién es dueño del plan de trabajo, y hasta cuándo: una vez que el cliente
   aprobó el presupuesto, cambiarlo sería cobrarle otra cosa. */
export const puedeEditarPlan = (orden, rol) =>
  rol === 'gerencia' && ['recepcion', 'presupuestada'].includes(orden.estado)

export const puedeEditarRecepcion = (orden, rol) =>
  ['gerencia', 'vendedor'].includes(rol) && ['recepcion', 'presupuestada'].includes(orden.estado)
