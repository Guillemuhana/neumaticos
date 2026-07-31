import { useState } from 'react'
import { NavLink, Outlet } from 'react-router-dom'
import {
  BarChart3,
  Boxes,
  ClipboardList,
  LayoutDashboard,
  LogOut,
  Menu,
  Receipt,
  Users,
  X,
} from 'lucide-react'
import { useAuth } from '../context/AuthProvider'
import { Boton } from './UI'

/* Cada entrada declara qué roles la ven. La lista es solo la superficie:
   si alguien fuerza la URL, RLS le devuelve vacío igual. */
const navegacion = [
  { a: '/', texto: 'Panel', icono: LayoutDashboard, roles: ['gerencia', 'vendedor', 'mecanico'] },
  { a: '/stock', texto: 'Stock', icono: Boxes, roles: ['gerencia', 'vendedor'] },
  { a: '/ventas', texto: 'Ventas', icono: Receipt, roles: ['gerencia', 'vendedor'] },
  { a: '/taller', texto: 'Taller', icono: ClipboardList, roles: ['gerencia', 'mecanico'] },
  { a: '/personal', texto: 'Personal', icono: Users, roles: ['gerencia', 'vendedor', 'mecanico'] },
  { a: '/estadisticas', texto: 'Estadísticas', icono: BarChart3, roles: ['gerencia'] },
]

const nombreRol = {
  gerencia: 'Gerencia',
  vendedor: 'Vendedor',
  mecanico: 'Mecánico',
}

export default function Layout() {
  const { perfil, rol, cerrarSesion } = useAuth()
  const [abierto, setAbierto] = useState(false)

  const items = navegacion.filter((i) => i.roles.includes(rol))

  const enlaces = (
    <nav className="flex flex-col gap-1">
      {items.map(({ a, texto, icono: Icono }) => (
        <NavLink
          key={a}
          to={a}
          end={a === '/'}
          onClick={() => setAbierto(false)}
          className={({ isActive }) =>
            `flex items-center gap-3 rounded-md px-3 py-2.5 text-sm font-medium transition-colors ${
              isActive
                ? 'bg-perez-600 text-white'
                : 'text-acero-300 hover:bg-caucho-800 hover:text-white'
            }`
          }
        >
          <Icono size={18} aria-hidden="true" />
          {texto}
        </NavLink>
      ))}
    </nav>
  )

  const panel = (
    <div className="flex h-full flex-col gap-6 bg-caucho-900 p-4">
      <div className="rounded-lg bg-white p-3">
        <img src="/logo-perez.png" alt="Neumáticos y Servicios Pérez" className="w-full" />
      </div>

      {enlaces}

      <div className="mt-auto border-t border-caucho-800 pt-4">
        <p className="truncate text-sm font-medium text-white">{perfil?.nombre}</p>
        <p className="font-mono text-xs text-acero-500">{nombreRol[rol] ?? '—'}</p>
        <Boton
          variante="fantasma"
          className="mt-3 w-full justify-start text-acero-300 hover:bg-caucho-800 hover:text-white"
          onClick={cerrarSesion}
        >
          <LogOut size={16} /> Salir
        </Boton>
      </div>
    </div>
  )

  return (
    <div className="min-h-screen lg:grid lg:grid-cols-[16rem_1fr]">
      <aside className="hidden lg:block">
        <div className="sticky top-0 h-screen">{panel}</div>
      </aside>

      <header className="sticky top-0 z-30 flex items-center justify-between border-b border-concreto-200 bg-white px-4 py-3 lg:hidden">
        <img src="/logo-perez.png" alt="Neumáticos y Servicios Pérez" className="w-28" />
        <Boton variante="fantasma" onClick={() => setAbierto(true)} aria-label="Abrir menú">
          <Menu size={20} />
        </Boton>
      </header>

      {abierto && (
        <div className="fixed inset-0 z-40 lg:hidden">
          <div
            className="absolute inset-0 bg-caucho-950/50"
            onClick={() => setAbierto(false)}
            aria-hidden="true"
          />
          <div className="absolute inset-y-0 left-0 w-72">
            <Boton
              variante="fantasma"
              className="absolute right-2 top-2 z-10 text-acero-300"
              onClick={() => setAbierto(false)}
              aria-label="Cerrar menú"
            >
              <X size={20} />
            </Boton>
            {panel}
          </div>
        </div>
      )}

      <main className="px-4 py-6 sm:px-6 lg:px-10 lg:py-10">
        <div className="mx-auto max-w-6xl">
          <Outlet />
        </div>
      </main>
    </div>
  )
}
