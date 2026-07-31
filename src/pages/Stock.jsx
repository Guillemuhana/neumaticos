import { useMemo, useState } from 'react'
import { AlertTriangle, Boxes, ImageOff, Plus, Search, X } from 'lucide-react'
import { useAuth } from '../context/AuthProvider'
import { useConsulta } from '../hooks/useConsulta'
import { errorDeStorage, supabase } from '../lib/supabase'
import { numero, plata } from '../lib/formato'
import {
  Aviso,
  Boton,
  Campo,
  Cargando,
  Etiqueta,
  Modal,
  Tarjeta,
  Vacio,
  estiloInput,
} from '../components/UI'

const CATEGORIAS = [
  'Cubierta',
  'Amortiguador',
  'Rótula',
  'Filtro de aceite',
  'Filtro de aire',
  'Pastilla de freno',
  'Aceite',
  'Bujía',
  'Correa',
  'Otro repuesto',
]

const vacio = { codigo: '', categoria: 'Cubierta', marca: '', medida: '', precio: '', costo: '', stock: '', stock_minimo: '4' }

const ordenCategoria = (a, b) => {
  const ia = CATEGORIAS.indexOf(a)
  const ib = CATEGORIAS.indexOf(b)
  if (ia === -1 && ib === -1) return a.localeCompare(b)
  if (ia === -1) return 1
  if (ib === -1) return -1
  return ia - ib
}

export default function Stock() {
  const { puede } = useAuth()
  const [busqueda, setBusqueda] = useState('')
  /* La categoría es su propio filtro. Antes escribía el nombre dentro del
     buscador, así que filtrar borraba lo que estabas buscando. */
  const [categoria, setCategoria] = useState('todas')
  const [soloCriticos, setSoloCriticos] = useState(false)
  const [editando, setEditando] = useState(null)

  const { datos, cargando, error, recargar } = useConsulta(
    () => supabase.from('productos').select('*').eq('activo', true).order('marca'),
    []
  )

  const productos = datos ?? []

  const porTexto = useMemo(() => {
    const q = busqueda.trim().toLowerCase()
    if (!q) return productos
    return productos.filter((p) =>
      [p.categoria, p.marca, p.medida, p.codigo, p.descripcion, p.precio, p.stock]
        .filter((v) => v != null && v !== '')
        .join(' ')
        .toLowerCase()
        .includes(q)
    )
  }, [productos, busqueda])

  /* Los conteos de los chips salen del resultado de la búsqueda, no del total:
     si no, prometen artículos que el filtro de texto ya descartó. */
  const conteos = useMemo(() => {
    const mapa = new Map()
    porTexto.forEach((p) => {
      const c = p.categoria || 'Otro repuesto'
      mapa.set(c, (mapa.get(c) ?? 0) + 1)
    })
    return [...mapa.entries()].sort((a, b) => ordenCategoria(a[0], b[0]))
  }, [porTexto])

  const filtrados = useMemo(() => {
    let lista = categoria === 'todas'
      ? porTexto
      : porTexto.filter((p) => (p.categoria || 'Otro repuesto') === categoria)

    if (soloCriticos) lista = lista.filter((p) => p.stock <= p.stock_minimo)

    /* Una sola lista, ordenada por categoría y después por marca: se recorre
       de arriba a abajo sin que cada grupo abra su propia tarjeta. */
    return [...lista].sort(
      (a, b) =>
        ordenCategoria(a.categoria || 'Otro repuesto', b.categoria || 'Otro repuesto') ||
        (a.marca ?? '').localeCompare(b.marca ?? '')
    )
  }, [porTexto, categoria, soloCriticos])

  const resumen = useMemo(
    () => ({
      articulos: productos.length,
      unidades: productos.reduce((a, p) => a + (p.stock ?? 0), 0),
      valor: productos.reduce((a, p) => a + (p.stock ?? 0) * Number(p.costo ?? 0), 0),
      criticos: productos.filter((p) => p.stock <= p.stock_minimo).length,
    }),
    [productos]
  )

  const gestiona = puede('gerencia')
  const hayFiltro = busqueda.trim() !== '' || categoria !== 'todas' || soloCriticos

  const limpiar = () => {
    setBusqueda('')
    setCategoria('todas')
    setSoloCriticos(false)
  }

  return (
    <>
      {/* Título y resumen en un solo renglón. Lo de arriba no puede ocupar más
          alto que las primeras filas: lo que se viene a mirar es la lista. */}
      <div className="mb-3 flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
        <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
          <h1 className="display text-xl font-bold text-caucho-950">Stock</h1>
          <p className="text-sm text-acero-500">
            {numero(resumen.articulos)} artículos · {numero(resumen.unidades)} unidades ·{' '}
            <span className="font-medium text-caucho-700">{plata(resumen.valor)}</span> a costo
          </p>
        </div>
        {gestiona && (
          <Boton onClick={() => setEditando(vacio)} className="px-3.5 py-2">
            <Plus size={16} /> Nuevo artículo
          </Boton>
        )}
      </div>

      <Tarjeta className="mb-3 p-3">
        <div className="relative">
          <Search
            size={16}
            className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-acero-400"
            aria-hidden="true"
          />
          <input
            className={`${estiloInput} pl-9 ${busqueda ? 'pr-10' : ''}`}
            placeholder="Buscar por marca, medida, código o precio…"
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
          />
          {busqueda && (
            <button
              type="button"
              onClick={() => setBusqueda('')}
              aria-label="Limpiar búsqueda"
              className="absolute right-2 top-1/2 -translate-y-1/2 rounded-lg p-1.5 text-acero-400 transition-colors hover:bg-concreto-100 hover:text-caucho-800"
            >
              <X size={15} />
            </button>
          )}
        </div>

        <div className="mt-2.5 flex flex-wrap items-center gap-1.5">
          <Chip activo={categoria === 'todas'} onClick={() => setCategoria('todas')} cantidad={porTexto.length}>
            Todas
          </Chip>
          {conteos.map(([nombre, cantidad]) => (
            <Chip
              key={nombre}
              activo={categoria === nombre}
              onClick={() => setCategoria(categoria === nombre ? 'todas' : nombre)}
              cantidad={cantidad}
            >
              {nombre}
            </Chip>
          ))}

          {/* Lo único accionable del inventario merece un atajo propio. */}
          {resumen.criticos > 0 && (
            <button
              type="button"
              onClick={() => setSoloCriticos((v) => !v)}
              aria-pressed={soloCriticos}
              className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-sm font-medium transition-all duration-200 ${
                soloCriticos
                  ? 'border-atencion-600 bg-atencion-600 text-white'
                  : 'border-atencion-100 bg-atencion-50 text-atencion-700 hover:border-atencion-600/40'
              }`}
            >
              <AlertTriangle size={14} aria-hidden="true" />
              Para reponer
              <span
                className={`rounded-full px-1.5 text-xs font-semibold tabular-nums ${
                  soloCriticos ? 'bg-white/20' : 'bg-white/70'
                }`}
              >
                {numero(resumen.criticos)}
              </span>
            </button>
          )}

          {hayFiltro && (
            <button
              onClick={limpiar}
              className="rounded-full px-3 py-1.5 text-sm font-medium text-acero-500 underline-offset-4 transition-colors hover:text-perez-700 hover:underline"
            >
              Limpiar
            </button>
          )}
        </div>
      </Tarjeta>

      {error && <Aviso>{error}</Aviso>}

      <Tarjeta className="overflow-hidden">
        {cargando ? (
          <Cargando texto="Leyendo inventario…" alto="min-h-[40vh]" />
        ) : filtrados.length === 0 ? (
          <Vacio
            icono={Boxes}
            titulo="No hay artículos"
            detalle={hayFiltro ? 'Probá con otra búsqueda o quitá los filtros.' : 'Cargá el primer artículo del inventario.'}
          />
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="responsive-table w-full text-sm sm:min-w-[48rem]">
                {/* El encabezado queda fijo: en una lista larga, saber qué
                    columna se está mirando importa más que ganar 36px. */}
                <thead className="hidden sm:table-header-group">
                  <tr className="border-b border-concreto-200 bg-white text-left">
                    {['Artículo', 'Categoría', 'Medida', 'Precio', 'Stock'].map((c, i) => (
                      <th
                        key={c}
                        className={`sticky top-0 bg-white px-4 py-2.5 text-xs font-semibold uppercase tracking-wide text-acero-500 ${
                          i >= 3 ? 'text-right' : ''
                        }`}
                      >
                        {c}
                      </th>
                    ))}
                    {gestiona && <th className="sticky top-0 bg-white px-4 py-2.5" />}
                  </tr>
                </thead>

                <tbody className="divide-y divide-concreto-200">
                  {filtrados.map((p) => {
                    const critico = p.stock <= p.stock_minimo
                    return (
                      <tr key={p.id} className="group transition-colors hover:bg-concreto-50">
                        <td data-label="Artículo" className="px-4 py-2.5">
                          <div className="flex items-center gap-3">
                            {p.imagen_url ? (
                              <img
                                src={p.imagen_url}
                                alt=""
                                className="h-9 w-9 shrink-0 rounded-md border border-concreto-200 object-cover"
                              />
                            ) : (
                              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md border border-concreto-200 bg-concreto-50 text-acero-300">
                                <ImageOff size={14} aria-hidden="true" />
                              </span>
                            )}
                            <div className="min-w-0">
                              <p className="truncate font-semibold text-caucho-900">{p.marca}</p>
                              <p className="truncate text-xs text-acero-500">
                                {p.descripcion || '—'}
                                {p.codigo && <span className="font-mono"> · {p.codigo}</span>}
                              </p>
                            </div>
                          </div>
                        </td>
                        <td data-label="Categoría" className="px-4 py-2.5 text-acero-500">
                          {p.categoria || 'Otro repuesto'}
                        </td>
                        <td data-label="Medida" className="px-4 py-2.5 font-mono text-caucho-700">
                          {p.medida}
                        </td>
                        <td data-label="Precio" className="px-4 py-2.5 font-semibold tabular-nums sm:text-right">
                          {plata(p.precio)}
                        </td>
                        <td data-label="Stock" className="px-4 py-2.5 sm:text-right">
                          {/* Solo se etiqueta lo que necesita acción: un "OK" en
                              cada fila es ruido y esconde lo que sí importa. */}
                          <div className="flex items-center gap-2 sm:justify-end">
                            {critico && <Etiqueta tono="atencion">reponer</Etiqueta>}
                            <span
                              className={`font-mono font-semibold tabular-nums ${
                                critico ? 'text-atencion-700' : 'text-caucho-900'
                              }`}
                            >
                              {p.stock}
                            </span>
                          </div>
                        </td>
                        {gestiona && (
                          <td data-label="Acciones" className="px-4 py-2.5 text-right">
                            <button
                              onClick={() => setEditando(p)}
                              className="rounded-lg px-2.5 py-1 text-sm font-semibold text-acero-500 transition-colors hover:bg-concreto-200 hover:text-caucho-900 sm:opacity-0 sm:group-focus-within:opacity-100 sm:group-hover:opacity-100"
                            >
                              Editar
                            </button>
                          </td>
                        )}
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>

            {hayFiltro && (
              <p className="border-t border-concreto-200 px-4 py-2 text-xs text-acero-500">
                Mostrando {numero(filtrados.length)} de {numero(resumen.articulos)} artículos.
              </p>
            )}
          </>
        )}
      </Tarjeta>

      {editando && (
        <FormularioProducto
          producto={editando}
          gestiona={gestiona}
          onCerrar={() => setEditando(null)}
          onGuardado={() => {
            setEditando(null)
            recargar()
          }}
        />
      )}
    </>
  )
}

function Chip({ activo, cantidad, onClick, children }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={activo}
      className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-sm font-medium transition-all duration-200 ${
        activo
          ? 'border-perez-600 bg-perez-600 text-white shadow-sm shadow-perez-900/20'
          : 'border-concreto-200 bg-white text-caucho-700 hover:border-acero-300 hover:bg-concreto-50'
      }`}
    >
      {children}
      <span
        className={`rounded-full px-1.5 text-xs font-semibold tabular-nums ${
          activo ? 'bg-white/20 text-white' : 'bg-concreto-100 text-acero-500'
        }`}
      >
        {numero(cantidad)}
      </span>
    </button>
  )
}

function FormularioProducto({ producto, onCerrar, onGuardado, gestiona }) {
  const [form, setForm] = useState(producto)
  const [imagenFile, setImagenFile] = useState(null)
  const [imagenPreview, setImagenPreview] = useState(producto.imagen_url || '')
  const [error, setError] = useState('')
  const [guardando, setGuardando] = useState(false)

  const campo = (k) => ({
    value: form[k] ?? '',
    onChange: (e) => setForm({ ...form, [k]: e.target.value }),
  })

  const subirImagen = async () => {
    if (!imagenFile) return null

    const nombre = `${Date.now()}_${imagenFile.name}`
    const { error: errorSubida } = await supabase.storage
      .from('productos')
      .upload(nombre, imagenFile, { cacheControl: '3600', upsert: true })

    if (errorSubida) throw errorDeStorage(errorSubida, 'productos')

    const { data: urlData } = supabase.storage.from('productos').getPublicUrl(nombre)
    return urlData.publicUrl
  }

  const guardar = async (e) => {
    e.preventDefault()
    setGuardando(true)
    setError('')

    if (!gestiona) {
      setError('Solo gerencia puede crear o editar productos.')
      setGuardando(false)
      return
    }

    try {
      const imagen_url = imagenFile
        ? await subirImagen()
        : form.imagen_url?.trim() || null

      const filaBase = {
        codigo: form.codigo?.trim() || null,
        categoria: form.categoria || 'Cubierta',
        marca: form.marca.trim(),
        medida: form.medida.trim(),
        descripcion: form.descripcion?.trim() || null,
        imagen_url,
        precio: Number(form.precio) || 0,
        costo: Number(form.costo) || 0,
        stock: Number(form.stock) || 0,
        stock_minimo: Number(form.stock_minimo) || 0,
      }

      const ejecutarProducto = async (fila) =>
        form.id
          ? await supabase.from('productos').update(fila).eq('id', form.id)
          : await supabase.from('productos').insert(fila)

      let response = await ejecutarProducto(filaBase)
      if (response.error && response.error.message.includes('column "categoria" does not exist')) {
        const filaSinCategoria = { ...filaBase }
        delete filaSinCategoria.categoria
        response = await ejecutarProducto(filaSinCategoria)
      }

      const { error } = response

      if (error) {
        const mensaje = error.message.includes('row-level security')
          ? 'No tenés permisos para crear o editar productos. Verificá que tu usuario tenga rol gerencia en Supabase.'
          : error.message
        setError(mensaje)
      } else {
        onGuardado()
      }
    } catch (err) {
      setError(err.message ?? 'Error subiendo la imagen')
    } finally {
      setGuardando(false)
    }
  }

  return (
    <Modal titulo={form.id ? 'Editar artículo' : 'Nuevo artículo'} onCerrar={onCerrar}>
      <form onSubmit={guardar} className="space-y-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <Campo etiqueta="Categoría" ayuda="Elegí la sección del producto.">
            <select required className={estiloInput} {...campo('categoria')}>
              {CATEGORIAS.map((categoria) => (
                <option key={categoria} value={categoria}>
                  {categoria}
                </option>
              ))}
            </select>
          </Campo>
          <Campo etiqueta="Marca">
            <input required className={estiloInput} placeholder="Pirelli" {...campo('marca')} />
          </Campo>
          <Campo etiqueta="Medida">
            <input required className={estiloInput} placeholder="205/55 R16" {...campo('medida')} />
          </Campo>
          <Campo etiqueta="Código" ayuda="Opcional, interno o del proveedor">
            <input className={estiloInput} {...campo('codigo')} />
          </Campo>
          <Campo etiqueta="Descripción" ayuda="Opcional, para más detalle del producto">
            <input className={estiloInput} {...campo('descripcion')} />
          </Campo>
          <Campo etiqueta="Imagen" ayuda="Opcional. Subí una foto desde tu equipo.">
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
          <Campo etiqueta="Stock">
            <input type="number" min="0" className={estiloInput} {...campo('stock')} />
          </Campo>
          <Campo etiqueta="Precio de venta">
            <input type="number" min="0" step="0.01" className={estiloInput} {...campo('precio')} />
          </Campo>
          <Campo etiqueta="Costo">
            <input type="number" min="0" step="0.01" className={estiloInput} {...campo('costo')} />
          </Campo>
          <Campo etiqueta="Stock mínimo" ayuda="Debajo de este número avisa el panel">
            <input type="number" min="0" className={estiloInput} {...campo('stock_minimo')} />
          </Campo>
        </div>

        {imagenPreview && (
          <div className="rounded-xl border border-concreto-200 p-4">
            <p className="mb-2 text-sm font-medium text-caucho-800">Vista previa</p>
            <img src={imagenPreview} alt="" className="h-40 w-full rounded-xl object-cover" />
          </div>
        )}

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
