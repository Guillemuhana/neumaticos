import { useConsulta } from './useConsulta'
import { supabase } from '../lib/supabase'

/* Los datos de la casa para la cabecera de lo que se imprime. Son una sola
   fila y no cambian nunca, pero cada pantalla que imprime los necesita.

   Que vuelva vacío es un caso normal, no un error: al mecánico RLS no le
   devuelve `empresa`, y administración puede no haber cargado todavía la razón
   social. La hoja se imprime igual con el nombre de la casa por defecto —lo
   que no puede faltar son los renglones. */
export function useEmpresa() {
  const { datos } = useConsulta(
    () => supabase.from('empresa').select('razon_social, domicilio').maybeSingle(),
    []
  )
  return datos
}
