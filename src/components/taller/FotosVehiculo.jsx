import { useRef, useState } from 'react'
import { Camera, Trash2 } from 'lucide-react'
import { useAuth } from '../../context/AuthProvider'
import { useConsulta } from '../../hooks/useConsulta'
import { errorDeStorage, supabase } from '../../lib/supabase'
import { achicar } from '../../lib/imagen'
import { fecha } from '../../lib/formato'
import { Aviso, Boton, Modal } from '../UI'

/* El registro visual del auto: cómo entró, qué se le encontró, cómo se
   entregó. Es la prueba que se mira cuando el cliente vuelve diciendo que el
   rayón no estaba, así que la foto lleva siempre quién la sacó y cuándo.

   El momento no se elige: lo dice el estado de la orden. Quien tiene el auto
   delante y el celular en la mano no debería tener que clasificar nada, y el
   90% de las veces la respuesta correcta es la obvia. */

const BUCKET = 'vehiculos'

const MOMENTOS = {
  ingreso: 'Cómo entró',
  trabajo: 'Durante el trabajo',
  entrega: 'Cómo se entregó',
}

const momentoSegunEstado = (estado) =>
  estado === 'pendiente' ? 'ingreso' : estado === 'entregada' ? 'entrega' : estado === 'terminada' ? 'entrega' : 'trabajo'

const urlDe = (ruta) => supabase.storage.from(BUCKET).getPublicUrl(ruta).data.publicUrl

export default function FotosVehiculo({ orden, editable }) {
  const { sesion, rol } = useAuth()
  const entrada = useRef(null)
  const [subiendo, setSubiendo] = useState(0)
  const [error, setError] = useState('')
  const [mirando, setMirando] = useState(null)

  const { datos, cargando, error: errorConsulta, recargar } = useConsulta(
    () =>
      supabase
        .from('orden_fotos')
        .select('id, ruta, momento, creada_en, subida_por')
        .eq('orden_id', orden.id)
        .order('creada_en'),
    [orden.id]
  )

  /* El nombre de quien sacó la foto sale de `equipo` y no de un join a
     `perfiles`: RLS solo devuelve el perfil propio y los de gerencia, así que
     el vendedor vería en blanco toda foto sacada por un mecánico. La vista
     existe justamente para esto. */
  const { datos: equipo } = useConsulta(() => supabase.from('equipo').select('id, nombre'), [])
  const nombreDe = (id) => equipo?.find((e) => e.id === id)?.nombre

  const subir = async (evento) => {
    const archivos = Array.from(evento.target.files ?? [])
    /* El input se limpia ya: sin esto, sacar dos veces la misma foto no
       dispara el change y la segunda no sube. */
    evento.target.value = ''
    if (!archivos.length) return

    setError('')
    setSubiendo(archivos.length)

    const momento = momentoSegunEstado(orden.estado)

    /* De a una y no en paralelo: son fotos de varios MB desde un celular, y
       seis subidas simultáneas en el wifi del taller terminan más lento que
       en fila —además de dejar a medias las que fallan. */
    for (const archivo of archivos) {
      try {
        const liviana = await achicar(archivo)
        const ruta = `${orden.id}/${crypto.randomUUID()}.jpg`

        const { error: errorSubida } = await supabase.storage
          .from(BUCKET)
          .upload(ruta, liviana, { cacheControl: '3600', contentType: liviana.type })

        if (errorSubida) throw errorDeStorage(errorSubida, BUCKET)

        const { error: errorFila } = await supabase.from('orden_fotos').insert({
          orden_id: orden.id,
          momento,
          ruta,
          subida_por: sesion.user.id,
        })

        /* Si la fila no entra, el archivo queda huérfano en el bucket: se
           borra acá para que no se acumule basura que nadie va a mirar. */
        if (errorFila) {
          await supabase.storage.from(BUCKET).remove([ruta])
          throw errorFila
        }
      } catch (e) {
        setError(e.message ?? 'No se pudo subir la foto.')
        break
      } finally {
        setSubiendo((n) => n - 1)
      }
    }

    recargar()
  }

  const borrar = async (foto) => {
    setError('')
    const { error: errorFila } = await supabase.from('orden_fotos').delete().eq('id', foto.id)
    if (errorFila) return setError(errorFila.message)

    await supabase.storage.from(BUCKET).remove([foto.ruta])
    setMirando(null)
    recargar()
  }

  const fotos = datos ?? []
  const grupos = Object.keys(MOMENTOS)
    .map((clave) => [clave, fotos.filter((f) => f.momento === clave)])
    .filter(([, lista]) => lista.length > 0)

  return (
    <section className="rounded-lg border border-concreto-200">
      <div className="flex items-center justify-between gap-2 border-b border-concreto-200 px-3 py-2">
        <h3 className="text-menor font-bold uppercase tracking-wide text-acero-500">
          Fotos del vehículo
        </h3>
        {editable && (
          <>
            {/* Un input de archivo no se puede estilar, así que el botón lo
                dispara. `capture` hace que en el celular abra la cámara
                directo en vez del carrete, que es como se usa en el mostrador
                con el auto delante. */}
            <input
              ref={entrada}
              type="file"
              accept="image/*"
              capture="environment"
              multiple
              onChange={subir}
              className="hidden"
            />
            <Boton
              variante="fantasma"
              className="px-2 py-1"
              onClick={() => entrada.current?.click()}
              disabled={subiendo > 0}
            >
              <Camera size={14} /> {subiendo > 0 ? `Subiendo ${subiendo}…` : 'Sacar foto'}
            </Boton>
          </>
        )}
      </div>

      <div className="space-y-3 p-3">
        {errorConsulta && <Aviso>{errorConsulta}</Aviso>}
        <Aviso>{error}</Aviso>

        {cargando ? (
          <p className="py-2 text-sm text-acero-500">Cargando fotos…</p>
        ) : !fotos.length ? (
          <p className="py-2 text-sm text-acero-500">
            {editable
              ? 'Sin fotos todavía. Sacale unas al auto cuando entra: es lo que resuelve la discusión si después aparece un daño.'
              : 'Todavía no se cargaron fotos de este vehículo.'}
          </p>
        ) : (
          grupos.map(([clave, lista]) => (
            <div key={clave}>
              <p className="mb-1.5 text-micro font-semibold uppercase tracking-wider text-acero-500">
                {MOMENTOS[clave]}
              </p>
              <ul className="grid grid-cols-3 gap-2 sm:grid-cols-4">
                {lista.map((foto) => (
                  <li key={foto.id}>
                    <button
                      type="button"
                      onClick={() => setMirando(foto)}
                      className="block w-full overflow-hidden rounded-lg border border-concreto-200"
                    >
                      <img
                        src={urlDe(foto.ruta)}
                        alt={`${MOMENTOS[clave]} · ${fecha(foto.creada_en)}`}
                        loading="lazy"
                        className="aspect-square w-full object-cover transition-transform duration-200 hover:scale-105"
                      />
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          ))
        )}
      </div>

      {mirando && (
        <Modal titulo={MOMENTOS[mirando.momento]} onCerrar={() => setMirando(null)}>
          <img
            src={urlDe(mirando.ruta)}
            alt=""
            className="w-full rounded-lg border border-concreto-200"
          />
          <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
            <p className="text-xs text-acero-500">
              {fecha(mirando.creada_en)}
              {nombreDe(mirando.subida_por) ? ` · ${nombreDe(mirando.subida_por)}` : ''}
            </p>
            {/* Borrar es de gerencia, para la que salió movida. RLS lo aplica
                igual: esconder el botón es para no ofrecer lo imposible. */}
            {rol === 'gerencia' && (
              <Boton variante="peligro" className="px-2 py-1" onClick={() => borrar(mirando)}>
                <Trash2 size={14} /> Borrar
              </Boton>
            )}
          </div>
        </Modal>
      )}
    </section>
  )
}
