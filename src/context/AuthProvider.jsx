import { createContext, useCallback, useContext, useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [sesion, setSesion] = useState(null)
  const [perfil, setPerfil] = useState(null)
  const [perfilError, setPerfilError] = useState('')
  const [cargando, setCargando] = useState(true)

  const traerPerfil = useCallback(async (userId) => {
    setPerfilError('')
    if (!userId) {
      setPerfil(null)
      return
    }

    try {
      const { data, error } = await supabase
        .from('perfiles')
        /* `imagen_url` la usa la barra lateral y `comision_pct`, el panel de
           cada uno: son datos del propio perfil, que es justo lo que RLS
           siempre devuelve, así que no cuesta traerlos con la sesión. */
        .select('id, nombre, rol, activo, imagen_url, comision_pct')
        .eq('id', userId)
        .maybeSingle()
      if (error) throw error
      setPerfil(data ?? null)
    } catch (err) {
      console.error('Error cargando perfil:', err)
      setPerfil(null)
      setPerfilError(
        err.message ||
          'No se pudo cargar el perfil. Revisa que la tabla perfiles exista y que el esquema de Supabase esté desplegado.'
      )
    }
  }, [])

  useEffect(() => {
    let vivo = true

    supabase.auth.getSession().then(async ({ data }) => {
      if (!vivo) return
      setSesion(data.session)
      await traerPerfil(data.session?.user?.id)
      if (vivo) setCargando(false)
    })

    const { data: sub } = supabase.auth.onAuthStateChange(async (_evento, s) => {
      if (!vivo) return
      setSesion(s)
      await traerPerfil(s?.user?.id)
      if (vivo) setCargando(false)
    })

    return () => {
      vivo = false
      sub.subscription.unsubscribe()
    }
  }, [traerPerfil])

  const iniciarSesion = (email, password) =>
    supabase.auth.signInWithPassword({ email, password })

  const cerrarSesion = () => supabase.auth.signOut()

  /* El rol de la UI es solo para no mostrar botones inútiles: quien manda
     es RLS en la base. Ver supabase/schema.sql. */
  const rol = perfil?.rol ?? null
  const puede = (...roles) => roles.includes(rol)

  return (
    <AuthContext.Provider
      value={{ sesion, perfil, perfilError, rol, puede, cargando, iniciarSesion, cerrarSesion }}
    >
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth debe usarse dentro de <AuthProvider>')
  return ctx
}
