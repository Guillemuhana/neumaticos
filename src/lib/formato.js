import { format, formatDistanceToNow } from 'date-fns'
import { es } from 'date-fns/locale'

const moneda = new Intl.NumberFormat('es-AR', {
  style: 'currency',
  currency: 'ARS',
  maximumFractionDigits: 0,
})

export const plata = (n) => moneda.format(Number(n) || 0)

export const numero = (n) => new Intl.NumberFormat('es-AR').format(Number(n) || 0)

export const fecha = (d) => (d ? format(new Date(d), "d 'de' MMM, HH:mm", { locale: es }) : '—')

export const fechaCorta = (d) => (d ? format(new Date(d), 'dd/MM/yy', { locale: es }) : '—')

export const desde = (d) =>
  d ? formatDistanceToNow(new Date(d), { locale: es, addSuffix: true }) : '—'
