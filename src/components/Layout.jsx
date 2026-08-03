import { useState } from 'react'
import { NavLink, Outlet, useLocation } from 'react-router-dom'
import {
  BarChart3,
  Boxes,
  Contact,
  FileText,
  LayoutDashboard,
  LogOut,
  Menu,
  Receipt,
  Users,
  Wrench,
  X,
} from 'lucide-react'
import { useAuth } from '../context/AuthProvider'

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
  { a: '/personal', texto: 'Personal', icono: Users, roles: ['gerencia', 'vendedor', 'mecanico'] },
  { a: '/estadisticas', texto: 'Estadísticas', icono: BarChart3, roles: ['gerencia'] },
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
  const { perfil, rol, cerrarSesion } = useAuth()
  const [abierto, setAbierto] = useState(false)
  const ubicacion = useLocation()

  const items = navegacion.filter((i) => i.roles.includes(rol))

  const panel = (
    <div className="relative flex h-full flex-col overflow-hidden bg-caucho-950 p-4">
      {/* Franja del logo, apenas insinuada: ubica la marca sin gritar. */}
      <span className="franja absolute inset-y-0 left-0 w-0.5 opacity-60" aria-hidden="true" />

      <div className="mb-6 rounded-lg bg-white px-3 py-2.5">
        <img src="/logo-perez.png" alt="Neumáticos y Servicios Pérez" className="w-full" />
      </div>

      <p className="mb-2 px-3 text-[0.6875rem] font-semibold uppercase tracking-wider text-acero-500">
        Gestión
      </p>

      <nav className="flex flex-col gap-0.5">
        {items.map(({ a, texto, icono: Icono }) => (
          <NavLink
            key={a}
            to={a}
            end={a === '/'}
            onClick={() => setAbierto(false)}
            className={({ isActive }) =>
              `group relative flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors duration-150 ${
                isActive
                  ? 'bg-perez-600 text-white'
                  : 'text-acero-300 hover:bg-white/[0.07] hover:text-white'
              }`
            }
          >
            {({ isActive }) => (
              <>
                {/* Marca la fila activa aun para quien no distingue el rojo. */}
                <span
                  aria-hidden="true"
                  className={`absolute -left-4 top-1/2 h-4 w-1 -translate-y-1/2 rounded-r bg-perez-500 transition-opacity ${
                    isActive ? 'opacity-100' : 'opacity-0'
                  }`}
                />
                <Icono size={17} aria-hidden="true" className="shrink-0" />
                {texto}
              </>
            )}
          </NavLink>
        ))}
      </nav>

      <div className="mt-auto border-t border-white/10 pt-4">
        <div className="flex items-center gap-2.5 px-1">
          {perfil?.imagen_url ? (
            <img
              src={perfil.imagen_url}
              alt=""
              className="h-9 w-9 shrink-0 rounded-full object-cover ring-1 ring-white/15"
            />
          ) : (
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-perez-600 text-xs font-bold text-white">
              {iniciales(perfil?.nombre)}
            </span>
          )}
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-semibold text-white">{perfil?.nombre}</p>
            <p className="text-xs text-acero-500">{nombreRol[rol] ?? '—'}</p>
          </div>
          <button
            onClick={cerrarSesion}
            aria-label="Salir"
            title="Salir"
            className="shrink-0 rounded-lg p-2 text-acero-400 transition-colors hover:bg-white/10 hover:text-white"
          >
            <LogOut size={16} />
          </button>
        </div>
      </div>
    </div>
  )

  return (
    <div className="min-h-screen lg:grid lg:grid-cols-[17rem_1fr]">
      <aside className="hidden lg:block">
        <div className="sticky top-0 h-screen">{panel}</div>
      </aside>

      <header className="sticky top-0 z-30 flex items-center justify-between border-b border-concreto-200/80 bg-white/85 px-4 py-3 backdrop-blur-md lg:hidden">
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
              className="absolute right-3 top-3 z-10 rounded-xl p-2 text-acero-300 transition-colors hover:bg-white/10 hover:text-white"
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
