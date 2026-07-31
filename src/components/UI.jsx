/* Piezas de interfaz compartidas. Usan los tokens de index.css:
   perez (rojo de marca), caucho (grafito), acero (grises), concreto (fondos). */

export const estiloInput =
  'w-full rounded-md border border-acero-200 bg-white px-3 py-2.5 text-sm ' +
  'text-caucho-900 placeholder:text-acero-500 transition-colors ' +
  'hover:border-acero-300 disabled:cursor-not-allowed disabled:bg-concreto-100'

export function Campo({ etiqueta, ayuda, children }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-sm font-medium text-caucho-800">
        {etiqueta}
      </span>
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
    secundario:
      'border border-acero-200 bg-white text-caucho-800 hover:bg-concreto-100',
    fantasma: 'text-caucho-800 hover:bg-concreto-200',
  }

  return <button className={`${base} ${variantes[variante]} ${className}`} {...props} />
}

/* Silencioso mientras no haya mensaje: así el formulario no salta de alto. */
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

export function Cargando({ texto = 'Cargando…' }) {
  return (
    <div
      role="status"
      className="flex min-h-screen flex-col items-center justify-center gap-4"
    >
      <span
        aria-hidden="true"
        className="h-8 w-8 animate-spin rounded-full border-[3px] border-acero-200 border-t-perez-600"
      />
      <p className="font-mono text-sm text-acero-500">{texto}</p>
    </div>
  )
}
