import { useEffect } from 'react'
import { X } from 'lucide-react'

/* Piezas de interfaz compartidas. Usan los tokens de index.css:
   perez (rojo de marca), caucho (grafito), acero (grises), concreto (fondos). */

export const estiloInput =
  'w-full rounded-md border border-acero-200 bg-white px-3 py-2.5 text-sm ' +
  'text-caucho-900 placeholder:text-acero-500 transition-colors ' +
  'hover:border-acero-300 disabled:cursor-not-allowed disabled:bg-concreto-100'

export function Campo({ etiqueta, ayuda, children }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-sm font-medium text-caucho-800">{etiqueta}</span>
      {children}
      {ayuda && <span className="mt-1 block text-xs text-acero-500">{ayuda}</span>}
    </label>
  )
}

export function Boton({ variante = 'primario', className = '', ...props }) {
  const base =
    'inline-flex items-center justify-center gap-2 rounded-md px-4 py-2.5 ' +
    'text-sm font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-60'

  const variantes = {
    primario: 'bg-perez-600 text-white hover:bg-perez-700 disabled:hover:bg-perez-600',
    secundario: 'border border-acero-200 bg-white text-caucho-800 hover:bg-concreto-100',
    fantasma: 'text-caucho-800 hover:bg-concreto-200',
    peligro: 'border border-perez-300 bg-white text-perez-700 hover:bg-perez-50',
  }

  return <button className={`${base} ${variantes[variante]} ${className}`} {...props} />
}

export function Aviso({ tono = 'error', children }) {
  if (!children) return null

  const tonos = {
    error: 'border-perez-300 bg-perez-50 text-perez-800',
    atencion: 'border-atencion-600/30 bg-atencion-600/10 text-atencion-600',
    conforme: 'border-conforme-500/30 bg-conforme-500/10 text-conforme-500',
  }

  return (
    <p
      role={tono === 'error' ? 'alert' : 'status'}
      className={`rounded-md border px-3 py-2 text-sm ${tonos[tono]}`}
    >
      {children}
    </p>
  )
}

export function Cargando({ texto = 'Cargando…', alto = 'min-h-screen' }) {
  return (
    <div role="status" className={`flex ${alto} flex-col items-center justify-center gap-4`}>
      <span
        aria-hidden="true"
        className="h-8 w-8 animate-spin rounded-full border-[3px] border-acero-200 border-t-perez-600"
      />
      <p className="font-mono text-sm text-acero-500">{texto}</p>
    </div>
  )
}

export function Tarjeta({ className = '', ...props }) {
  return (
    <div
      className={`rounded-lg border border-concreto-200 bg-white ${className}`}
      {...props}
    />
  )
}

export function Encabezado({ titulo, detalle, children }) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
      <div>
        <h1 className="display text-2xl font-bold">{titulo}</h1>
        {detalle && <p className="mt-1 text-sm text-acero-500">{detalle}</p>}
      </div>
      {children && <div className="flex gap-2">{children}</div>}
    </div>
  )
}

export function Metrica({ icono: Icono, titulo, valor, pie, tono = 'neutro', className = '', onClick }) {
  const tonos = {
    neutro: 'bg-concreto-100 text-caucho-700',
    marca: 'bg-perez-50 text-perez-600',
    atencion: 'bg-atencion-600/10 text-atencion-600',
    conforme: 'bg-conforme-500/10 text-conforme-500',
  }

  return (
    <Tarjeta
      className={`p-5 ${onClick ? 'cursor-pointer hover:shadow-md' : ''} ${className}`}
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
      <div className="flex items-start justify-between gap-3">
        <p className="text-sm font-medium text-acero-500">{titulo}</p>
        {Icono && (
          <span className={`rounded-md p-1.5 ${tonos[tono]}`}>
            <Icono size={16} aria-hidden="true" />
          </span>
        )}
      </div>
      {/* Sin tabular-nums: a este tamaño los dígitos de ancho fijo se ven sueltos.
          Se reserva para columnas que tienen que alinear verticalmente. */}
      <p className="display mt-3 text-2xl font-bold">{valor}</p>
      {pie && <p className="mt-1 text-xs text-acero-500">{pie}</p>}
    </Tarjeta>
  )
}

/* Los tonos van por significado, no por color: 'estado' decide el color. */
export function Etiqueta({ tono = 'neutro', children }) {
  const tonos = {
    neutro: 'bg-concreto-200 text-caucho-700',
    marca: 'bg-perez-50 text-perez-700',
    atencion: 'bg-atencion-600/10 text-atencion-600',
    conforme: 'bg-conforme-500/10 text-conforme-500',
  }

  return (
    <span
      className={`inline-flex items-center rounded px-2 py-0.5 text-xs font-semibold ${tonos[tono]}`}
    >
      {children}
    </span>
  )
}

/* La tabla scrollea sola: en el celular del taller no hay ancho para 6 columnas. */
export function Tabla({ columnas, children }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[36rem] text-sm">
        <thead>
          <tr className="border-b border-concreto-200 text-left">
            {columnas.map((c) => (
              <th
                key={c}
                className="px-4 py-3 text-xs font-semibold uppercase tracking-wide text-acero-500"
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
    <div className="flex flex-col items-center gap-3 px-6 py-16 text-center">
      {Icono && <Icono size={32} className="text-acero-300" aria-hidden="true" />}
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
      className="fixed inset-0 z-50 flex items-end justify-center bg-caucho-950/50 p-4 sm:items-center"
      onMouseDown={(e) => e.target === e.currentTarget && onCerrar()}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label={titulo}
        className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-lg bg-white shadow-2xl"
      >
        <div className="sticky top-0 flex items-center justify-between border-b border-concreto-200 bg-white px-5 py-4">
          <h2 className="display text-lg font-bold">{titulo}</h2>
          <Boton variante="fantasma" className="px-2 py-1" onClick={onCerrar} aria-label="Cerrar">
            <X size={18} />
          </Boton>
        </div>
        <div className="p-5">{children}</div>
      </div>
    </div>
  )
}
