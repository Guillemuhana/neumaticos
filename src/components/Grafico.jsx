import { Tarjeta } from './UI'

/* Parámetros de dibujo compartidos por todos los gráficos.
   Una sola hue por gráfico: la identidad la dan los ejes, no el color, así que
   no hace falta paleta categórica (y se evita el par rojo/verde, que bajo
   deuteranopía queda en ΔE 6.5 y es indistinguible). */
export const MARCA = '#B3262C'
export const GRIS_EJE = '#AEB6C0'
export const GRIS_TEXTO = '#6B7684'

export const ejeComun = {
  stroke: GRIS_EJE,
  tick: { fill: GRIS_TEXTO, fontSize: 12 },
  tickLine: false,
  axisLine: false,
}

export function Tooltip({ active, payload, label, formato = (v) => v }) {
  if (!active || !payload?.length) return null
  return (
    <div className="rounded-md border border-concreto-200 bg-white px-3 py-2 shadow-lg">
      <p className="text-xs text-acero-500">{label}</p>
      <p className="font-semibold tabular-nums">{formato(payload[0].value)}</p>
    </div>
  )
}

/* Cada gráfico viene con su tabla: el tooltip agrega, nunca es el único
   camino al dato (y el lector que no distingue la hue igual lo lee). */
export function PanelGrafico({ titulo, detalle, datos, columnas, filas, children }) {
  return (
    <Tarjeta className="p-5">
      <div className="mb-4">
        <h2 className="display font-bold">{titulo}</h2>
        {detalle && <p className="mt-0.5 text-sm text-acero-500">{detalle}</p>}
      </div>

      {datos.length === 0 ? (
        <p className="py-12 text-center text-sm text-acero-500">
          No hay datos en el período elegido.
        </p>
      ) : (
        <>
          {children}
          <details className="mt-4">
            <summary className="cursor-pointer text-xs font-semibold text-acero-500 hover:text-caucho-800">
              Ver datos en tabla
            </summary>
            <div className="mt-2 overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-concreto-200 text-left">
                    {columnas.map((c) => (
                      <th key={c} className="py-2 text-xs font-semibold uppercase text-acero-500">
                        {c}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-concreto-200">
                  {filas.map((fila, i) => (
                    <tr key={i}>
                      {fila.map((celda, j) => (
                        <td key={j} className={`py-2 ${j > 0 ? 'tabular-nums' : ''}`}>
                          {celda}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </details>
        </>
      )}
    </Tarjeta>
  )
}
