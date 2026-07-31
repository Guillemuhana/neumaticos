import { LogIn, LogOut, Users } from 'lucide-react'
import { useEffect, useState } from 'react'
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
  Campo,
  Modal,
  estiloInput,
} from '../components/UI'

export default function Personal() {
  const { sesion, perfil, puede } = useAuth()
  const [error, setError] = useState('')
  const [fichando, setFichando] = useState(false)
  const [editarEmpleado, setEditarEmpleado] = useState(null)
  const [busquedaEmpleado, setBusquedaEmpleado] = useState('')

  const { datos: fichadas, cargando: fichadasCargando, error: fichadasError, recargar: recargarFichadas } = useConsulta(
    () =>
      supabase
        .from('fichadas')
        .select('*, perfiles(nombre, rol)')
        .order('momento', { ascending: false })
        .limit(100),
    []
  )

  const { datos: empleados, cargando: empleadosCargando, error: empleadosError, recargar: recargarEmpleados } = useConsulta(
    () =>
      puede('gerencia')
        ? supabase
            .from('perfiles')
            .select('*')
            .order('creado_en', { ascending: false })
        : Promise.resolve({ data: [] }),
    [puede]
  )

  const propias = fichadas?.filter((f) => f.perfil_id === sesion.user.id) ?? []
  const ultima = propias[0]
  const siguiente = ultima?.tipo === 'ingreso' ? 'egreso' : 'ingreso'

  const fichar = async () => {
    setFichando(true)
    setError('')
    const { error } = await supabase
      .from('fichadas')
      .insert({ perfil_id: sesion.user.id, tipo: siguiente })
    if (error) setError(error.message)
    setFichando(false)
    recargarFichadas()
  }

  const empleadosFiltrados = (empleados || []).filter((empleado) => {
    const q = busquedaEmpleado.trim().toLowerCase()
    if (!q) return true
    return [
      empleado.nombre,
      empleado.email,
      empleado.telefono,
      empleado.documento,
      empleado.rol,
    ]
      .filter(Boolean)
      .join(' ')
      .toLowerCase()
      .includes(q)
  })

  const [guardandoEmpleado, setGuardandoEmpleado] = useState(false)

  const guardarEmpleado = async (empleado) => {
    setError('')

    const datosEmpleado = {
      nombre: empleado.nombre.trim(),
      rol: empleado.rol,
      telefono: empleado.telefono?.trim() || null,
      documento: empleado.documento?.trim() || null,
      email: empleado.email?.trim() || null,
      imagen_url: empleado.imagen_url?.trim() || null,
      activo: empleado.activo,
    }

    if (!datosEmpleado.nombre) return 'El nombre es obligatorio.'
    if (!datosEmpleado.email) return 'El email es obligatorio.'
    if (!['vendedor', 'mecanico', 'gerencia'].includes(datosEmpleado.rol)) return 'Rol inválido.'

    const actualizarPerfil = async (fila, id) => {
      const { error } = await supabase.from('perfiles').update(fila).eq('id', id)
      if (error && error.message.includes('column "telefono" does not exist')) {
        const fallback = { ...fila }
        delete fallback.telefono
        delete fallback.email
        delete fallback.documento
        delete fallback.imagen_url
      if (!empleado.password) return 'La contraseña es obligatoria para un nuevo empleado.'
      const { data, error } = await supabase.auth.signUp(
        {
          email: datosEmpleado.email,
          password: empleado.password,
        },
        {
          data: {
            nombre: datosEmpleado.nombre,
            rol: datosEmpleado.rol,
            telefono: datosEmpleado.telefono,
            documento: datosEmpleado.documento,
          },
        }
      )
      if (error) return error.message
      const userId = data.user?.id || data?.id
      if (!userId) return 'No se pudo crear el usuario.'
      const perfilError = await actualizarPerfil(datosEmpleado, userId)
      if (perfilError) return perfilError.message
      return null
    }

    const error = await actualizarPerfil(datosEmpleado, empleado.id)
    if (error) return error.message
    return null
  }

  const manejarGuardarEmpleado = async () => {
    if (!editarEmpleado) return
    setGuardandoEmpleado(true)
    setError('')
    const mensaje = await guardarEmpleado(editarEmpleado)
    setGuardandoEmpleado(false)
    if (mensaje) {
      setError(mensaje)
      return
    }
    setEditarEmpleado(null)
    recargarEmpleados()
  }

  const cambiarActivo = async (empleado) => {
    const { error } = await supabase.from('perfiles').update({ activo: !empleado.activo }).eq('id', empleado.id)
    if (error) setError(error.message)
    else recargarEmpleados()
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

      {puede('gerencia') && (
        <>
          <div className="mb-4 flex flex-wrap items-center justify-between gap-4">
            <h2 className="display mb-0 font-bold">Equipo</h2>
            <Boton
              onClick={() =>
                setEditarEmpleado({
                  id: '',
                  nombre: '',
                  telefono: '',
                  email: '',
                  documento: '',
                  imagen_url: '',
                  rol: 'vendedor',
                  activo: true,
                  password: '',
                })
              }
            >
              Nuevo empleado
            </Boton>
          </div>

          <div className="relative mb-4">
            <input
              className={`${estiloInput} pl-3`}
              placeholder="Buscar empleado por nombre, email, rol o documento..."
              value={busquedaEmpleado}
              onChange={(e) => setBusquedaEmpleado(e.target.value)}
            />
          </div>

          <Tarjeta>
            {empleadosCargando ? (
              <Cargando texto="Cargando empleados…" alto="min-h-[30vh]" />
            ) : empleadosError ? (
              <Aviso>{empleadosError}</Aviso>
            ) : empleadosFiltrados.length === 0 ? (
              <Vacio icono={Users} titulo="No hay empleados" detalle="Registrá el primer empleado del equipo." />
            ) : (
              <Tabla
                columnas={['Nombre', 'Rol', 'Email', 'Teléfono', 'Documento', 'Activo', 'Acciones']}
              >
                {empleadosFiltrados.map((empleado) => (
                  <tr
                    key={empleado.id}
                    className="hover:bg-concreto-50 rounded-xl bg-white shadow-sm sm:bg-transparent sm:shadow-none"
                  >
                    <td data-label="Nombre" className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        {empleado.imagen_url ? (
                          <img
                            src={empleado.imagen_url}
                            alt={empleado.nombre}
                            className="h-12 w-12 rounded-full object-cover border border-concreto-200"
                          />
                        ) : (
                          <div className="flex h-12 w-12 items-center justify-center rounded-full border border-concreto-200 bg-concreto-50 text-xs uppercase text-acero-500">
                            {empleado.nombre?.charAt(0) || '?'}
                          </div>
                        )}
                        <div>
                          <p className="font-medium">{empleado.nombre}</p>
                          <p className="text-xs uppercase text-acero-500">{empleado.rol}</p>
                        </div>
                      </div>
                    </td>
                    <td data-label="Rol" className="px-4 py-3 text-acero-500">
                      {empleado.rol}
                    </td>
                    <td data-label="Email" className="px-4 py-3 text-acero-500">
                      {empleado.email || '—'}
                    </td>
                    <td data-label="Teléfono" className="px-4 py-3 text-acero-500">
                      {empleado.telefono || '—'}
                    </td>
                    <td data-label="Documento" className="px-4 py-3 text-acero-500">
                      {empleado.documento || '—'}
                    </td>
                    <td data-label="Activo" className="px-4 py-3">
                      <Etiqueta tono={empleado.activo ? 'conforme' : 'atencion'}>
                        {empleado.activo ? 'Activo' : 'Inactivo'}
                      </Etiqueta>
                    </td>
                    <td data-label="Acciones" className="px-4 py-3 text-right">
                      <div className="flex flex-wrap justify-end gap-2">
                        <Boton variante="fantasma" className="px-2 py-1" onClick={() => setEditarEmpleado(empleado)}>
                          Editar
                        </Boton>
                        <Boton
                          variante="fantasma"
                          className="px-4 py-1"
                          onClick={() => cambiarActivo(empleado)}
                        >
                          {empleado.activo ? 'Desactivar' : 'Activar'}
                        </Boton>
                      </div>
                    </td>
                  </tr>
                ))}
              </Tabla>
            )}
          </Tarjeta>
        </>
      )}

      <h2 className="display mb-3 font-bold">
        {puede('gerencia') ? 'Movimientos del equipo' : 'Tus movimientos'}
      </h2>

      <Tarjeta>
        {fichadasCargando ? (
          <Cargando texto="Leyendo fichadas…" alto="min-h-[30vh]" />
        ) : fichadas?.length === 0 ? (
          <Vacio icono={Users} titulo="Sin movimientos" detalle="Las fichadas aparecen acá apenas se registren." />
        ) : (
          <Tabla columnas={puede('gerencia') ? ['Empleado', 'Tipo', 'Momento'] : ['Tipo', 'Momento']}>
            {fichadas.map((f) => (
              <tr key={f.id} className="hover:bg-concreto-50 rounded-xl bg-white shadow-sm sm:bg-transparent sm:shadow-none">
                {puede('gerencia') && (
                  <td data-label="Empleado" className="px-4 py-3 font-medium">
                    {f.perfiles?.nombre ?? '—'}
                  </td>
                )}
                <td data-label="Tipo" className="px-4 py-3">
                  <Etiqueta tono={f.tipo === 'ingreso' ? 'conforme' : 'neutro'}>{f.tipo}</Etiqueta>
                </td>
                <td data-label="Momento" className="px-4 py-3 text-acero-500">
                  {fecha(f.momento)}
                </td>
              </tr>
            ))}
          </Tabla>
        )}
      </Tarjeta>
    </>
  )
}

function FormularioEmpleado({ empleado, onCerrar, onGuardado, guardarEmpleado }) {
  const [form, setForm] = useState(empleado)
  const [imagenFile, setImagenFile] = useState(null)
  const [imagenPreview, setImagenPreview] = useState(empleado.imagen_url || '')
  const [error, setError] = useState('')
  const [guardando, setGuardando] = useState(false)

  useEffect(() => {
    setForm(empleado)
    setImagenPreview(empleado.imagen_url || '')
    setImagenFile(null)
  }, [empleado])

  const campo = (k) => ({
    value: form[k] ?? '',
    onChange: (e) => setForm({ ...form, [k]: e.target.value }),
  })

  const subirImagen = async () => {
    if (!imagenFile) return form.imagen_url?.trim() || null

    const nombre = `empleados/${Date.now()}_${imagenFile.name}`
    let upload = await supabase.storage.from('empleados').upload(nombre, imagenFile, {
      cacheControl: '3600',
      upsert: true,
    })

    if (upload.error && upload.error.message?.includes('bucket') ) {
      upload = await supabase.storage.from('productos').upload(nombre, imagenFile, {
        cacheControl: '3600',
        upsert: true,
      })
    }

    if (upload.error) throw upload.error

    const { data: urlData, error: urlError } = await supabase.storage
      .from(upload.data?.bucket || 'empleados')
      .getPublicUrl(nombre)

    if (urlError) throw urlError
    return urlData.publicUrl
  }

  const guardar = async (e) => {
    e.preventDefault()
    setGuardando(true)
    setError('')

    try {
      const imagen_url = await subirImagen()
      const resultado = await guardarEmpleado({ ...form, imagen_url })
      if (resultado) {
        setError(resultado)
        return
      }
      onGuardado()
    } catch (err) {
      setError(err.message ?? 'Error subiendo la imagen')
    } finally {
      setGuardando(false)
    }
  }

  return (
    <Modal titulo={form.id ? 'Editar empleado' : 'Nuevo empleado'} onCerrar={onCerrar}>
      <form onSubmit={guardar} className="space-y-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <Campo etiqueta="Nombre">
            <input required className={estiloInput} {...campo('nombre')} />
          </Campo>
          <Campo etiqueta="Rol">
            <select required className={estiloInput} {...campo('rol')}>
              <option value="vendedor">Vendedor</option>
              <option value="mecanico">Mecánico</option>
              <option value="gerencia">Gerencia</option>
            </select>
          </Campo>
          <Campo etiqueta="Email">
            <input type="email" className={estiloInput} {...campo('email')} />
          </Campo>
          <Campo etiqueta="Teléfono">
            <input className={estiloInput} {...campo('telefono')} />
          </Campo>
          <Campo etiqueta="Documento">
            <input className={estiloInput} {...campo('documento')} />
          </Campo>
          <Campo etiqueta="Imagen" ayuda="Subí una foto del empleado desde tu equipo.">
            <input
              type="file"
              accept="image/*"
              className={estiloInput}
              onChange={(e) => {
                const file = e.target.files?.[0]
                if (!file) return
                setImagenFile(file)
                setImagenPreview(URL.createObjectURL(file))
              }}
            />
          </Campo>
          {!form.id && (
            <Campo etiqueta="Contraseña" ayuda="La contraseña es obligatoria para el nuevo usuario.">
              <input
                type="password"
                className={estiloInput}
                value={form.password ?? ''}
                onChange={(e) => setForm({ ...form, password: e.target.value })}
              />
            </Campo>
          )}
        </div>

        {imagenPreview ? (
          <div className="rounded-xl border border-concreto-200 p-4">
            <p className="mb-2 text-sm font-medium text-caucho-800">Vista previa</p>
            <img src={imagenPreview} alt="Preview" className="h-40 w-full rounded-xl object-cover" />
          </div>
        ) : null}

        <Aviso>{error}</Aviso>

        <div className="flex justify-end gap-2">
          <Boton type="button" variante="secundario" onClick={onCerrar}>
            Cancelar
          </Boton>
          <Boton type="submit" disabled={guardando}>
            {guardando ? 'Guardando…' : 'Guardar'}
          </Boton>
        </div>
      </form>
    </Modal>
  )
}
