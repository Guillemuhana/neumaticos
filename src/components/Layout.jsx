import { useState } from 'react'
import { NavLink, Outlet, useLocation } from 'react-router-dom'
import {
  BarChart3,
  Boxes,
  Contact,
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
  { a: '/taller', texto: 'Taller', icono: Wrench, roles: ['gerencia', 'mecanico'] },
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
    <div className="relative flex h-full flex-col gap-6 overflow-hidden bg-gradient-to-b from-caucho-900 to-caucho-950 p-5">
      {/* Franja del logo, apenas insinuada: ubica la marca sin gritar. */}
      <span className="franja absolute inset-y-0 left-0 w-1 opacity-70" aria-hidden="true" />

      <div className="rounded-2xl bg-white p-3.5 shadow-lg shadow-black/20">
        <img src="/logo-perez.png" alt="Neumáticos y Servicios Pérez" className="w-full" />
      </div>

      <nav className="flex flex-col gap-1">
        {items.map(({ a, texto, icono: Icono }) => (
          <NavLink
            key={a}
            to={a}
            end={a === '/'}
            onClick={() => setAbierto(false)}
            className={({ isActive }) =>
              `group relative flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-all duration-200 ${
                isActive
                  ? 'bg-perez-600 text-white shadow-lg shadow-perez-900/30'
                  : 'text-acero-300 hover:bg-white/5 hover:text-white'
              }`
            }
          >
            {({ isActive }) => (
              <>
                {/* Marca la fila activa aun para quien no distingue el rojo. */}
                <span
                  aria-hidden="true"
                  className={`absolute left-0 top-1/2 h-5 w-1 -translate-y-1/2 rounded-r-full bg-white transition-opacity ${
                    isActive ? 'opacity-90' : 'opacity-0'
                  }`}
                />
                <Icono
                  size={18}
                  aria-hidden="true"
                  className="shrink-0 transition-transform duration-200 group-hover:scale-110"
                />
                {texto}
              </>
            )}
          </NavLink>
        ))}
      </nav>

      <div className="mt-auto rounded-2xl border border-white/10 bg-white/5 p-4">
        <div className="flex items-center gap-3">
          {perfil?.imagen_url ? (
            <img
              src={perfil.imagen_url}
              alt=""
              className="h-10 w-10 shrink-0 rounded-full object-cover ring-2 ring-white/20"
            />
          ) : (
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-perez-600 text-sm font-bold text-white">
              {iniciales(perfil?.nombre)}
            </span>
          )}
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold text-white">{perfil?.nombre}</p>
            <p className="font-mono text-xs text-acero-400">{nombreRol[rol] ?? '—'}</p>
          </div>
        </div>

        <button
          onClick={cerrarSesion}
          className="mt-3 flex w-full items-center justify-center gap-2 rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm font-semibold text-acero-300 transition-colors hover:bg-white/10 hover:text-white"
        >
          <LogOut size={16} /> Salir
        </button>
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
