import { useAuth } from '../context/AuthProvider'
import { Boton } from '../components/UI'

/* Los módulos todavía no existen: esto es el esqueleto navegable. */
const modulos = [
  { titulo: 'Stock', detalle: 'Neumáticos, llantas y repuestos en tiempo real' },
  { titulo: 'Ventas', detalle: 'Comprobantes y cotizaciones' },
  { titulo: 'Taller', detalle: 'Órdenes de trabajo y turnos' },
  { titulo: 'Personal', detalle: 'Legajos, asistencia y comisiones' },
]

export default function Inicio() {
  const { sesion, cerrarSesion } = useAuth()

  return (
    <div className="min-h-screen">
      <header className="relative border-b border-concreto-200 bg-white">
        <span className="franja absolute inset-x-0 top-0 h-1" aria-hidden="true" />
        <div className="mx-auto flex max-w-5xl items-center justify-between gap-4 px-6 py-4">
          <img src="/logo-perez.png" alt="Neumáticos y Servicios Pérez" className="w-32" />
          <div className="flex items-center gap-4">
            <span className="hidden font-mono text-sm text-acero-500 sm:inline">
              {sesion?.user?.email}
            </span>
            <Boton variante="secundario" onClick={cerrarSesion}>
              Salir
            </Boton>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-6 py-10">
        <h1 className="display text-2xl font-bold">Panel de gestión</h1>
        <p className="mt-1 text-sm text-acero-500">Elegí por dónde arrancar.</p>

        <div className="mt-8 grid gap-4 sm:grid-cols-2">
          {modulos.map((m) => (
            <article
              key={m.titulo}
              className="rounded-lg border border-concreto-200 bg-white p-5"
            >
              <h2 className="display text-lg font-bold">{m.titulo}</h2>
              <p className="mt-1 text-sm text-acero-500">{m.detalle}</p>
            </article>
          ))}
        </div>
      </main>
    </div>
  )
}
