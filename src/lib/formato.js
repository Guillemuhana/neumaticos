import { format, formatDistanceToNow } from 'date-fns'
import { es } from 'date-fns/locale'

const moneda = new Intl.NumberFormat('es-AR', {
  style: 'currency',
  currency: 'ARS',
  maximumFractionDigits: 0,
})

export const plata = (n) => moneda.format(Number(n) || 0)

/* Un comprobante lleva los centavos: es el importe que va a cotejar el
   contador contra ARCA, y ahí un peso de diferencia es una diferencia. */
const monedaExacta = new Intl.NumberFormat('es-AR', {
  style: 'currency',
  currency: 'ARS',
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
})

export const plataExacta = (n) => monedaExacta.format(Number(n) || 0)

export const numero = (n) => new Intl.NumberFormat('es-AR').format(Number(n) || 0)

/* Un `date` de Postgres llega como '2026-08-03', sin hora, y `new Date` lo lee
   como medianoche UTC: en Argentina eso son las 21 del día anterior, así que
   la fecha impresa en un comprobante salía corrida un día. Las fechas sin hora
   se arman con los números en local; las que traen hora no se tocan. */
const aFecha = (d) => {
  if (d instanceof Date) return d
  const dia = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(d))
  return dia ? new Date(Number(dia[1]), Number(dia[2]) - 1, Number(dia[3])) : new Date(d)
}

export const fecha = (d) => (d ? format(aFecha(d), "d 'de' MMM, HH:mm", { locale: es }) : '—')

export const fechaCorta = (d) => (d ? format(aFecha(d), 'dd/MM/yy', { locale: es }) : '—')

export const desde = (d) =>
  d ? formatDistanceToNow(aFecha(d), { locale: es, addSuffix: true }) : '—'
