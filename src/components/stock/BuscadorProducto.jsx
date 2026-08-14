import { useMemo, useState } from 'react'
import { Check, Plus, Search, X } from 'lucide-react'
import { numero, plata } from '../../lib/formato'
import { estiloInput } from '../UI'

/* Elegir un artículo era un `<select>` con el catálogo entero adentro: para
   encontrar una medida había que desplegarlo y bajar leyendo renglón por
   renglón, con el cliente esperando. Y el desplegable del sistema no se puede
   filtrar ni deja ver el stock de un vistazo.

   Acá el catálogo está siempre a la vista y se recorta escribiendo. Sin nada
   escrito se ven todos, que es lo que hace falta cuando el cliente pregunta
   «¿qué tenés para este auto?» en vez de pedir una medida puntual.

   Filtra en memoria y no contra la base: la lista ya está cargada para la
   venta, y en el mostrador el resultado tiene que aparecer mientras se tipea,
   no un cuarto de segundo después. */

const coincide = (p, q) =>
  [p.marca, p.medida, p.codigo, p.descripcion, p.categoria]
    .filter(Boolean)
    .some((campo) => campo.toLowerCase().includes(q))

export default function BuscadorProducto({ productos, elegidos = [], onElegir }) {
  const [busqueda, setBusqueda] = useState('')
  const [categoria, setCategoria] = useState('todas')

  const lista = productos ?? []

  /* Las categorías salen del catálogo y no de una constante: si mañana entra
     una familia nueva, el filtro la tiene sin que nadie la agregue acá. */
  const categorias = useMemo(
    () => [...new Set(lista.map((p) => p.categoria).filter(Boolean))].sort(),
    [lista]
  )

  const filtrados = useMemo(() => {
    const q = busqueda.trim().toLowerCase()
    return lista.filter(
      (p) => (categoria === 'todas' || p.categoria === categoria) && (!q || coincide(p, q))
    )
  }, [lista, busqueda, categoria])

  return (
    <div>
      <div className="relative">
        <Search
          size={16}
          className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-acero-500"
          aria-hidden="true"
        />
        <input
          className={`${estiloInput} pl-9 ${busqueda ? 'pr-10' : ''}`}
          placeholder="Buscar por marca, medida o código…"
          value={busqueda}
          onChange={(e) => setBusqueda(e.target.value)}
        />
        {busqueda && (
          <button
            type="button"
            onClick={() => setBusqueda('')}
            aria-label="Limpiar búsqueda"
            className="absolute right-2 top-1/2 -translate-y-1/2 rounded-lg p-1.5 text-acero-400 transition-colors hover:bg-concreto-100 hover:text-caucho-800"
          >
            <X size={15} />
          </button>
        )}
      </div>

      {/* Una sola categoría no es un filtro, es un cartel: si el catálogo no
          está dividido, la fila de chips solo ocupa alto. */}
      {categorias.length > 1 && (
        <div className="mt-2 flex flex-wrap gap-1.5">
          {['todas', ...categorias].map((c) => (
            <button
              key={c}
              type="button"
              onClick={() => setCategoria(c)}
              aria-pressed={categoria === c}
              className={`rounded-full border px-2.5 py-1 text-xs font-medium transition-colors ${
                categoria === c
                  ? 'border-perez-600 bg-perez-600 text-white'
                  : 'border-concreto-200 bg-white text-caucho-700 hover:border-acero-300 hover:bg-concreto-50'
              }`}
            >
              {c === 'todas' ? 'Todo el catálogo' : c}
            </button>
          ))}
        </div>
      )}

      {/* Alto acotado y scroll propio: el catálogo entero adentro del modal
          empujaría el total y los botones fuera de la pantalla. */}
      <div className="mt-2 max-h-64 overflow-y-auto overscroll-contain rounded-lg border border-concreto-200">
        {!filtrados.length ? (
          <p className="px-3 py-4 text-sm text-acero-500">
            {lista.length
              ? 'Ningún artículo coincide. Probá con la marca o con la medida sola.'
              : 'El catálogo está vacío. Cargá los artículos desde Stock.'}
          </p>
        ) : (
          <ul className="divide-y divide-concreto-200">
            {filtrados.map((p) => {
              const yaEsta = elegidos.includes(p.id)
              const sinStock = p.stock <= 0

              return (
                <li key={p.id}>
                  <button
                    type="button"
                    onClick={() => onElegir(p)}
                    className="flex w-full items-center gap-3 px-3 py-2 text-left transition-colors hover:bg-concreto-50"
                  >
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-medium text-caucho-900">
                        {p.marca} {p.medida}
                      </span>
                      {/* El stock al lado del precio y no escondido: agregar
                          cuatro cubiertas de las que hay dos se puede, pero
                          conviene saberlo antes de prometerlas. */}
                      <span
                        className={`block text-xs ${sinStock ? 'text-atencion-700' : 'text-acero-500'}`}
                      >
                        {p.categoria}
                        {p.codigo ? ` · ${p.codigo}` : ''} ·{' '}
                        {sinStock ? 'sin stock' : `${numero(p.stock)} en stock`}
                      </span>
                    </span>

                    <span className="shrink-0 font-mono text-sm font-semibold text-caucho-900">
                      {plata(p.precio)}
                    </span>

                    <span
                      aria-hidden="true"
                      className={`shrink-0 ${yaEsta ? 'text-conforme-600' : 'text-acero-400'}`}
                    >
                      {yaEsta ? <Check size={16} /> : <Plus size={16} />}
                    </span>
                  </button>
                </li>
              )
            })}
          </ul>
        )}
      </div>

      {lista.length > 0 && (
        <p className="mt-1.5 text-xs text-acero-500">
          {filtrados.length === lista.length
            ? `${numero(lista.length)} artículos en el catálogo`
            : `${numero(filtrados.length)} de ${numero(lista.length)} artículos`}
        </p>
      )}
    </div>
  )
}
