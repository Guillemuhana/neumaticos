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

/* Lo que pesa un adjunto. Sin decimales hasta el mega, porque «847 kB» se lee
   de un vistazo y «0,83 MB» hay que pensarlo. */
export const peso = (bytes) => {
  const n = Number(bytes) || 0
  if (n < 1024) return `${n} B`
  if (n < 1024 * 1024) return `${Math.round(n / 1024)} kB`
  return `${(n / 1024 / 1024).toFixed(1).replace('.', ',')} MB`
}

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

/* Para listas de un solo día —las ventas de hoy, las fichadas— donde repetir
   la fecha en cada fila no agrega nada y estorba a la lectura de la columna. */
export const hora = (d) => (d ? format(aFecha(d), 'HH:mm', { locale: es }) : '—')

/* Para el nombre de un archivo que se descarga. Sin barras —que en un nombre
   de archivo no se pueden usar— y arrancando por el año, así la carpeta de
   descargas queda ordenada sola. */
export const sello = (d) => (d ? format(aFecha(d), 'yyyy-MM-dd-HHmm', { locale: es }) : 'sin-fecha')

export const desde = (d) =>
  d ? formatDistanceToNow(aFecha(d), { locale: es, addSuffix: true }) : '—'
