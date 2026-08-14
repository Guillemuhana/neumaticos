import { useState } from 'react'
import { Check, Copy, ImageOff, Pencil, Printer, Share2 } from 'lucide-react'
import { numero, plata } from '../../lib/formato'
import { useEmpresa } from '../../hooks/useEmpresa'
import { useImpresion } from '../../hooks/useImpresion'
import PresupuestoImpreso from '../PresupuestoImpreso'
import { Aviso, Boton, Campo, Etiqueta, Modal, estiloInput } from '../UI'

/* La ficha del artículo, pensada para el mostrador: se busca el repuesto y se
   le muestra la pantalla al cliente. Por eso lo grande es la foto, el precio y
   si hay o no; el costo y el margen quedan detrás del rol de gerencia, porque
   esta pantalla se da vuelta sobre la mesa. */

const disponibilidad = (p) => {
  if (!p.stock || p.stock <= 0) return { texto: 'Sin stock', tono: 'atencion', pie: 'Hay que pedirlo' }
  if (p.stock <= p.stock_minimo)
    return { texto: 'Últimas unidades', tono: 'atencion', pie: `Quedan ${numero(p.stock)}` }
  return { texto: 'Disponible', tono: 'conforme', pie: `${numero(p.stock)} en stock` }
}

export default function FichaProducto({ producto: p, gestiona, onCerrar, onEditar }) {
  const [copiado, setCopiado] = useState(false)
  const [error, setError] = useState('')
  /* La consulta del mostrador casi nunca es por una unidad: se pregunta por el
     juego de cuatro, o por dos. El presupuesto sale con la cantidad que se
     charló, no con una que después hay que multiplicar a mano. */
  const [cantidad, setCantidad] = useState('1')
  const [hoja, imprimir] = useImpresion()
  const empresa = useEmpresa()

  const estado = disponibilidad(p)
  const titulo = [p.marca, p.medida].filter(Boolean).join(' ')

  const costo = Number(p.costo ?? 0)
  const precio = Number(p.precio ?? 0)
  const ganancia = precio - costo
  const margen = precio > 0 ? (ganancia / precio) * 100 : 0

  /* Lo que se le pasa al cliente por WhatsApp: sin costo, sin margen y sin
     códigos internos. Solo qué es, cuánto sale y si está. */
  const paraElCliente = [
    titulo,
    p.descripcion,
    `Precio: ${plata(p.precio)}`,
    estado.texto === 'Sin stock' ? 'Sin stock, se pide' : 'Disponible',
    'Neumáticos y Servicios Pérez',
  ]
    .filter(Boolean)
    .join('\n')

  const presupuestar = () => {
    const cant = Math.max(1, Number(cantidad) || 1)

    imprimir({
      titulo: 'Presupuesto',
      fecha: new Date(),
      datos: [
        ['Artículo', titulo],
        ['Código', p.codigo],
        ['Disponibilidad', estado.texto === 'Sin stock' ? 'Sin stock, se pide' : estado.pie],
      ],
      renglones: [
        {
          descripcion: [titulo, p.descripcion].filter(Boolean).join(' — '),
          cantidad: cant,
          precio_unitario: precio,
        },
      ],
      total: precio * cant,
    })
  }

  const compartir = async () => {
    setError('')
    try {
      if (navigator.share) {
        await navigator.share({ title: titulo, text: paraElCliente })
      } else {
        await navigator.clipboard.writeText(paraElCliente)
        setCopiado(true)
        setTimeout(() => setCopiado(false), 2000)
      }
    } catch (e) {
      /* Cancelar el diálogo de compartir tira AbortError y no es un fallo. */
      if (e?.name !== 'AbortError') setError('No se pudo compartir. Copialo a mano.')
    }
  }

  return (
    <Modal titulo={titulo || 'Artículo'} onCerrar={onCerrar}>
      <div className="space-y-4">
        {p.imagen_url ? (
          <img
            src={p.imagen_url}
            alt={titulo}
            className="max-h-64 w-full rounded-lg border border-concreto-200 bg-white object-contain"
          />
        ) : (
          <div className="flex h-40 items-center justify-center rounded-lg border border-dashed border-concreto-200 bg-concreto-50 text-acero-300">
            <ImageOff size={28} aria-hidden="true" />
          </div>
        )}

        <div>
          <div className="flex flex-wrap items-center gap-2">
            <Etiqueta>{p.categoria || 'Otro repuesto'}</Etiqueta>
            <Etiqueta tono={estado.tono}>{estado.texto}</Etiqueta>
          </div>
          <h3 className="display mt-2 text-lg font-bold text-caucho-950">{titulo}</h3>
          {p.descripcion && <p className="mt-1 text-sm text-acero-500">{p.descripcion}</p>}
        </div>

        {/* El precio es lo que el cliente pregunta: va grande y solo. */}
        <div className="flex flex-wrap items-end justify-between gap-3 rounded-lg border border-concreto-200 bg-concreto-50 px-4 py-3">
          <div>
            <p className="text-xs text-acero-500">Precio</p>
            <p className="display text-2xl font-bold leading-tight text-caucho-950">
              {plata(p.precio)}
            </p>
          </div>
          <div className="text-right">
            <p className="text-xs text-acero-500">Disponibilidad</p>
            <p
              className={`font-semibold ${
                estado.tono === 'conforme' ? 'text-conforme-700' : 'text-atencion-700'
              }`}
            >
              {estado.pie}
            </p>
          </div>
        </div>

        <dl className="grid gap-x-4 gap-y-2 sm:grid-cols-2">
          <Dato etiqueta="Medida">{p.medida}</Dato>
          <Dato etiqueta="Código" mono>
            {p.codigo}
          </Dato>
        </dl>

        {gestiona && (
          <div className="rounded-lg border border-concreto-200 p-3">
            <p className="mb-2 text-xs font-bold uppercase tracking-wide text-acero-500">
              Interno
            </p>
            <dl className="grid gap-x-4 gap-y-2 sm:grid-cols-3">
              <Dato etiqueta="Costo">{plata(p.costo)}</Dato>
              <Dato etiqueta="Ganancia por unidad">{plata(ganancia)}</Dato>
              <Dato etiqueta="Margen">{precio > 0 ? `${margen.toFixed(0)} %` : '—'}</Dato>
              <Dato etiqueta="Stock mínimo">{numero(p.stock_minimo)}</Dato>
              <Dato etiqueta="Valor en stock">{plata((p.stock ?? 0) * costo)}</Dato>
            </dl>
          </div>
        )}

        {/* El cliente que pregunta por un artículo y se va a pensarlo: se
            lleva el precio por escrito, con la fecha y las condiciones. Sin
            esto, el mostrador se lo anota en un papel suelto y a la semana
            nadie sabe qué se le había dicho. */}
        <div className="flex flex-wrap items-end justify-between gap-3 rounded-lg border border-concreto-200 p-3">
          <Campo etiqueta="Cantidad a presupuestar">
            <input
              type="number"
              min="1"
              step="1"
              className={`${estiloInput} w-28`}
              value={cantidad}
              onChange={(e) => setCantidad(e.target.value)}
            />
          </Campo>
          <div className="text-right">
            <p className="text-xs text-acero-500">Total del presupuesto</p>
            <p className="display text-lg font-bold text-caucho-950">
              {plata(precio * Math.max(1, Number(cantidad) || 1))}
            </p>
          </div>
          <Boton variante="secundario" onClick={presupuestar}>
            <Printer size={15} /> Imprimir presupuesto
          </Boton>
        </div>

        <Aviso>{error}</Aviso>

        {hoja && <PresupuestoImpreso {...hoja} empresa={empresa} />}

        <div className="flex flex-wrap justify-end gap-2 border-t border-concreto-200 pt-4">
          <Boton variante="secundario" onClick={onCerrar}>
            Cerrar
          </Boton>
          {gestiona && (
            <Boton variante="secundario" onClick={onEditar}>
              <Pencil size={15} /> Editar
            </Boton>
          )}
          <Boton onClick={compartir}>
            {copiado ? (
              <>
                <Check size={15} /> Copiado
              </>
            ) : (
              <>
                {navigator.share ? <Share2 size={15} /> : <Copy size={15} />} Pasar al cliente
              </>
            )}
          </Boton>
        </div>
      </div>
    </Modal>
  )
}

function Dato({ etiqueta, mono = false, children }) {
  return (
    <div>
      <dt className="text-xs text-acero-500">{etiqueta}</dt>
      <dd className={`text-sm text-caucho-900 ${mono ? 'font-mono' : ''}`}>{children || '—'}</dd>
    </div>
  )
}
