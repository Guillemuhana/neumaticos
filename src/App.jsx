import { Suspense, lazy } from 'react'
import { Navigate, Route, Routes } from 'react-router-dom'
import { useAuth } from './context/AuthProvider'
import { Aviso, Cargando } from './components/UI'
import Layout from './components/Layout'
import Login from './pages/Login'
import Inicio from './pages/Inicio'
import Stock from './pages/Stock'
import Ventas from './pages/Ventas'
import Taller from './pages/Taller'
import Personal from './pages/Personal'

/* Estadísticas arrastra recharts (~300 kB). Es la única pantalla que lo usa y
   solo la ve gerencia: cargarla aparte le ahorra la descarga a todo el resto,
   que entra desde el celular en el taller. */
const Estadisticas = lazy(() => import('./pages/Estadisticas'))

/* Primera barrera: hay sesión y el perfil está activo.
   La segunda —qué datos devuelve cada consulta— la aplica RLS en Postgres. */
function RutaPrivada({ children }) {
  const { sesion, perfil, cargando } = useAuth()

  if (cargando) return <Cargando texto="Verificando tu sesión…" />
  if (!sesion) return <Navigate to="/login" replace />

  if (!perfil)
    return (
      <div className="mx-auto max-w-md px-6 py-20">
        <Aviso tono="atencion">
          Tu usuario no tiene perfil cargado. Pedile a gerencia que te dé de alta.
        </Aviso>
      </div>
    )

  if (!perfil.activo)
    return (
      <div className="mx-auto max-w-md px-6 py-20">
        <Aviso>Tu usuario está dado de baja. Consultá con gerencia.</Aviso>
      </div>
    )

  return children
}

function SoloRoles({ roles, children }) {
  const { rol } = useAuth()
  if (!roles.includes(rol)) return <Navigate to="/" replace />
  return children
}

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />

      <Route
        element={
          <RutaPrivada>
            <Layout />
          </RutaPrivada>
        }
      >
        <Route path="/" element={<Inicio />} />
        <Route
          path="/stock"
          element={
            <SoloRoles roles={['gerencia', 'vendedor']}>
              <Stock />
            </SoloRoles>
          }
        />
        <Route
          path="/ventas"
          element={
            <SoloRoles roles={['gerencia', 'vendedor']}>
              <Ventas />
            </SoloRoles>
          }
        />
        <Route
          path="/taller"
          element={
            <SoloRoles roles={['gerencia', 'mecanico']}>
              <Taller />
            </SoloRoles>
          }
        />
        <Route path="/personal" element={<Personal />} />
        <Route
          path="/estadisticas"
          element={
            <SoloRoles roles={['gerencia']}>
              <Suspense fallback={<Cargando texto="Cargando gráficos…" alto="min-h-[60vh]" />}>
                <Estadisticas />
              </Suspense>
            </SoloRoles>
          }
        />
      </Route>

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}
