import { useEffect, useRef, useState } from 'react'
import { Camera, Download, Mic, Send, Square, Trash2 } from 'lucide-react'
import { useAuth } from '../context/AuthProvider'
import { useConsulta } from '../hooks/useConsulta'
import { errorDeStorage, supabase, urlDescarga, urlPublica } from '../lib/supabase'
import { achicar } from '../lib/imagen'
import { hora, fechaCorta, sello } from '../lib/formato'
import { Aviso, Boton, Cargando, Encabezado, Etiqueta, Tarjeta, Vacio, estiloInput } from '../components/UI'

/* El canal del equipo. Uno solo y grupal: en un taller de seis personas los
   canales por tema se vacían, y lo importante termina dicho de viva voz igual.

   Los mensajes llegan por realtime y no preguntando cada pocos segundos: en el
   celular del taller, sondear es batería y datos gastados en escuchar "no". */

const BUCKET = 'chat'
const urlDe = (ruta) => urlPublica(BUCKET, ruta)

/* Los archivos se suben con un UUID por nombre, que en la carpeta de
   descargas no le dice nada a nadie. Al bajarlos se rebautizan con qué son y
   de cuándo son: si mañana hay que mandarle al cliente la foto que pasó el
   mecánico, se encuentra buscando por fecha. */
const nombreAlBajar = (mensaje) => {
  const extension = mensaje.adjunto_ruta.split('.').pop() || 'dat'
  return `perez-${mensaje.adjunto_tipo}-${sello(mensaje.creado_en)}.${extension}`
}

const TONO_ROL = { gerencia: 'marca', vendedor: 'conforme', mecanico: 'atencion' }
const NOMBRE_ROL = { gerencia: 'Gerencia', vendedor: 'Vendedor', mecanico: 'Mecánico' }

export default function Chat() {
  const { sesion } = useAuth()
  const [mensajes, setMensajes] = useState([])
  const [cargando, setCargando] = useState(true)
  const [error, setError] = useState('')
  const finDelHilo = useRef(null)

  /* Los nombres salen de `equipo` y no de un join a `perfiles`: RLS solo
     devuelve el perfil propio, así que todo mensaje ajeno saldría sin autor. */
  const { datos: equipo } = useConsulta(() => supabase.from('equipo').select('id, nombre, rol'), [])
  const quien = (id) => equipo?.find((p) => p.id === id)

  useEffect(() => {
    let vigente = true

    supabase
      .from('mensajes')
      .select('*')
      .order('creado_en')
      .limit(200)
      .then(({ data, error }) => {
        if (!vigente) return
        if (error) setError(error.message)
        else setMensajes(data ?? [])
        setCargando(false)
      })

    /* Un solo canal para las altas. No hay que escuchar updates ni deletes:
       un mensaje no se edita, y borrar uno es tan raro que no justifica
       mantener el hilo sincronizado al segundo. */
    const canal = supabase
      .channel('chat-equipo')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'mensajes' },
        (payload) => {
          setMensajes((previos) =>
            /* El propio mensaje ya se agregó al enviarlo: sin este control se
               vería dos veces, porque realtime también lo devuelve. */
            previos.some((m) => m.id === payload.new.id) ? previos : [...previos, payload.new]
          )
        }
      )
      .subscribe()

    return () => {
      vigente = false
      supabase.removeChannel(canal)
    }
  }, [])

  /* Marca lo leído al entrar y al llegar algo nuevo estando en la pantalla:
     si el chat está abierto, ya está leído. */
  useEffect(() => {
    if (cargando) return
    supabase
      .from('chat_lecturas')
      .upsert({ perfil_id: sesion.user.id, visto_en: new Date().toISOString() })
      .then(() => {})
  }, [cargando, mensajes.length, sesion.user.id])

  useEffect(() => {
    finDelHilo.current?.scrollIntoView({ block: 'end' })
  }, [mensajes.length])

  const agregar = (mensaje) =>
    setMensajes((previos) => (previos.some((m) => m.id === mensaje.id) ? previos : [...previos, mensaje]))

  return (
    <>
      <Encabezado titulo="Chat del equipo" detalle="Un solo canal para todos: mostrador, taller y gerencia." />

      <Aviso>{error}</Aviso>

      <Tarjeta className="flex h-[calc(100vh-14rem)] min-h-[24rem] flex-col overflow-hidden">
        <div className="flex-1 overflow-y-auto p-4">
          {cargando ? (
            <Cargando texto="Cargando el hilo…" alto="min-h-[12rem]" />
          ) : !mensajes.length ? (
            <Vacio
              icono={Send}
              titulo="Todavía no hay mensajes"
              detalle="Escribí el primero: lo van a ver los tres puestos."
            />
          ) : (
            <ul className="space-y-3">
              {mensajes.map((m, i) => (
                <Burbuja
                  key={m.id}
                  mensaje={m}
                  autor={quien(m.autor_id)}
                  propio={m.autor_id === sesion.user.id}
                  /* El separador de día se decide comparando con el anterior:
                     así el hilo dice "ayer" y "hoy" sin repetir la fecha en
                     cada burbuja. */
                  nuevoDia={
                    i === 0 ||
                    new Date(m.creado_en).toDateString() !==
                      new Date(mensajes[i - 1].creado_en).toDateString()
                  }
                  onBorrado={(id) => setMensajes((p) => p.filter((x) => x.id !== id))}
                  onError={setError}
                />
              ))}
            </ul>
          )}
          <div ref={finDelHilo} />
        </div>

        <Redactor onEnviado={agregar} onError={setError} />
      </Tarjeta>
    </>
  )
}

function Burbuja({ mensaje, autor, propio, nuevoDia, onBorrado, onError }) {
  const { rol } = useAuth()

  const borrar = async () => {
    const { error } = await supabase.from('mensajes').delete().eq('id', mensaje.id)
    if (error) return onError(error.message)
    if (mensaje.adjunto_ruta) await supabase.storage.from(BUCKET).remove([mensaje.adjunto_ruta])
    onBorrado(mensaje.id)
  }

  return (
    <>
      {nuevoDia && (
        <li className="flex justify-center py-1">
          <span className="rounded-full bg-concreto-100 px-2.5 py-0.5 text-micro font-semibold uppercase tracking-wider text-acero-500">
            {fechaCorta(mensaje.creado_en)}
          </span>
        </li>
      )}
      <li className={`flex ${propio ? 'justify-end' : 'justify-start'}`}>
        <div
          className={`group max-w-[85%] rounded-xl px-3 py-2 sm:max-w-[70%] ${
            propio ? 'bg-perez-50' : 'bg-concreto-100'
          }`}
        >
          <div className="mb-1 flex flex-wrap items-center gap-x-2 gap-y-1">
            <span className="text-menor font-semibold text-caucho-900">
              {propio ? 'Vos' : (autor?.nombre ?? 'Usuario dado de baja')}
            </span>
            {autor?.rol && (
              <Etiqueta tono={TONO_ROL[autor.rol] ?? 'neutro'}>{NOMBRE_ROL[autor.rol]}</Etiqueta>
            )}
            <span className="text-micro text-acero-500">{hora(mensaje.creado_en)}</span>
            {rol === 'gerencia' && (
              <button
                onClick={borrar}
                aria-label="Borrar mensaje"
                className="ml-auto rounded p-0.5 text-acero-400 opacity-0 transition-opacity hover:text-perez-700 focus-visible:opacity-100 group-hover:opacity-100"
              >
                <Trash2 size={13} />
              </button>
            )}
          </div>

          {mensaje.texto && (
            <p className="whitespace-pre-wrap break-words text-sm text-caucho-900">{mensaje.texto}</p>
          )}

          {mensaje.adjunto_tipo === 'foto' && (
            <a href={urlDe(mensaje.adjunto_ruta)} target="_blank" rel="noreferrer">
              <img
                src={urlDe(mensaje.adjunto_ruta)}
                alt="Adjunto"
                loading="lazy"
                className="mt-1.5 max-h-64 rounded-lg border border-concreto-200"
              />
            </a>
          )}

          {mensaje.adjunto_tipo === 'audio' && (
            // eslint-disable-next-line jsx-a11y/media-has-caption
            <audio controls src={urlDe(mensaje.adjunto_ruta)} className="mt-1.5 w-full max-w-xs" />
          )}

          {/* Bajar el archivo, que es lo que hace falta cuando la foto hay que
              reenviársela al cliente o guardarla junto al presupuesto. Tocar
              la imagen la abre para mirarla; esto la guarda. */}
          {mensaje.adjunto_ruta && (
            <a
              href={urlDescarga(BUCKET, mensaje.adjunto_ruta, nombreAlBajar(mensaje))}
              download={nombreAlBajar(mensaje)}
              className="mt-1.5 inline-flex items-center gap-1 rounded px-1 py-0.5 text-micro font-medium text-acero-500 transition-colors hover:bg-white hover:text-caucho-950"
            >
              <Download size={12} aria-hidden="true" />
              Descargar
            </a>
          )}
        </div>
      </li>
    </>
  )
}

function Redactor({ onEnviado, onError }) {
  const { sesion } = useAuth()
  const entradaFoto = useRef(null)
  const grabadora = useRef(null)
  const [texto, setTexto] = useState('')
  const [enviando, setEnviando] = useState(false)
  const [grabando, setGrabando] = useState(false)

  const publicar = async ({ texto: cuerpo = null, ruta = null, tipo = null }) => {
    const { data, error } = await supabase
      .from('mensajes')
      .insert({ autor_id: sesion.user.id, texto: cuerpo, adjunto_ruta: ruta, adjunto_tipo: tipo })
      .select()
      .single()

    if (error) {
      /* El archivo ya subido queda huérfano si la fila no entra: se limpia,
         igual que en las fotos del vehículo. */
      if (ruta) await supabase.storage.from(BUCKET).remove([ruta])
      throw error
    }
    onEnviado(data)
  }

  const subir = async (archivo, extension) => {
    const ruta = `${sesion.user.id}/${crypto.randomUUID()}.${extension}`
    const { error } = await supabase.storage
      .from(BUCKET)
      .upload(ruta, archivo, { cacheControl: '3600', contentType: archivo.type })
    if (error) throw errorDeStorage(error, BUCKET)
    return ruta
  }

  const enviarTexto = async (e) => {
    e.preventDefault()
    const cuerpo = texto.trim()
    if (!cuerpo) return

    setEnviando(true)
    onError('')
    try {
      await publicar({ texto: cuerpo })
      setTexto('')
    } catch (err) {
      onError(err.message ?? 'No se pudo enviar el mensaje.')
    }
    setEnviando(false)
  }

  const enviarFoto = async (e) => {
    const archivo = e.target.files?.[0]
    e.target.value = ''
    if (!archivo) return

    setEnviando(true)
    onError('')
    try {
      const liviana = await achicar(archivo)
      await publicar({ texto: texto.trim() || null, ruta: await subir(liviana, 'jpg'), tipo: 'foto' })
      setTexto('')
    } catch (err) {
      onError(err.message ?? 'No se pudo enviar la foto.')
    }
    setEnviando(false)
  }

  /* Grabar y volver a tocar para cortar. Un botón que hay que mantener
     apretado es incómodo con guantes y se corta solo al mover el dedo. */
  const alternarAudio = async () => {
    if (grabando) {
      grabadora.current?.stop()
      return
    }

    onError('')
    try {
      const senal = await navigator.mediaDevices.getUserMedia({ audio: true })
      const rec = new MediaRecorder(senal)
      const trozos = []

      rec.ondataavailable = (e) => e.data.size > 0 && trozos.push(e.data)
      rec.onstop = async () => {
        /* Soltar el micrófono apaga el punto rojo del navegador: dejarlo
           tomado da la sensación de que sigue escuchando. */
        senal.getTracks().forEach((t) => t.stop())
        setGrabando(false)
        setEnviando(true)
        try {
          const blob = new Blob(trozos, { type: rec.mimeType })
          const archivo = new File([blob], 'audio.webm', { type: rec.mimeType })
          await publicar({ ruta: await subir(archivo, 'webm'), tipo: 'audio' })
        } catch (err) {
          onError(err.message ?? 'No se pudo enviar el audio.')
        }
        setEnviando(false)
      }

      grabadora.current = rec
      rec.start()
      setGrabando(true)
    } catch {
      onError('No se pudo usar el micrófono. Revisá el permiso del navegador.')
    }
  }

  return (
    <form
      onSubmit={enviarTexto}
      className="flex shrink-0 flex-wrap items-center gap-2 border-t border-concreto-200 bg-white p-3"
    >
      <input
        ref={entradaFoto}
        type="file"
        accept="image/*"
        capture="environment"
        onChange={enviarFoto}
        className="hidden"
      />

      <input
        className={`${estiloInput} min-w-0 flex-1`}
        placeholder={grabando ? 'Grabando…' : 'Escribí un mensaje…'}
        value={texto}
        onChange={(e) => setTexto(e.target.value)}
        disabled={enviando || grabando}
      />

      <Boton
        type="button"
        variante="secundario"
        onClick={() => entradaFoto.current?.click()}
        disabled={enviando || grabando}
      >
        <Camera size={16} /> Foto
      </Boton>

      <Boton
        type="button"
        variante={grabando ? 'peligro' : 'secundario'}
        onClick={alternarAudio}
        disabled={enviando}
      >
        {grabando ? (
          <>
            <Square size={14} /> Cortar
          </>
        ) : (
          <>
            <Mic size={16} /> Audio
          </>
        )}
      </Boton>

      <Boton type="submit" disabled={enviando || grabando || !texto.trim()}>
        <Send size={16} /> Enviar
      </Boton>
    </form>
  )
}
