import { createPortal } from 'react-dom'
import { fechaCorta, numero, plataExacta } from '../lib/formato'

/* La hoja que se lleva el cliente: un presupuesto, una consulta por un
   artículo del mostrador o el detalle de una orden del taller. Es siempre el
   mismo papel con distinto contenido, así que vive en un solo lugar.

   Mismo mecanismo que el comprobante: se monta como hijo directo de <body> y
   solo existe al imprimir —la regla `.solo-impresion` de index.css esconde al
   resto—, así que no hay que abrir otra ventana ni volver a pedir los datos.

   No es una factura y no tiene que parecerlo: sin letra, sin CAE y sin IVA
   discriminado. Confundir las dos cosas es lo que hace que un cliente crea que
   ya tiene comprobante fiscal de algo que todavía no compró. */

export default function PresupuestoImpreso({
  titulo = 'Presupuesto',
  fecha,
  empresa,
  datos = [],
  renglones = [],
  total,
  notas,
  leyenda = 'Presupuesto sujeto a confirmación y a disponibilidad de stock. Los precios pueden variar sin previo aviso. No es un comprobante fiscal.',
}) {
  const conImportes = renglones.some((r) => r.precio_unitario != null)

  return createPortal(
    <div className="solo-impresion hidden print:block">
      <article className="mx-auto max-w-[190mm] font-sans text-[10pt] text-black">
        <header className="flex items-start justify-between gap-6 border-b-2 border-black pb-3">
          <div>
            <p className="text-[15pt] font-bold uppercase leading-tight">
              {empresa?.razon_social || 'Neumáticos y Servicios Pérez'}
            </p>
            {empresa?.domicilio && (
              <p className="mt-1 text-[8.5pt] leading-snug">{empresa.domicilio}</p>
            )}
          </div>
          <div className="text-right">
            <p className="text-[15pt] font-bold uppercase leading-tight">{titulo}</p>
            <p className="mt-1 text-[8.5pt] leading-snug">Fecha: {fechaCorta(fecha)}</p>
          </div>
        </header>

        {datos.length > 0 && (
          <section className="mt-3 border border-black p-3">
            <dl className="grid grid-cols-2 gap-x-6 gap-y-0.5 text-[8.5pt] leading-snug">
              {datos.map(([rotulo, valor]) => (
                <Linea key={rotulo} rotulo={rotulo}>
                  {valor}
                </Linea>
              ))}
            </dl>
          </section>
        )}

        <table className="mt-3 w-full border-collapse border border-black text-[8.5pt]">
          <thead>
            <tr className="bg-neutral-200">
              <th className="border border-black px-2 py-1 text-left font-semibold">Detalle</th>
              <th className="border border-black px-2 py-1 text-right font-semibold">Cant.</th>
              {/* El taller imprime la orden sin importes: el mecánico no los
                  maneja, y la hoja de trabajo no es la que se cobra. Sin
                  precios, las dos columnas de plata sobran. */}
              {conImportes && (
                <>
                  <th className="border border-black px-2 py-1 text-right font-semibold">
                    P. unitario
                  </th>
                  <th className="border border-black px-2 py-1 text-right font-semibold">
                    Subtotal
                  </th>
                </>
              )}
            </tr>
          </thead>
          <tbody>
            {renglones.map((r, i) => (
              <tr key={r.id ?? i}>
                <td className="border border-black px-2 py-1">{r.descripcion}</td>
                <td className="border border-black px-2 py-1 text-right tabular-nums">
                  {numero(r.cantidad)}
                </td>
                {conImportes && (
                  <>
                    <td className="border border-black px-2 py-1 text-right tabular-nums">
                      {plataExacta(r.precio_unitario)}
                    </td>
                    <td className="border border-black px-2 py-1 text-right tabular-nums">
                      {plataExacta(Number(r.cantidad) * Number(r.precio_unitario))}
                    </td>
                  </>
                )}
              </tr>
            ))}
          </tbody>
        </table>

        {total != null && (
          <section className="mt-2 flex justify-end">
            <dl className="w-[80mm] border border-black text-[9pt]">
              <div className="flex items-baseline justify-between gap-4 px-3 py-1 text-[11pt] font-bold">
                <dt>Total</dt>
                <dd className="tabular-nums">{plataExacta(total)}</dd>
              </div>
            </dl>
          </section>
        )}

        {notas && (
          <section className="mt-3 border border-black p-3 text-[8.5pt] leading-snug">
            <p className="font-semibold">Observaciones</p>
            <p className="mt-1 whitespace-pre-line">{notas}</p>
          </section>
        )}

        {/* Un presupuesto sin condiciones escritas es un precio que el cliente
            reclama dentro de tres meses. La leyenda es la que se dice en el
            mostrador; ponerla en el papel evita tener que discutirla. */}
        {leyenda && (
          <footer className="mt-4 border-t border-black pt-2 text-[8.5pt] leading-snug text-neutral-700">
            <p>{leyenda}</p>
          </footer>
        )}
      </article>
    </div>,
    document.body
  )
}

function Linea({ rotulo, children }) {
  if (!children) return null
  return (
    <div>
      <dt className="inline font-semibold">{rotulo}: </dt>
      <dd className="inline">{children}</dd>
    </div>
  )
}
