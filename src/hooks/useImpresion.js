import { useEffect, useState } from 'react'

/* Imprimir desde una pantalla de la app tiene un paso que es fácil pasar por
   alto: el diálogo del navegador se abre con lo que hay en el DOM en ese
   instante. Si se llama a `window.print()` en el mismo tick en que se pide la
   hoja, todavía no está montada y sale impresa la pantalla anterior.

   Devuelve `[hoja, imprimir]`. `imprimir(datos)` monta la hoja, espera un
   frame y recién ahí abre el diálogo; al cerrarlo, la hoja se desmonta sola.
   Cada pantalla decide qué dibuja: acá solo vive el cuándo. */
export function useImpresion() {
  const [hoja, setHoja] = useState(null)

  useEffect(() => {
    if (!hoja) return

    const limpiar = () => setHoja(null)
    window.addEventListener('afterprint', limpiar)
    const id = requestAnimationFrame(() => window.print())

    return () => {
      window.removeEventListener('afterprint', limpiar)
      cancelAnimationFrame(id)
    }
  }, [hoja])

  return [hoja, setHoja]
}
