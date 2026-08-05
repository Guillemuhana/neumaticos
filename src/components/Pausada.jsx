import { Wrench } from 'lucide-react'

/* Cartel que reemplaza a toda la app cuando VITE_APP_PAUSADA está activa.
   Es lo único que se compila del lado del cliente en ese caso: no monta el
   router ni el proveedor de sesión, así que no hay pantalla a la que llegar
   por URL directa ni sesión guardada que sirva para entrar. */
export default function Pausada() {
  return (
    <div className="flex min-h-screen items-center justify-center px-6 py-16">
      <div className="w-full max-w-md space-y-5 text-center">
        <img
          src="/logo-perez.png"
          alt="Neumáticos y Servicios Pérez"
          className="mx-auto h-16 w-auto"
        />

        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-concreto-100 text-acero-500">
          <Wrench size={22} strokeWidth={2} />
        </div>

        <h1 className="display text-2xl font-bold text-caucho-900">
          Sistema en mantenimiento
        </h1>

        <p className="text-sm leading-relaxed text-acero-500">
          Estamos haciendo tareas de actualización sobre el sistema de gestión.
          El servicio vuelve a estar disponible en breve.
        </p>

        <p className="text-xs text-acero-400">
          Ante cualquier urgencia, comunicate por los canales de siempre.
        </p>
      </div>
    </div>
  )
}
