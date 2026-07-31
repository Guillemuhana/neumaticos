import { LogIn, LogOut, Users } from 'lucide-react'
import { useState } from 'react'
import { useAuth } from '../context/AuthProvider'
import { useConsulta } from '../hooks/useConsulta'
import { supabase } from '../lib/supabase'
import { fecha } from '../lib/formato'
import {
  Aviso,
  Boton,
  Cargando,
  Encabezado,
  Etiqueta,
  Tabla,
  Tarjeta,
  Vacio,
} from '../components/UI'

export default function Personal() {
  const { sesion, perfil, puede } = useAuth()
  const [error, setError] = useState('')
  const [fichando, setFichando] = useState(false)

  const { datos, cargando, recargar } = useConsulta(
    () =>
      supabase
        .from('fichadas')
        .select('*, perfiles(nombre, rol)')
        .order('momento', { ascending: false })
        .limit(100),
    []
  )

  const propias = datos?.filter((f) => f.perfil_id === sesion.user.id) ?? []
  const ultima = propias[0]
  /* El botón ofrece lo contrario de lo último fichado: así nadie marca
     dos ingresos seguidos por error. */
  const siguiente = ultima?.tipo === 'ingreso' ? 'egreso' : 'ingreso'

  const fichar = async () => {
    setFichando(true)
    setError('')
    const { error } = await supabase
      .from('fichadas')
      .insert({ perfil_id: sesion.user.id, tipo: siguiente })
    if (error) setError(error.message)
    setFichando(false)
    recargar()
  }

  return (
    <>
      <Encabezado titulo="Personal" detalle="Registro de ingreso y egreso." />

      <Tarjeta className="mb-6 p-6">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <p className="font-semibold">{perfil?.nombre}</p>
            <p className="mt-1 text-sm text-acero-500">
              {ultima ? `Último registro: ${ultima.tipo} · ${fecha(ultima.momento)}` : 'Sin registros todavía.'}
            </p>
          </div>
          <Boton onClick={fichar} disabled={fichando}>
            {siguiente === 'ingreso' ? <LogIn size={16} /> : <LogOut size={16} />}
            {fichando ? 'Registrando…' : siguiente === 'ingreso' ? 'Fichar ingreso' : 'Fichar egreso'}
          </Boton>
        </div>
        {error && <div className="mt-4"><Aviso>{error}</Aviso></div>}
      </Tarjeta>

      <h2 className="display mb-3 font-bold">
        {puede('gerencia') ? 'Movimientos del equipo' : 'Tus movimientos'}
      </h2>

      <Tarjeta>
        {cargando ? (
          <Cargando texto="Leyendo fichadas…" alto="min-h-[30vh]" />
        ) : datos.length === 0 ? (
          <Vacio icono={Users} titulo="Sin movimientos" detalle="Las fichadas aparecen acá apenas se registren." />
        ) : (
          <Tabla columnas={puede('gerencia') ? ['Empleado', 'Tipo', 'Momento'] : ['Tipo', 'Momento']}>
            {datos.map((f) => (
              <tr key={f.id} className="hover:bg-concreto-50">
                {puede('gerencia') && (
                  <td className="px-4 py-3 font-medium">{f.perfiles?.nombre ?? '—'}</td>
                )}
                <td className="px-4 py-3">
                  <Etiqueta tono={f.tipo === 'ingreso' ? 'conforme' : 'neutro'}>{f.tipo}</Etiqueta>
                </td>
                <td className="px-4 py-3 text-acero-500">{fecha(f.momento)}</td>
              </tr>
            ))}
          </Tabla>
        )}
      </Tarjeta>
    </>
  )
}
