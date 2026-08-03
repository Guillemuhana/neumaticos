/* Las reglas de facturación, en un solo lugar. Acá viven los códigos que ARCA
   espera: hoy los mira una persona para copiar el comprobante en el portal, y
   mañana los va a mandar el web service sin que haya que buscarlos de nuevo.

   Espeja los enums `condicion_iva`, `tipo_comprobante` y `estado_comprobante`
   del esquema. Si esta tabla se desalinea, la base rechaza el cambio igual. */

const soloDigitos = (v) => String(v ?? '').replace(/\D/g, '')

export const CONDICIONES_IVA = [
  {
    valor: 'responsable_inscripto',
    texto: 'Responsable Inscripto',
    // Como se imprime en el comprobante, con la redacción de ARCA.
    leyenda: 'IVA Responsable Inscripto',
    codigo: 1,
    exigeCuit: true,
  },
  { valor: 'monotributo',      texto: 'Monotributo',      leyenda: 'Responsable Monotributo', codigo: 6, exigeCuit: true },
  { valor: 'exento',           texto: 'Exento',           leyenda: 'IVA Sujeto Exento',       codigo: 4, exigeCuit: false },
  { valor: 'consumidor_final', texto: 'Consumidor Final', leyenda: 'Consumidor Final',        codigo: 5, exigeCuit: false },
]

export const condicionDe = (valor) =>
  CONDICIONES_IVA.find((c) => c.valor === valor) ?? CONDICIONES_IVA[3]

/* Solo facturas: la nota de crédito es otro circuito y todavía no está.
   `codigo` es el tipo de comprobante de ARCA (1 = Factura A, 6 = Factura B). */
export const TIPOS_COMPROBANTE = [
  {
    valor: 'factura_a',
    texto: 'Factura A',
    letra: 'A',
    codigo: 1,
    /* La A va a otro Responsable Inscripto, que se toma el IVA como crédito
       fiscal: por eso lo tiene que ver renglón por renglón. En la B el IVA
       está adentro del precio y no se muestra. */
    discriminaIva: true,
  },
  { valor: 'factura_b', texto: 'Factura B', letra: 'B', codigo: 6, discriminaIva: false },
]

export const tipoDe = (valor) =>
  TIPOS_COMPROBANTE.find((t) => t.valor === valor) ?? TIPOS_COMPROBANTE[1]

export const ESTADOS_COMPROBANTE = {
  pendiente: { texto: 'Pendiente de CAE', tono: 'atencion' },
  emitido:   { texto: 'Emitido',          tono: 'conforme' },
  anulado:   { texto: 'Anulado',          tono: 'neutro' },
}

export const estadoDe = (valor) => ESTADOS_COMPROBANTE[valor] ?? ESTADOS_COMPROBANTE.pendiente

/* La letra sale de cómo está inscripto el cliente, no de lo que se vende: al
   Responsable Inscripto le va una A, a todos los demás una B. Sin CUIT no hay
   A posible, así que en ese caso cae a B y administración lo corrige. */
export const tipoSugerido = (cliente) =>
  cliente?.condicion_iva === 'responsable_inscripto' && soloDigitos(cliente?.cuit).length === 11
    ? 'factura_a'
    : 'factura_b'

/* Módulo 11, el mismo dígito verificador que valida ARCA. Se chequea en el
   mostrador porque un CUIT mal tipeado no se ve hasta que el web service
   rechaza el comprobante, y para entonces el cliente ya se fue. */
export const cuitValido = (cuit) => {
  const d = soloDigitos(cuit)
  if (d.length !== 11) return false

  const pesos = [5, 4, 3, 2, 7, 6, 5, 4, 3, 2]
  const resto = 11 - (pesos.reduce((a, p, i) => a + p * Number(d[i]), 0) % 11)
  const verificador = resto === 11 ? 0 : resto === 10 ? 9 : resto

  return verificador === Number(d[10])
}

export const cuitFormateado = (cuit) => {
  const d = soloDigitos(cuit)
  return d.length === 11 ? `${d.slice(0, 2)}-${d.slice(2, 10)}-${d.slice(10)}` : (cuit ?? '')
}

/* 0001-00000123, como lo numera ARCA y como lo busca después el contador. */
export const numeroComprobante = (c) =>
  c?.numero
    ? `${String(c.punto_venta).padStart(4, '0')}-${String(c.numero).padStart(8, '0')}`
    : `${String(c?.punto_venta ?? 0).padStart(4, '0')}-sin numerar`
