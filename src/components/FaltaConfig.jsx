import { Aviso } from './UI'

export default function FaltaConfig() {
  return (
    <div className="flex min-h-screen items-center justify-center px-6 py-16">
      <div className="w-full max-w-lg space-y-4">
        <h1 className="display text-2xl font-bold">Falta configurar Supabase</h1>
        <Aviso tono="atencion">
          El sitio se compiló sin <code>VITE_SUPABASE_URL</code> ni{' '}
          <code>VITE_SUPABASE_ANON_KEY</code>.
        </Aviso>
        <p className="text-sm text-acero-500">
          Se leen al compilar, no al abrir la página: hay que cargarlas en el
          entorno (Vercel → Settings → Environment Variables, o un archivo{' '}
          <code>.env</code> local) y <strong>volver a desplegar</strong>. Un
          deploy viejo sigue sin credenciales aunque las variables ya estén.
        </p>
      </div>
    </div>
  )
}
