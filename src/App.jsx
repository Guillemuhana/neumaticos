import { Suspense, lazy } from 'react'
import { Navigate, Route, Routes } from 'react-router-dom'
import { useAuth } from './context/AuthProvider'
import { Aviso, Cargando } from './components/UI'
import Layout from './components/Layout'
import Login from './pages/Login'
import Inicio from './pages/Inicio'
import Stock from './pages/Stock'
import Ventas from './pages/Ventas'
import Facturacion from './pages/Facturacion'
import Taller from './pages/Taller'
import Personal from './pages/Personal'
import Clientes from './pages/Clientes'
import Manual from './pages/Manual'

/* Estadísticas arrastra recharts (~300 kB). Es la única pantalla que lo usa y
   solo la ve gerencia: cargarla aparte le ahorra la descarga a todo el resto,
   que entra desde el celular en el taller. */
const Estadisticas = lazy(() => import('./pages/Estadisticas'))

/* Primera barrera: hay sesión y el perfil está activo.
   La segunda —qué datos devuelve cada consulta— la aplica RLS en Postgres. */
function RutaPrivada({ children }) {
  const { sesion, perfil, perfilError, cargando } = useAuth()

  if (cargando) return <Cargando texto="Verificando tu sesión…" />
  if (!sesion) return <Navigate to="/login" replace />

  if (perfilError)
    return (
      <div className="mx-auto max-w-md px-6 py-20">
        <Aviso tono="atencion">
          Error cargando tu perfil: {perfilError}
          <br />
          Si utilizás Supabase, asegurate de haber aplicado el esquema en{' '}
          <code>supabase/schema.sql</code> y de que la tabla{' '}
          <code>perfiles</code> exista.
        </Aviso>
      </div>
    )

  if (!perfil)
    return (
      <div className="mx-auto max-w-md px-6 py-20">
        <Aviso tono="atencion">
          Tu usuario no tiene perfil cargado. Pedile a gerencia que te dé de alta.
          <br />
          Sesión iniciada como <strong>{sesion.user.email}</strong>{' '}
          (ID: <code>{sesion.user.id}</code>).
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
          path="/facturacion"
          element={
            /* Escritorio de administración: el mecánico no ve datos fiscales
               ni importes del cliente, y RLS se lo niega igual. */
            <SoloRoles roles={['gerencia', 'vendedor']}>
              <Facturacion />
            </SoloRoles>
          }
        />
        <Route
          path="/taller"
          element={
            /* Recepción abre la orden y entrega el vehículo: el vendedor entra
               al taller aunque no ejecute el trabajo. */
            <SoloRoles roles={['gerencia', 'vendedor', 'mecanico']}>
              <Taller />
            </SoloRoles>
          }
        />
        <Route path="/personal" element={<Personal />} />
        {/* Sin `SoloRoles`: el manual lo ve todo el equipo y se filtra solo,
            mostrándole a cada uno las secciones de su puesto. */}
        <Route path="/manual" element={<Manual />} />
        <Route
          path="/clientes"
          element={
            <SoloRoles roles={['gerencia', 'vendedor']}>
              <Clientes />
            </SoloRoles>
          }
        />
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
