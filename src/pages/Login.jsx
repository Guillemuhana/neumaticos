import { useState } from 'react'
import { Navigate } from 'react-router-dom'
import {
  AnimatePresence,
  domAnimation,
  LazyMotion,
  m,
  useMotionTemplate,
  useMotionValue,
  useReducedMotion,
  useSpring,
} from 'motion/react'
import { ArrowRight, Eye, EyeOff, Loader2, Lock, Mail } from 'lucide-react'
import { useAuth } from '../context/AuthProvider'
import { Aviso, Boton, Campo, estiloInput, Cargando } from '../components/UI'

/* La primera pantalla que ve alguien, y la única que ve un cliente al que le
   muestran el sistema. El resto de la app es deliberadamente sobria —son
   pantallas para trabajar ocho horas—, así que el movimiento se concentra acá,
   donde no estorba a nadie: nadie carga veinte logins por día.

   Todo lo que se mueve pasa por `useReducedMotion`. Quien pidió menos
   movimiento en su sistema ve la misma pantalla, quieta. */

/* Una sola curva para todo, la misma de index.css: el login puede tener más
   movimiento que el resto del sistema, pero no otro vocabulario. */
const SUAVE = [0.22, 1, 0.36, 1]

/* Los campos entran escalonados en vez de todos juntos. La diferencia es de
   décimas y es lo que separa "apareció un formulario" de "se armó". */
const contenedor = {
  oculto: {},
  visible: { transition: { staggerChildren: 0.07, delayChildren: 0.1 } },
}

const item = {
  oculto: { opacity: 0, y: 12 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.5, ease: SUAVE } },
}

export default function Login() {
  const { sesion, cargando, iniciarSesion } = useAuth()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [verClave, setVerClave] = useState(false)
  const [error, setError] = useState('')
  const [enviando, setEnviando] = useState(false)
  const quieto = useReducedMotion()

  if (cargando) return <Cargando texto="Abriendo tu sesión…" />
  if (sesion) return <Navigate to="/" replace />

  const enviar = async (e) => {
    e.preventDefault()
    setEnviando(true)
    setError('')
    const { error } = await iniciarSesion(email.trim(), password)
    if (error) {
      setError(
        error.message === 'Invalid login credentials'
          ? 'El mail o la contraseña no coinciden. Probá de nuevo.'
          : error.message
      )
      setEnviando(false)
    }
  }

  return (
    /* `LazyMotion` con `m` en vez del componente `motion` completo: trae solo
       las animaciones de DOM y deja afuera el resto de la librería (layout,
       drag, SVG). Son ~25 kB menos en una pantalla que se abre desde el
       celular del taller, muchas veces con la conexión del local. `strict`
       hace fallar el build si alguien escribe `motion.div` acá y se lleva la
       librería entera de vuelta sin darse cuenta. */
    <LazyMotion features={domAnimation} strict>
      <div className="grid min-h-screen lg:grid-cols-[1.1fr_1fr]">
        <PanelMarca quieto={quieto} />

        <div className="relative flex items-center justify-center overflow-hidden px-6 py-16">
          {/* En el celular no hay panel de marca, así que el color de la marca
              entra por acá: un resplandor detrás de la tarjeta, apenas. */}
          <div
            aria-hidden="true"
            className="pointer-events-none absolute -top-24 right-0 h-72 w-72 rounded-full bg-perez-200/40 blur-3xl lg:hidden"
          />

          <m.form
            onSubmit={enviar}
            variants={contenedor}
            initial={quieto ? false : 'oculto'}
            animate="visible"
            className="relative w-full max-w-sm space-y-6 rounded-[1.25rem] border border-concreto-200/80 bg-white/90 p-8 sombra-2 backdrop-blur-xl"
          >
            <m.img
              variants={item}
              src="/logo-perez.png"
              alt="Neumáticos y Servicios Pérez"
              className="mb-2 w-48 lg:hidden"
            />

            <m.div variants={item}>
              <h2 className="display text-3xl font-bold tracking-tight text-caucho-950">
                Entrá a tu cuenta
              </h2>
              <p className="mt-2 max-w-sm text-sm text-acero-500">
                Usá el correo que te dio gerencia.
              </p>
            </m.div>

            <m.div variants={item}>
              <Campo etiqueta="Correo">
                <CampoConIcono icono={Mail}>
                  <input
                    type="email"
                    required
                    autoComplete="username"
                    className={`${estiloInput} pl-9`}
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="nombre@perez.com.ar"
                  />
                </CampoConIcono>
              </Campo>
            </m.div>

            <m.div variants={item}>
              <Campo etiqueta="Contraseña">
                <CampoConIcono icono={Lock}>
                  <input
                    type={verClave ? 'text' : 'password'}
                    required
                    autoComplete="current-password"
                    className={`${estiloInput} pl-9 pr-11`}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                  />
                  {/* Escribir una clave a ciegas desde el celular en el taller es
                      la causa más común de "no me deja entrar". */}
                  <button
                    type="button"
                    onClick={() => setVerClave((v) => !v)}
                    aria-label={verClave ? 'Ocultar contraseña' : 'Mostrar contraseña'}
                    className="absolute right-2 top-1/2 z-10 -translate-y-1/2 rounded-lg p-1.5 text-acero-400 transition-colors hover:bg-concreto-100 hover:text-caucho-800"
                  >
                    <AnimatePresence mode="wait" initial={false}>
                      <m.span
                        key={verClave ? 'ver' : 'ocultar'}
                        initial={quieto ? false : { opacity: 0, scale: 0.8 }}
                        animate={{ opacity: 1, scale: 1 }}
                        exit={{ opacity: 0, scale: 0.8 }}
                        transition={{ duration: 0.15 }}
                        className="block"
                      >
                        {verClave ? <EyeOff size={16} /> : <Eye size={16} />}
                      </m.span>
                    </AnimatePresence>
                  </button>
                </CampoConIcono>
              </Campo>
            </m.div>

            {/* El error entra empujando al botón hacia abajo en vez de aparecer
                de golpe encima: el salto es lo que hace perder de vista el campo
                que hay que corregir. Y sacude una vez, que es como se lee "esto
                no anduvo" sin tener que ponerlo en rojo furioso. */}
            <AnimatePresence>
              {error && (
                <m.div
                  initial={quieto ? false : { opacity: 0, height: 0, x: 0 }}
                  animate={{
                    opacity: 1,
                    height: 'auto',
                    x: quieto ? 0 : [0, -7, 6, -4, 0],
                  }}
                  exit={{ opacity: 0, height: 0 }}
                  transition={{
                    duration: 0.4,
                    ease: SUAVE,
                    x: { duration: 0.42, ease: 'easeInOut' },
                  }}
                  className="overflow-hidden"
                >
                  {/* El cartel es el `Aviso` del sistema y no una copia de sus
                      clases: el día que cambie el color de lo que falla, tiene
                      que cambiar también acá sin que nadie se acuerde. */}
                  <Aviso>{error}</Aviso>
                </m.div>
              )}
            </AnimatePresence>

            <m.div variants={item}>
              <Boton type="submit" disabled={enviando} className="group w-full">
                <AnimatePresence mode="wait" initial={false}>
                  {enviando ? (
                    <m.span
                      key="entrando"
                      initial={quieto ? false : { opacity: 0, y: 6 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -6 }}
                      transition={{ duration: 0.18 }}
                      className="inline-flex items-center gap-2"
                    >
                      <Loader2 size={16} className="animate-spin" aria-hidden="true" />
                      Entrando…
                    </m.span>
                  ) : (
                    <m.span
                      key="entrar"
                      initial={quieto ? false : { opacity: 0, y: 6 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -6 }}
                      transition={{ duration: 0.18 }}
                      className="inline-flex items-center gap-2"
                    >
                      Entrar
                      <ArrowRight
                        size={16}
                        className="transition-transform duration-200 group-hover:translate-x-0.5"
                      />
                    </m.span>
                  )}
                </AnimatePresence>
              </Boton>
            </m.div>
            </m.form>
        </div>
      </div>
    </LazyMotion>
  )
}

/* El icono adentro del campo y el foco marcado con un halo del color de la
   marca. El halo es un `div` aparte y no un `box-shadow` en el input porque
   así no empuja nada al aparecer: crece por encima, sin mover el formulario. */
function CampoConIcono({ icono: Icono, children }) {
  const [enfocado, setEnfocado] = useState(false)

  return (
    <div
      className="relative"
      onFocusCapture={() => setEnfocado(true)}
      onBlurCapture={() => setEnfocado(false)}
    >
      <AnimatePresence>
        {enfocado && (
          <m.span
            aria-hidden="true"
            initial={{ opacity: 0, scale: 0.98 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.98 }}
            transition={{ duration: 0.2, ease: SUAVE }}
            className="pointer-events-none absolute -inset-1 rounded-xl bg-perez-500/10"
          />
        )}
      </AnimatePresence>

      <Icono
        size={16}
        aria-hidden="true"
        className={`pointer-events-none absolute left-3 top-1/2 z-10 -translate-y-1/2 transition-colors duration-200 ${
          enfocado ? 'text-perez-600' : 'text-acero-400'
        }`}
      />
      {children}
    </div>
  )
}

/* El panel de marca: la chapa del taller, ahora con luz.
 *
 * Son tres capas quietas y una que sigue al mouse. Ninguna es una imagen: todo
 * es gradiente y desenfoque, así que no agrega un solo byte de descarga y
 * escala a cualquier pantalla sin pixelarse. */
function PanelMarca({ quieto }) {
  /* La posición del mouse, suavizada por un resorte. Sin el resorte el
     reflejo persigue al cursor con precisión de robot; con él tiene inercia,
     que es lo que lo hace leerse como luz y no como un div moviéndose. */
  const x = useMotionValue(50)
  const y = useMotionValue(50)
  const xs = useSpring(x, { stiffness: 120, damping: 26, mass: 0.6 })
  const ys = useSpring(y, { stiffness: 120, damping: 26, mass: 0.6 })

  const reflejo = useMotionTemplate`radial-gradient(38rem 38rem at ${xs}% ${ys}%, rgba(46,156,186,0.20), transparent 65%)`

  const seguir = (e) => {
    if (quieto) return
    const caja = e.currentTarget.getBoundingClientRect()
    x.set(((e.clientX - caja.left) / caja.width) * 100)
    y.set(((e.clientY - caja.top) / caja.height) * 100)
  }

  return (
    <div
      onMouseMove={seguir}
      className="relative hidden flex-col justify-between overflow-hidden bg-caucho-950 p-12 lg:flex"
    >
      {/* Dos manchas de color que respiran, en las dos puntas. Es lo que hace
          que el negro no se lea como un rectángulo apagado. */}
      <Aurora
        quieto={quieto}
        className="-left-32 -top-32 h-[34rem] w-[34rem] bg-perez-600/25"
        demora={0}
      />
      <Aurora
        quieto={quieto}
        className="-bottom-40 -right-24 h-[30rem] w-[30rem] bg-perez-800/40"
        demora={2.5}
      />

      {/* El reflejo que sigue al mouse. */}
      {!quieto && (
        <m.div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0"
          style={{ background: reflejo }}
        />
      )}

      {/* Trama de taller: una grilla finita, casi invisible, que le da
          superficie al fondo. Se desvanece hacia abajo para no competir con
          el texto. */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 opacity-[0.07]"
        style={{
          backgroundImage:
            'linear-gradient(rgba(255,255,255,.5) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,.5) 1px, transparent 1px)',
          backgroundSize: '44px 44px',
          maskImage: 'linear-gradient(to bottom, black, transparent 75%)',
          WebkitMaskImage: 'linear-gradient(to bottom, black, transparent 75%)',
        }}
      />

      <span className="franja absolute inset-y-0 left-0 z-10 w-3" aria-hidden="true" />

      <div className="relative z-10 flex flex-1 items-center justify-center pl-6">
        <m.div
          initial={quieto ? false : { opacity: 0, scale: 0.94, y: 10 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          transition={{ duration: 0.7, ease: SUAVE }}
          className="rounded-[1.25rem] bg-white p-8 sombra-3"
        >
          <img src="/logo-perez.png" alt="Neumáticos y Servicios Pérez" className="w-72" />
        </m.div>
      </div>

      <m.div
        variants={contenedor}
        initial={quieto ? false : 'oculto'}
        animate="visible"
        className="relative z-10 pl-6"
      >
        <m.p
          variants={item}
          className="text-xs font-semibold uppercase tracking-[0.3em] text-perez-300"
        >
          Sistema de gestión
        </m.p>
        <ul className="mt-4 space-y-1.5 font-mono text-sm text-acero-300">
          {['Stock en tiempo real', 'Ventas y cotizaciones', 'Órdenes de taller', 'Control de personal'].map(
            (linea) => (
              <m.li key={linea} variants={item} className="flex items-center gap-2">
                <span aria-hidden="true" className="h-1 w-1 rounded-full bg-perez-500" />
                {linea}
              </m.li>
            )
          )}
        </ul>
      </m.div>
    </div>
  )
}

/* Una mancha de color desenfocada que late despacio. Doce segundos por ciclo:
   lo suficientemente lento como para que no se vea moverse si uno la mira, y
   suficiente para que la pantalla no parezca una foto. */
function Aurora({ className, demora, quieto }) {
  if (quieto) {
    return <div aria-hidden="true" className={`absolute rounded-full blur-3xl ${className}`} />
  }

  return (
    <m.div
      aria-hidden="true"
      className={`absolute rounded-full blur-3xl ${className}`}
      animate={{ scale: [1, 1.14, 1], opacity: [0.75, 1, 0.75] }}
      transition={{ duration: 12, delay: demora, repeat: Infinity, ease: 'easeInOut' }}
    />
  )
}
