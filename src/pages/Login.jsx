import { useState } from 'react'
import { Navigate } from 'react-router-dom'
import { useAuth } from '../context/AuthProvider'
import { Boton, Campo, estiloInput, Aviso, Cargando } from '../components/UI'

export default function Login() {
  const { sesion, cargando, iniciarSesion } = useAuth()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [enviando, setEnviando] = useState(false)

  if (cargando) return <Cargando texto="Abriendo tu sesión…" />
  if (sesion) return <Navigate to="/" replace />

  const enviar = async (e) => {
    e.preventDefault()
    setEnviando(true)
    setError('')
    const { error } = await iniciarSesion(email.trim(), password)
    if (error) {
      setError(
        error.message === 'Invalid login credentials'
          ? 'El mail o la contraseña no coinciden. Probá de nuevo.'
          : error.message
      )
      setEnviando(false)
    }
  }

  return (
    <div className="grid min-h-screen lg:grid-cols-[1.1fr_1fr]">
      {/* Panel de marca: el logo montado como chapa de taller */}
      <div className="relative hidden flex-col justify-between bg-caucho-950/95 p-12 lg:flex">
        <span className="franja absolute inset-y-0 left-0 w-3" aria-hidden="true" />

        <div className="flex flex-1 items-center justify-center pl-6">
          <div className="rounded-[2rem] bg-white p-8 shadow-2xl shadow-caucho-950/20">
            <img
              src="/logo-perez.png"
              alt="Neumáticos y Servicios Pérez"
              className="w-64"
            />
          </div>
        </div>

        <div className="pl-6">
          <p className="text-xs font-semibold uppercase tracking-[0.3em] text-perez-300">
            Sistema de gestión
          </p>
          <ul className="mt-4 space-y-1.5 font-mono text-sm text-acero-300">
            <li>Stock en tiempo real</li>
            <li>Ventas y cotizaciones</li>
            <li>Órdenes de taller</li>
            <li>Control de personal</li>
          </ul>
        </div>
      </div>

      <div className="flex items-center justify-center px-6 py-16">
        <form onSubmit={enviar} className="w-full max-w-sm space-y-6 rounded-[2rem] border border-concreto-200/80 bg-white/95 p-8 shadow-2xl shadow-caucho-900/10 backdrop-blur-sm">
          <img
            src="/logo-perez.png"
            alt="Neumáticos y Servicios Pérez"
            className="mb-2 w-40 lg:hidden"
          />
          <div>
            <h2 className="display text-3xl font-bold tracking-tight text-caucho-950">Entrá a tu cuenta</h2>
            <p className="mt-2 max-w-sm text-sm text-acero-500">
              Usá el correo que te dio gerencia.
            </p>
          </div>

          <Campo etiqueta="Correo">
            <input
              type="email"
              required
              autoComplete="username"
              className={estiloInput}
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="nombre@perez.com.ar"
            />
          </Campo>

          <Campo etiqueta="Contraseña">
            <input
              type="password"
              required
              autoComplete="current-password"
              className={estiloInput}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </Campo>

          <Aviso>{error}</Aviso>

          <Boton type="submit" disabled={enviando} className="w-full">
            {enviando ? 'Entrando…' : 'Entrar'}
          </Boton>
        </form>
      </div>
    </div>
  )
}