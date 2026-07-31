import { useCallback, useEffect, useState } from 'react'

/* Envuelve una consulta a Supabase: estado de carga, error y recarga manual.
   Ignora respuestas viejas para que una consulta lenta no pise a una nueva. */
export function useConsulta(consulta, deps = []) {
  const [datos, setDatos] = useState(null)
  const [cargando, setCargando] = useState(true)
  const [error, setError] = useState('')
  const [pulso, setPulso] = useState(0)

  const recargar = useCallback(() => setPulso((n) => n + 1), [])

  useEffect(() => {
    let vigente = true
    setCargando(true)

    consulta()
      .then(({ data, error }) => {
        if (!vigente) return
        if (error) setError(error.message)
        else {
          setError('')
          setDatos(data)
        }
      })
      .catch((e) => vigente && setError(e.message))
      .finally(() => vigente && setCargando(false))

    return () => {
      vigente = false
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [...deps, pulso])

  return { datos, cargando, error, recargar }
}
