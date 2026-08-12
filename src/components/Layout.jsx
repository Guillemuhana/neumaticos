import { useState } from 'react'
import { NavLink, Outlet, useLocation } from 'react-router-dom'
import {
  Banknote,
  BarChart3,
  BookOpen,
  Boxes,
  Contact,
  FileText,
  HandCoins,
  LayoutDashboard,
  LogOut,
  Menu,
  MessageSquare,
  Receipt,
  Users,
  Wrench,
  X,
} from 'lucide-react'
import { useAuth } from '../context/AuthProvider'
import { useNoLeidos } from '../hooks/useNoLeidos'

/* Cada entrada declara qué roles la ven. La lista es solo la superficie:
   si alguien fuerza la URL, RLS le devuelve vacío igual. */
const navegacion = [
  { a: '/', texto: 'Panel', icono: LayoutDashboard, roles: ['gerencia', 'vendedor', 'mecanico'] },
  { a: '/stock', texto: 'Stock', icono: Boxes, roles: ['gerencia', 'vendedor'] },
  { a: '/ventas', texto: 'Ventas', icono: Receipt, roles: ['gerencia', 'vendedor'] },
  { a: '/clientes', texto: 'Clientes', icono: Contact, roles: ['gerencia', 'vendedor'] },
  { a: '/taller', texto: 'Taller', icono: Wrench, roles: ['gerencia', 'vendedor', 'mecanico'] },
  /* Va pegada al taller porque es su continuación: el trabajo termina, el
     vehículo se entrega y el comprobante queda esperando acá. */
  { a: '/facturacion', texto: 'Facturación', icono: FileText, roles: ['gerencia', 'vendedor'] },
  { a: '/caja', texto: 'Caja', icono: Banknote, roles: ['gerencia', 'vendedor'] },
  { a: '/personal', texto: 'Personal', icono: Users, roles: ['gerencia', 'vendedor', 'mecanico'] },
  /* Cada uno ve lo suyo; gerencia ve al equipo y es la única que liquida. */
  { a: '/comisiones', texto: 'Comisiones', icono: HandCoins, roles: ['gerencia', 'vendedor', 'mecanico'] },
  { a: '/estadisticas', texto: 'Estadísticas', icono: BarChart3, roles: ['gerencia'] },
  /* Abajo de todo y para los tres: es el canal del equipo, no una parada
     del circuito de trabajo. Lleva el contador de lo que no se leyó. */
  { a: '/chat', texto: 'Chat', icono: MessageSquare, roles: ['gerencia', 'vendedor', 'mecanico'] },
]

/* El manual va en su propio grupo, abajo de todo: no es una pantalla de
   trabajo, es a donde se va cuando algo no se entiende. Mezclarlo con las
   demás lo convertiría en una parada más del recorrido diario. */
const ayuda = [
  { a: '/manual', texto: 'Manual de uso', icono: BookOpen, roles: ['gerencia', 'vendedor', 'mecanico'] },
]

const nombreRol = { gerencia: 'Gerencia', vendedor: 'Vendedor', mecanico: 'Mecánico' }

const iniciales = (nombre = '') =>
  nombre
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0])
    .join('')
    .toUpperCase() || '—'

export default function Layout() {
  const { perfil, rol, sesion, cerrarSesion } = useAuth()
  const [abierto, setAbierto] = useState(false)
  const ubicacion = useLocation()
  const noLeidos = useNoLeidos(sesion?.user?.id)

  const items = navegacion.filter((i) => i.roles.includes(rol))
  const itemsAyuda = ayuda.filter((i) => i.roles.includes(rol))

  /* Los dos grupos pintan igual, así que el enlace se arma una sola vez. */
  const enlace = ({ a, texto, icono: Icono }) => (
    <NavLink
      key={a}
      to={a}
      end={a === '/'}
      onClick={() => setAbierto(false)}
      className={({ isActive }) =>
        `group relative flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors duration-150 ${
          isActive
            ? 'bg-perez-100 text-perez-800'
            : 'text-caucho-800 hover:bg-white hover:text-caucho-950'
        }`
      }
    >
      {({ isActive }) => (
        <>
          {/* Marca la fila activa aun para quien no distingue el acento. */}
          <span
            aria-hidden="true"
            className={`absolute -left-4 top-1/2 h-4 w-1 -translate-y-1/2 rounded-r bg-perez-600 transition-opacity ${
              isActive ? 'opacity-100' : 'opacity-0'
            }`}
          />
          <Icono size={17} aria-hidden="true" className="shrink-0" />
          {texto}
          {/* El contador va al final de la fila y no pegado al texto: así no
              empuja el nombre del ítem cuando cambia de una a dos cifras. */}
          {a === '/chat' && noLeidos > 0 && (
            <span
              aria-label={`${noLeidos} mensajes sin leer`}
              className="ml-auto min-w-5 rounded-full bg-perez-600 px-1.5 py-0.5 text-center text-micro font-bold text-white"
            >
              {noLeidos > 99 ? '99+' : noLeidos}
            </span>
          )}
        </>
      )}
    </NavLink>
  )

  const panel = (
    /* Barra clara, plana, separada del contenido por una línea y no por un
       bloque de color: la jerarquía la hace el fondo hueso de la página, que
       es apenas más claro que este gris. */
    /* Scrollea: el menú creció a once entradas y en un celular chico el pie
       —con el usuario y el botón de salir— quedaba abajo del borde de la
       pantalla, sin forma de llegar. `mt-auto` lo sigue empujando al fondo
       cuando sobra alto. */
    <div className="relative flex h-full flex-col overflow-y-auto border-r border-concreto-200 bg-concreto-100 p-4">
      {/* Franja del logo, apenas insinuada: ubica la marca sin gritar. */}
      <span className="franja absolute inset-y-0 left-0 w-0.5 opacity-60" aria-hidden="true" />

      <div className="mb-6 rounded-lg bg-white px-3 py-2.5">
        <img src="/logo-perez.png" alt="Neumáticos y Servicios Pérez" className="w-full" />
      </div>

      {/* El rol de quien entró va acá arriba, en el azul del acento: es el
          dato que explica por qué el menú tiene estas entradas y no otras. */}
      <p className="mb-4 px-3 text-micro font-semibold uppercase tracking-wider text-perez-700">
        {nombreRol[rol] ?? 'Gestión'}
      </p>

      <p className="mb-2 px-3 text-micro font-semibold uppercase tracking-wider text-acero-500">
        Gestión
      </p>

      <nav className="flex flex-col gap-0.5">{items.map(enlace)}</nav>

      {itemsAyuda.length > 0 && (
        <>
          <p className="mb-2 mt-6 px-3 text-micro font-semibold uppercase tracking-wider text-acero-500">
            Ayuda
          </p>
          <nav className="flex flex-col gap-0.5">{itemsAyuda.map(enlace)}</nav>
        </>
      )}

      <div className="mt-auto border-t border-concreto-200 pt-4">
        <div className="flex items-center gap-2.5 px-1">
          {perfil?.imagen_url ? (
            <img
              src={perfil.imagen_url}
              alt=""
              className="h-9 w-9 shrink-0 rounded-full object-cover ring-1 ring-acero-200"
            />
          ) : (
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-perez-600 text-xs font-bold text-white">
              {iniciales(perfil?.nombre)}
            </span>
          )}
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-semibold text-caucho-950">{perfil?.nombre}</p>
            <p className="text-xs text-acero-500">{nombreRol[rol] ?? '—'}</p>
          </div>
        </div>

        {/* Con texto y no un icono suelto: salir es una acción que se busca
            leyendo, y una puerta dibujada en 16px no se encuentra. Va en
            outline —borde gris, fondo transparente— para que no compita con
            el ítem activo del menú, que es el otro elemento marcado de la
            barra. */}
        <button
          onClick={cerrarSesion}
          className="mt-3 flex w-full items-center justify-center gap-2 rounded-lg border border-acero-200 px-3 py-2 text-sm font-medium text-caucho-800 transition-colors hover:bg-white hover:text-caucho-950"
        >
          <LogOut size={15} aria-hidden="true" />
          Cerrar sesión
        </button>
      </div>
    </div>
  )

  return (
    <div className="min-h-screen lg:grid lg:grid-cols-[17rem_1fr]">
      <aside className="no-imprimir hidden lg:block">
        <div className="sticky top-0 h-screen">{panel}</div>
      </aside>

      <header className="no-imprimir sticky top-0 z-30 flex items-center justify-between border-b border-concreto-200/80 bg-white/85 px-4 py-3 backdrop-blur-md lg:hidden">
        <img src="/logo-perez.png" alt="Neumáticos y Servicios Pérez" className="w-28" />
        <button
          onClick={() => setAbierto(true)}
          aria-label="Abrir menú"
          className="rounded-xl p-2 text-caucho-800 transition-colors hover:bg-concreto-100"
        >
          <Menu size={20} />
        </button>
      </header>

      {abierto && (
        <div className="fixed inset-0 z-40 lg:hidden">
          <div
            className="aparecer absolute inset-0 bg-caucho-950/60 backdrop-blur-sm"
            onClick={() => setAbierto(false)}
            aria-hidden="true"
          />
          <div className="entrar absolute inset-y-0 left-0 w-72 shadow-2xl">
            <button
              onClick={() => setAbierto(false)}
              aria-label="Cerrar menú"
              className="absolute right-3 top-3 z-10 rounded-xl p-2 text-acero-500 transition-colors hover:bg-white hover:text-caucho-950"
            >
              <X size={20} />
            </button>
            {panel}
          </div>
        </div>
      )}

      <main className="px-4 py-6 sm:px-6 lg:px-10 lg:py-10">
        {/* La key remonta al cambiar de ruta: cada pantalla entra con su
            animación en vez de aparecer de golpe. */}
        <div key={ubicacion.pathname} className="entrar mx-auto max-w-6xl">
          <Outlet />
        </div>
      </main>
    </div>
  )
}
