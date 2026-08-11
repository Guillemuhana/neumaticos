/* Una foto sacada con el celular pesa 3–5 MB y viene de 4000 px de ancho. Para
   lo que se usa acá —mirar un rayón en pantalla o mostrárselo al cliente que
   discute un daño— con 1600 px sobra, y el ingreso de un auto deja de tardar
   un minuto por foto en el wifi del taller.

   `imageOrientation: 'from-image'` es lo que evita que las fotos verticales
   salgan acostadas: el celular guarda la rotación como metadato EXIF y no gira
   los píxeles, así que al dibujarlas en un canvas se pierde. */
export async function achicar(archivo, { lado = 1600, calidad = 0.82 } = {}) {
  /* Cualquier formato que el navegador no sepa decodificar —un HEIC viejo, un
     archivo cortado— sube tal cual vino. Perder la foto por no poder achicarla
     sería peor que subirla pesada. */
  try {
    const bitmap = await createImageBitmap(archivo, { imageOrientation: 'from-image' })

    const escala = Math.min(1, lado / Math.max(bitmap.width, bitmap.height))
    if (escala === 1 && archivo.size < 600_000) {
      bitmap.close()
      return archivo
    }

    const lienzo = document.createElement('canvas')
    lienzo.width = Math.round(bitmap.width * escala)
    lienzo.height = Math.round(bitmap.height * escala)

    const ctx = lienzo.getContext('2d')
    ctx.drawImage(bitmap, 0, 0, lienzo.width, lienzo.height)
    bitmap.close()

    const blob = await new Promise((r) => lienzo.toBlob(r, 'image/jpeg', calidad))
    if (!blob) return archivo

    return new File([blob], cambiarExtension(archivo.name), { type: 'image/jpeg' })
  } catch {
    return archivo
  }
}

const cambiarExtension = (nombre = 'foto') => `${nombre.replace(/\.[^.]+$/, '')}.jpg`
