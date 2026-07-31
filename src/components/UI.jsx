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
    'inline-flex items-center justify-center gap-2 rounded-full px-4 py-2.5 ' +
    'text-sm font-semibold transition duration-200 disabled:cursor-not-allowed disabled:opacity-60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-perez-500 focus-visible:ring-offset-2 focus-visible:ring-offset-white'

  const variantes = {
    primario:
      'bg-gradient-to-r from-perez-700 to-perez-600 text-white shadow-sm shadow-perez-900/10 hover:from-perez-800 hover:to-perez-700',
    secundario:
      'border border-concreto-200 bg-white text-caucho-800 hover:border-acero-300 hover:bg-concreto-100',
    fantasma:
      'text-caucho-800 hover:bg-concreto-100 focus-visible:ring-perez-500/30',
    peligro:
      'border border-perez-300 bg-white text-perez-700 hover:bg-perez-50',
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
      className={`rounded-[1.5rem] border border-concreto-200/90 bg-white/95 shadow-sm shadow-caucho-900/5 backdrop-blur-sm ${className}`}
      {...props}
    />
  )
}

export function Encabezado({ titulo, detalle, children }) {
  return (
    <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
      <div className="space-y-2">
        <h1 className="display text-3xl font-bold tracking-tight text-caucho-950">{titulo}</h1>
        {detalle && <p className="max-w-2xl text-sm text-acero-500">{detalle}</p>}
      </div>
      {children && <div className="flex flex-wrap items-center gap-2">{children}</div>}
    </div>
  )
}

export function Metrica({ icono: Icono, titulo, valor, pie, tono = 'neutro', className = '', onClick }) {
  const tonos = {
    neutro: 'bg-concreto-100 text-caucho-700',
    marca: 'bg-perez-50 text-perez-700',
    atencion: 'bg-atencion-100 text-atencion-700',
    conforme: 'bg-conforme-100 text-conforme-700',
  }

  return (
    <Tarjeta
      className={`elevar p-6 ${onClick ? 'cursor-pointer' : ''} ${className}`}
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
          <span className={`rounded-2xl p-2 ${tonos[tono]}`}>
            <Icono size={18} aria-hidden="true" />
          </span>
        )}
      </div>
      <p className="display mt-4 text-3xl font-bold tracking-tight">{valor}</p>
      {pie && <p className="mt-3 text-sm text-acero-500">{pie}</p>}
    </Tarjeta>
  )
}

/* Los tonos van por significado, no por color: 'estado' decide el color. */
export function Etiqueta({ tono = 'neutro', children }) {
  const tonos = {
    neutro: 'bg-concreto-200 text-caucho-700',
    marca: 'bg-perez-100 text-perez-700',
    atencion: 'bg-atencion-100 text-atencion-700',
    conforme: 'bg-conforme-100 text-conforme-700',
  }

  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ${tonos[tono]}`}
    >
      {children}
    </span>
  )
}

/* La tabla scrollea sola: en el celular del taller no hay ancho para 6 columnas. */
export function Tabla({ columnas, children }) {
  return (
    <div className="overflow-x-auto">
      <table className="responsive-table w-full sm:min-w-[36rem] text-sm border-separate border-spacing-y-3 sm:border-spacing-y-0">
        <thead className="hidden sm:table-header-group">
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
        <tbody className="space-y-3 sm:space-y-0 sm:table-row-group">{children}</tbody>
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
      className="aparecer fixed inset-0 z-50 flex items-end justify-center bg-caucho-950/60 p-4 backdrop-blur-sm sm:items-center"
      onMouseDown={(e) => e.target === e.currentTarget && onCerrar()}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label={titulo}
        className="entrar max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-[1.5rem] bg-white shadow-2xl"
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
