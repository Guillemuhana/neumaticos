import { useEffect } from 'react'
import { X } from 'lucide-react'

/* Piezas de interfaz compartidas. Usan los tokens de index.css:
   perez (rojo de marca), caucho (grafito), acero (grises), concreto (fondos).

   Criterio de estilo: herramienta de trabajo, no app de consumo. Radios
   contenidos (8–12px), bordes de 1px, sombras casi imperceptibles, y el rojo
   reservado para la acción principal, el estado activo y lo que alerta. */

export const estiloInput =
  'w-full rounded-lg border border-acero-200 bg-white px-3 py-2 text-sm ' +
  'text-caucho-900 placeholder:text-acero-400 transition-colors ' +
  'hover:border-acero-300 focus:border-perez-500 ' +
  'disabled:cursor-not-allowed disabled:bg-concreto-100'

export function Campo({ etiqueta, ayuda, children }) {
  return (
    <label className="block">
      <span className="mb-1 block text-[0.8125rem] font-medium text-caucho-800">{etiqueta}</span>
      {children}
      {ayuda && <span className="mt-1 block text-xs text-acero-500">{ayuda}</span>}
    </label>
  )
}

export function Boton({ variante = 'primario', className = '', ...props }) {
  const base =
    'inline-flex items-center justify-center gap-2 rounded-lg px-3.5 py-2 text-sm font-semibold ' +
    'transition-all duration-150 active:translate-y-px ' +
    'disabled:cursor-not-allowed disabled:opacity-50 disabled:active:translate-y-0 ' +
    'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-perez-500 focus-visible:ring-offset-2'

  /* Sin degradados: un color plano envejece mejor y no compite con los datos. */
  const variantes = {
    primario: 'bg-perez-600 text-white shadow-sm hover:bg-perez-700',
    secundario: 'border border-acero-200 bg-white text-caucho-800 hover:border-acero-300 hover:bg-concreto-50',
    fantasma: 'text-acero-500 hover:bg-concreto-100 hover:text-caucho-900',
    peligro: 'border border-perez-200 bg-white text-perez-700 hover:bg-perez-50',
  }

  return <button className={`${base} ${variantes[variante]} ${className}`} {...props} />
}

export function Aviso({ tono = 'error', children }) {
  if (!children) return null

  const tonos = {
    error: 'border-perez-200 bg-perez-50 text-perez-800',
    atencion: 'border-atencion-100 bg-atencion-50 text-atencion-700',
    conforme: 'border-conforme-100 bg-conforme-50 text-conforme-700',
  }

  return (
    <p
      role={tono === 'error' ? 'alert' : 'status'}
      className={`rounded-lg border px-3 py-2 text-sm ${tonos[tono]}`}
    >
      {children}
    </p>
  )
}

export function Cargando({ texto = 'Cargando…', alto = 'min-h-screen' }) {
  return (
    <div role="status" className={`flex ${alto} flex-col items-center justify-center gap-3`}>
      <span
        aria-hidden="true"
        className="h-6 w-6 animate-spin rounded-full border-2 border-concreto-200 border-t-perez-600"
      />
      <p className="text-sm text-acero-500">{texto}</p>
    </div>
  )
}

export function Tarjeta({ className = '', ...props }) {
  return (
    <div
      className={`sombra-1 rounded-xl border border-concreto-200 bg-white ${className}`}
      {...props}
    />
  )
}

export function Encabezado({ titulo, detalle, children }) {
  return (
    <div className="mb-5 flex flex-wrap items-start justify-between gap-x-4 gap-y-3">
      <div>
        <h1 className="display text-xl font-bold text-caucho-950">{titulo}</h1>
        {detalle && <p className="mt-1 max-w-2xl text-sm text-acero-500">{detalle}</p>}
      </div>
      {children && <div className="flex flex-wrap items-center gap-2">{children}</div>}
    </div>
  )
}

export function Metrica({ icono: Icono, titulo, valor, pie, tono = 'neutro', className = '', onClick }) {
  const tonos = {
    neutro: 'bg-concreto-100 text-acero-500',
    marca: 'bg-perez-50 text-perez-600',
    atencion: 'bg-atencion-50 text-atencion-600',
    conforme: 'bg-conforme-50 text-conforme-500',
  }

  return (
    <Tarjeta
      className={`elevar p-4 ${onClick ? 'cursor-pointer' : ''} ${className}`}
      onClick={onClick}
      role={onClick ? 'button' : undefined}
      tabIndex={onClick ? 0 : undefined}
      onKeyDown={
        onClick
          ? (event) => {
              if (event.key === 'Enter' || event.key === ' ') {
                event.preventDefault()
                onClick()
              }
            }
          : undefined
      }
    >
      <div className="flex items-center gap-2">
        {Icono && (
          <span className={`rounded-md p-1 ${tonos[tono]}`}>
            <Icono size={14} aria-hidden="true" />
          </span>
        )}
        <p className="text-[0.8125rem] font-medium text-acero-500">{titulo}</p>
      </div>
      {/* Cifras proporcionales: a este tamaño el ancho fijo se ve suelto. */}
      <p className="display mt-2 text-[1.75rem] font-bold leading-none text-caucho-950">{valor}</p>
      {pie && <p className="mt-2 text-xs text-acero-500">{pie}</p>}
    </Tarjeta>
  )
}

/* Los tonos van por significado, no por color: 'estado' decide el color. */
export function Etiqueta({ tono = 'neutro', children }) {
  const tonos = {
    neutro: 'bg-concreto-100 text-acero-500 ring-concreto-200',
    marca: 'bg-perez-50 text-perez-700 ring-perez-100',
    atencion: 'bg-atencion-50 text-atencion-700 ring-atencion-100',
    conforme: 'bg-conforme-50 text-conforme-700 ring-conforme-100',
  }

  return (
    <span
      className={`inline-flex items-center rounded-md px-1.5 py-0.5 text-[0.6875rem] font-semibold ring-1 ring-inset ${tonos[tono]}`}
    >
      {children}
    </span>
  )
}

/* La tabla scrollea sola: en el celular del taller no hay ancho para 6 columnas. */
export function Tabla({ columnas, children }) {
  return (
    <div className="overflow-x-auto">
      <table className="responsive-table w-full text-sm sm:min-w-[36rem]">
        <thead className="hidden sm:table-header-group">
          <tr className="border-b border-concreto-200 text-left">
            {columnas.map((c) => (
              <th
                key={c}
                className="px-4 py-2.5 text-xs font-semibold uppercase tracking-wide text-acero-500"
              >
                {c}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-concreto-200">{children}</tbody>
      </table>
    </div>
  )
}

export function Vacio({ icono: Icono, titulo, detalle }) {
  return (
    <div className="flex flex-col items-center gap-2 px-6 py-14 text-center">
      {Icono && (
        <span className="mb-1 rounded-xl bg-concreto-100 p-3 text-acero-300">
          <Icono size={22} aria-hidden="true" />
        </span>
      )}
      <p className="font-semibold text-caucho-800">{titulo}</p>
      {detalle && <p className="max-w-sm text-sm text-acero-500">{detalle}</p>}
    </div>
  )
}

export function Modal({ titulo, onCerrar, children }) {
  useEffect(() => {
    const alTeclear = (e) => e.key === 'Escape' && onCerrar()
    window.addEventListener('keydown', alTeclear)
    document.body.style.overflow = 'hidden'
    return () => {
      window.removeEventListener('keydown', alTeclear)
      document.body.style.overflow = ''
    }
  }, [onCerrar])

  return (
    <div
      className="aparecer fixed inset-0 z-50 flex items-end justify-center bg-caucho-950/40 p-4 backdrop-blur-[2px] sm:items-center"
      onMouseDown={(e) => e.target === e.currentTarget && onCerrar()}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label={titulo}
        className="entrar max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-xl bg-white shadow-2xl"
      >
        <div className="sticky top-0 z-10 flex items-center justify-between border-b border-concreto-200 bg-white px-5 py-3.5">
          <h2 className="display text-base font-bold">{titulo}</h2>
          <button
            onClick={onCerrar}
            aria-label="Cerrar"
            className="rounded-lg p-1.5 text-acero-400 transition-colors hover:bg-concreto-100 hover:text-caucho-900"
          >
            <X size={18} />
          </button>
        </div>
        <div className="p-5">{children}</div>
      </div>
    </div>
  )
}
