import { useCallback, useEffect, useState } from 'react'

/* Envuelve una consulta a Supabase: estado de carga, error y recarga manual.
   Ignora respuestas viejas para que una consulta lenta no pise a una nueva. */
export function useConsulta(consulta, deps = []) {
  const [datos, setDatos] = useState(null)
  const [cargando, setCargando] = useState(true)
  const [error, setError] = useState('')
  const [pulso, setPulso] = useState(0)

  const recargar = useCallback(() => setPulso((n) => n + 1), [])

  /* Siempre un texto: un error sin `message` dejaba el cartel vacío, que en
     pantalla es indistinguible de "no pasó nada". */
  const aTexto = (e) =>
    e?.message || e?.error_description || e?.details || 'Error inesperado al consultar los datos.'

  useEffect(() => {
    let vigente = true
    setCargando(true)

    consulta()
      .then((resultado) => {
        if (!vigente) return
        if (!resultado) {
          setError('La consulta no devolvió datos.')
          setDatos(null)
          return
        }

        const { data, error } = resultado
        if (error) setError(aTexto(error))
        else {
          setError('')
          setDatos(data)
        }
      })
      .catch((e) => vigente && setError(aTexto(e)))
      .finally(() => vigente && setCargando(false))

    return () => {
      vigente = false
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [...deps, pulso])

  return { datos, cargando, error, recargar }
}
