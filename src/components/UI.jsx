import { useEffect } from 'react'
import { createPortal } from 'react-dom'
import { X } from 'lucide-react'

/* Piezas de interfaz compartidas. Usan los tokens de index.css:
   perez (rojo de marca), caucho (grafito), acero (grises), concreto (fondos).

   Criterio de estilo: herramienta de trabajo, no app de consumo. Radios
   contenidos (8–12px), bordes de 1px, sombras casi imperceptibles, y el rojo
   reservado para la acción principal, el estado activo y lo que alerta. */

export const estiloInput =
  'w-full rounded-lg border border-acero-200 bg-white px-3 py-2 text-sm ' +
  'text-caucho-900 placeholder:text-acero-400 transition-colors duration-150 ' +
  'hover:border-acero-300 focus:border-perez-500 ' +
  'disabled:cursor-not-allowed disabled:bg-concreto-100 disabled:text-acero-400'

export function Campo({ etiqueta, ayuda, children }) {
  return (
    <label className="block">
      <span className="mb-1 block text-menor font-medium text-caucho-800">{etiqueta}</span>
      {children}
      {ayuda && <span className="mt-1 block text-xs text-acero-500">{ayuda}</span>}
    </label>
  )
}

export function Boton({ variante = 'primario', className = '', ...props }) {
  /* El foco lo pone `:focus-visible` de index.css, igual que en cualquier otro
     control. Antes acá había un `ring` propio: el botón terminaba siendo la
     única pieza del sistema con su propia forma de marcar el foco. */
  const base =
    'inline-flex items-center justify-center gap-2 rounded-lg px-3.5 py-2 ' +
    'text-sm font-semibold transition-all duration-150 active:translate-y-px ' +
    'disabled:cursor-not-allowed disabled:opacity-50 disabled:active:translate-y-0'

  /* Sin degradados: un color plano envejece mejor y no compite con los datos.

     Los que no llevan borde propio se lo ponen transparente: sin eso quedan
     2px más bajos que un input o que un botón secundario, y al ponerlos en la
     misma fila la hilera de controles queda despareja. Es la clase de detalle
     que no se ve pero se nota. */
  const variantes = {
    primario:
      'border border-transparent bg-perez-600 text-white sombra-1 hover:bg-perez-700 active:bg-perez-800',
    secundario:
      'border border-acero-200 bg-white text-caucho-800 hover:border-acero-300 hover:bg-concreto-50 active:bg-concreto-100',
    fantasma:
      'border border-transparent text-acero-500 hover:bg-concreto-100 hover:text-caucho-900 active:bg-concreto-200',
    peligro:
      'border border-perez-200 bg-white text-perez-700 hover:bg-perez-50 active:bg-perez-100',
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

/* Plana: sin borde y con una sombra que apenas se adivina. Lo que separa la
   tarjeta del fondo es el medio tono de diferencia entre su blanco y el hueso
   de la página; agregarle un contorno de 1px la convertía en una caja
   dibujada, que es justo lo contrario del aire que pide el diseño. */
export function Tarjeta({ className = '', ...props }) {
  return <div className={`sombra-1 rounded-xl bg-white ${className}`} {...props} />
}

/* Dos formas del mismo encabezado.

   Con `detalle` explica de qué va la pantalla y se pone abajo del título.
   Con `resumen` acompaña al título en el mismo renglón: es para las pantallas
   que son una lista larga, donde lo de arriba no puede robarle alto a las
   primeras filas. Stock lo tenía escrito a mano por eso; ahora es una opción
   del componente y no una excepción suelta. */
export function Encabezado({ titulo, detalle, resumen, children }) {
  return (
    /* `items-start` y `items-center` no pueden convivir en la lista: Tailwind
       resuelve el empate por el orden del CSS generado, no por el orden en que
       se escriben acá, así que cuál gana queda librado al azar. Se elige uno. */
    <div
      className={`flex flex-wrap justify-between gap-x-4 gap-y-3 ${
        resumen ? 'mb-3 items-center' : 'mb-5 items-start'
      }`}
    >
      <div className={resumen ? 'flex flex-wrap items-baseline gap-x-3 gap-y-1' : ''}>
        <h1 className="display text-xl font-bold text-caucho-950">{titulo}</h1>
        {resumen && <p className="text-sm text-acero-500">{resumen}</p>}
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
        <p className="text-menor font-medium text-acero-500">{titulo}</p>
      </div>
      {/* Cifras proporcionales: a este tamaño el ancho fijo se ve suelto. */}
      <p className="display mt-2 text-[1.75rem] font-bold leading-none text-caucho-950">{valor}</p>
      {pie && <p className="mt-2 text-xs text-acero-500">{pie}</p>}
    </Tarjeta>
  )
}

/* Grupo de botones pegados para elegir una opción de pocas: filtros de fecha,
   tipo de ítem, alcance de una lista. Es un `radiogroup` y no una fila de
   botones sueltos porque eso es lo que es —una opción entre varias— y es lo
   que hace que las flechas del teclado se muevan entre ellas.

   Las opciones se declaran como `{ valor, texto }`, o como texto suelto
   cuando el valor y la etiqueta coinciden. */
export function Segmentado({ opciones, valor, onCambio, etiqueta }) {
  const items = opciones.map((o) => (typeof o === 'object' ? o : { valor: o, texto: o }))

  return (
    <div
      role="radiogroup"
      aria-label={etiqueta}
      className="inline-flex w-fit overflow-hidden rounded-lg border border-acero-200 bg-white"
    >
      {items.map((o, i) => {
        const activo = o.valor === valor
        return (
          <button
            key={String(o.valor)}
            type="button"
            role="radio"
            aria-checked={activo}
            onClick={() => onCambio(o.valor)}
            className={`px-3.5 py-1.5 text-menor font-semibold transition-colors duration-150 ${
              i > 0 ? 'border-l border-acero-200' : ''
            } ${
              activo
                ? 'bg-perez-600 text-white'
                : 'text-caucho-800 hover:bg-concreto-100'
            }`}
          >
            {o.texto}
          </button>
        )
      })}
    </div>
  )
}

/* Los tonos van por significado, no por color: 'estado' decide el color.

   Pastilla pastel y texto en el tono oscuro de la misma familia, sin anillo:
   el borde interior le agregaba una tercera línea a algo que mide 18px de
   alto, y a ese tamaño lo único que se lee es la mancha de color. */
export function Etiqueta({ tono = 'neutro', children }) {
  const tonos = {
    neutro: 'bg-concreto-100 text-caucho-700',
    marca: 'bg-perez-100 text-perez-800',
    atencion: 'bg-atencion-100 text-atencion-700',
    conforme: 'bg-conforme-100 text-conforme-700',
  }

  return (
    <span
      className={`inline-flex items-center rounded-md px-1.5 py-0.5 text-micro font-semibold ${tonos[tono]}`}
    >
      {children}
    </span>
  )
}

/* La tabla scrollea sola: en el celular del taller no hay ancho para 6 columnas.

   Una columna puede declararse como `{ texto, cifra: true }` para que su
   rótulo se alinee a la derecha, igual que los números que va a encabezar.
   Un rótulo a la izquierda sobre una columna de importes alineados a la
   derecha es la falla más común de una tabla, y la más fácil de arreglar. */
export function Tabla({ columnas, children }) {
  return (
    <div className="overflow-x-auto">
      <table className="responsive-table w-full text-sm sm:min-w-[36rem]">
        <thead className="hidden sm:table-header-group">
          <tr className="border-b border-concreto-200 text-left">
            {columnas.map((c, i) => {
              const { texto, cifra = false } = typeof c === 'string' ? { texto: c } : c
              return (
                <th
                  key={texto || `col-${i}`}
                  scope="col"
                  /* Rótulo chico, en mayúsculas y con letra espaciada: es lo
                     que lo separa del dato sin necesidad de una línea. */
                  className={`px-4 py-3 text-micro font-semibold uppercase tracking-wider text-acero-500 ${
                    cifra ? 'text-right' : ''
                  }`}
                >
                  {texto}
                </th>
              )
            })}
          </tr>
        </thead>
        <tbody className="divide-y divide-concreto-200">{children}</tbody>
      </table>
    </div>
  )
}

/* Mientras carga una tabla, filas grises del alto real en vez de un spinner
   centrado: la pantalla no salta cuando llegan los datos, y se ve enseguida
   que lo que viene es una lista y no un formulario. */
export function Esqueleto({ filas = 6 }) {
  return (
    <div className="divide-y divide-concreto-200" role="status" aria-label="Cargando…">
      {Array.from({ length: filas }, (_, i) => (
        <div key={i} className="flex items-center gap-3 px-4 py-3">
          <span className="h-9 w-9 shrink-0 rounded-md bg-concreto-100" />
          <span className="h-3 flex-1 rounded bg-concreto-100" style={{ maxWidth: `${40 - i * 3}%` }} />
          <span className="h-3 w-16 rounded bg-concreto-100" />
        </div>
      ))}
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

/* Los diálogos se apilan: el visor de fotos se abre encima del panel de la
   orden, que ya es un diálogo. Sin esta pila, Escape cerraba los dos de una
   —cada uno escucha en `window`— y quien miraba una foto perdía la orden
   entera; y al cerrar el de arriba se devolvía el scroll al fondo con el de
   abajo todavía abierto. */
const pilaDeModales = []

export function Modal({ titulo, onCerrar, children }) {
  useEffect(() => {
    const marca = Symbol('modal')
    pilaDeModales.push(marca)

    const alTeclear = (e) => {
      if (e.key === 'Escape' && pilaDeModales.at(-1) === marca) onCerrar()
    }

    window.addEventListener('keydown', alTeclear)
    document.body.style.overflow = 'hidden'

    return () => {
      window.removeEventListener('keydown', alTeclear)
      pilaDeModales.splice(pilaDeModales.indexOf(marca), 1)
      if (!pilaDeModales.length) document.body.style.overflow = ''
    }
  }, [onCerrar])

  /* Va montado en <body> y no donde se lo escribe. `position: fixed` se
     resuelve contra el ancestro que tenga transform, filter o animación de
     esos, y el layout anima cada pantalla al entrar: adentro de la página el
     diálogo se centraba contra el alto del contenido, así que en una pantalla
     larga aparecía arriba de todo y con la cabecera fuera de la ventana. */
  return createPortal(
    <div
      className="aparecer fixed inset-0 z-50 flex items-end justify-center bg-caucho-950/40 p-4 backdrop-blur-[2px] sm:items-center"
      onMouseDown={(e) => e.target === e.currentTarget && onCerrar()}
    >
      {/* Columna con la cabecera fija y el cuerpo scrolleando aparte: con un
          `sticky` adentro de un solo contenedor, el título se iba de vista en
          los formularios largos. */}
      <div
        role="dialog"
        aria-modal="true"
        aria-label={titulo}
        className="entrar sombra-3 flex max-h-[90vh] w-full max-w-lg flex-col overflow-hidden rounded-xl bg-white"
      >
        <div className="flex shrink-0 items-center justify-between border-b border-concreto-200 bg-white px-5 py-3.5">
          <h2 className="display text-base font-bold">{titulo}</h2>
          <button
            onClick={onCerrar}
            aria-label="Cerrar"
            className="rounded-lg p-1.5 text-acero-400 transition-colors hover:bg-concreto-100 hover:text-caucho-900"
          >
            <X size={18} />
          </button>
        </div>
        <div className="overflow-y-auto p-5">{children}</div>
      </div>
    </div>,
    document.body
  )
}
