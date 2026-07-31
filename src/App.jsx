import { Navigate, Route, Routes } from 'react-router-dom'
import { useAuth } from './context/AuthProvider'
import { Cargando } from './components/UI'
import Login from './pages/Login'
import Inicio from './pages/Inicio'

function RutaPrivada({ children }) {
  const { sesion, cargando } = useAuth()
  if (cargando) return <Cargando texto="Verificando tu sesión…" />
  if (!sesion) return <Navigate to="/login" replace />
  return children
}

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route
        path="/"
        element={
          <RutaPrivada>
            <Inicio />
          </RutaPrivada>
        }
      />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}
