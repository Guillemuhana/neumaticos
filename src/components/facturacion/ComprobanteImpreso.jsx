import { createPortal } from 'react-dom'
import { fechaCorta, plataExacta } from '../../lib/formato'
import { condicionDe, cuitFormateado, numeroComprobante, tipoDe } from '../../lib/fiscal'

/* La hoja que se lleva el cliente. Vive fuera del flujo de la pantalla: se
   monta en <body> y solo aparece al imprimir, porque el resto de la app se
   oculta con la regla `.solo-impresion` de index.css. Hacerlo así evita tener
   que abrir otra ventana y volver a pedirle los datos a Supabase.

   Pendiente para cuando entre el web service: el QR de ARCA, obligatorio en
   el comprobante impreso desde 2021. Se arma con el CAE y los datos del
   emisor, así que recién se puede generar cuando el CAE lo devuelve ARCA y no
   una persona copiándolo del portal. */

export default function ComprobanteImpreso({ comprobante, items, empresa }) {
  const tipo = tipoDe(comprobante.tipo)
  const cliente = condicionDe(comprobante.cliente_condicion)

  return createPortal(
    <div className="solo-impresion hidden print:block">
      <article className="mx-auto max-w-[190mm] font-sans text-[10pt] text-black">
        <Cabecera comprobante={comprobante} empresa={empresa} tipo={tipo} />
        <Receptor comprobante={comprobante} cliente={cliente} />
        <Renglones items={items} tipo={tipo} />
        <Totales comprobante={comprobante} tipo={tipo} />
        <Pie comprobante={comprobante} />
      </article>
    </div>,
    document.body
  )
}

function Cabecera({ comprobante, empresa, tipo }) {
  const emisor = condicionDe(empresa?.condicion_iva)

  return (
    <header className="grid grid-cols-[1fr_auto_1fr] border border-black">
      <div className="p-3">
        <p className="text-[13pt] font-bold uppercase leading-tight">
          {empresa?.razon_social || 'Razón social sin cargar'}
        </p>
        <dl className="mt-2 space-y-0.5 text-[8.5pt] leading-snug">
          <Linea rotulo="Domicilio">{empresa?.domicilio}</Linea>
          <Linea rotulo="Condición frente al IVA">{emisor.leyenda}</Linea>
          <Linea rotulo="Ingresos Brutos">{empresa?.ingresos_brutos}</Linea>
          <Linea rotulo="Inicio de actividades">
            {empresa?.inicio_actividades ? fechaCorta(empresa.inicio_actividades) : null}
          </Linea>
        </dl>
      </div>

      {/* El recuadro con la letra: es lo primero que mira quien recibe la
          factura, y va centrado y pisando el borde como en el modelo de ARCA. */}
      <div className="flex w-16 flex-col items-center justify-start border-x border-black px-2 py-1">
        <span className="text-[26pt] font-bold leading-none">{tipo.letra}</span>
        <span className="mt-1 text-[7pt] leading-none">COD. {String(tipo.codigo).padStart(3, '0')}</span>
      </div>

      <div className="p-3">
        <p className="text-[13pt] font-bold uppercase leading-tight">Factura</p>
        <dl className="mt-2 space-y-0.5 text-[8.5pt] leading-snug">
          <Linea rotulo="Nº">{numeroComprobante(comprobante)}</Linea>
          <Linea rotulo="Fecha de emisión">{fechaCorta(comprobante.fecha)}</Linea>
          <Linea rotulo="CUIT">{cuitFormateado(empresa?.cuit)}</Linea>
        </dl>
      </div>
    </header>
  )
}

function Receptor({ comprobante, cliente }) {
  return (
    <section className="mt-2 border border-black p-3">
      <dl className="grid grid-cols-2 gap-x-6 gap-y-0.5 text-[8.5pt] leading-snug">
        <Linea rotulo="Cliente">{comprobante.cliente_nombre}</Linea>
        <Linea rotulo="CUIT / DNI">{cuitFormateado(comprobante.cliente_cuit)}</Linea>
        <Linea rotulo="Domicilio">{comprobante.cliente_domicilio}</Linea>
        <Linea rotulo="Condición frente al IVA">{cliente.leyenda}</Linea>
      </dl>
    </section>
  )
}

function Renglones({ items, tipo }) {
  /* En la A el precio unitario se muestra sin IVA, porque el IVA va aparte en
     su propia columna. En la B el precio es el final y no se desglosa nada:
     el cliente ve lo que paga. */
  const columnas = tipo.discriminaIva
    ? ['Descripción', 'Cant.', 'P. unitario', 'Alíc. IVA', 'IVA', 'Subtotal']
    : ['Descripción', 'Cant.', 'P. unitario', 'Subtotal']

  return (
    <table className="mt-2 w-full border-collapse border border-black text-[8.5pt]">
      <thead>
        <tr className="bg-neutral-200">
          {columnas.map((c, i) => (
            <th
              key={c}
              className={`border border-black px-2 py-1 font-semibold ${
                i === 0 ? 'text-left' : 'text-right'
              }`}
            >
              {c}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {items.map((i) => {
          const unitario = tipo.discriminaIva
            ? Number(i.precio_unitario) / (1 + Number(i.alicuota) / 100)
            : Number(i.precio_unitario)

          return (
            <tr key={i.id}>
              <td className="border border-black px-2 py-1">{i.descripcion}</td>
              <td className="border border-black px-2 py-1 text-right tabular-nums">
                {Number(i.cantidad)}
              </td>
              <td className="border border-black px-2 py-1 text-right tabular-nums">
                {plataExacta(unitario)}
              </td>
              {tipo.discriminaIva && (
                <>
                  <td className="border border-black px-2 py-1 text-right tabular-nums">
                    {Number(i.alicuota)}%
                  </td>
                  <td className="border border-black px-2 py-1 text-right tabular-nums">
                    {plataExacta(i.iva)}
                  </td>
                </>
              )}
              <td className="border border-black px-2 py-1 text-right tabular-nums">
                {plataExacta(tipo.discriminaIva ? i.neto : i.importe)}
              </td>
            </tr>
          )
        })}
      </tbody>
    </table>
  )
}

function Totales({ comprobante, tipo }) {
  return (
    <section className="mt-2 flex justify-end">
      <dl className="w-[80mm] border border-black text-[9pt]">
        {tipo.discriminaIva && (
          <>
            <Total rotulo="Subtotal neto">{plataExacta(comprobante.neto)}</Total>
            <Total rotulo="IVA 21%">{plataExacta(comprobante.iva)}</Total>
          </>
        )}
        <Total rotulo="Importe total" destacado>
          {plataExacta(comprobante.total)}
        </Total>
      </dl>
    </section>
  )
}

function Pie({ comprobante }) {
  return (
    <footer className="mt-3 flex items-end justify-between gap-6 border-t border-black pt-2 text-[8.5pt]">
      <p className="max-w-[110mm] leading-snug text-neutral-700">
        Comprobante autorizado por ARCA. El importe consignado incluye todos los
        impuestos aplicables.
      </p>
      <dl className="text-right leading-snug">
        <Linea rotulo="CAE Nº">{comprobante.cae}</Linea>
        <Linea rotulo="Vencimiento del CAE">{fechaCorta(comprobante.cae_vencimiento)}</Linea>
      </dl>
    </footer>
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

function Total({ rotulo, destacado = false, children }) {
  return (
    <div
      className={`flex items-baseline justify-between gap-4 px-3 py-1 ${
        destacado ? 'border-t border-black text-[11pt] font-bold' : ''
      }`}
    >
      <dt>{rotulo}</dt>
      <dd className="tabular-nums">{children}</dd>
    </div>
  )
}
