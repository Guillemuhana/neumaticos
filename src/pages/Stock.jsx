import { useMemo, useState } from 'react'
import { AlertTriangle, Boxes, ImageOff, Package, Plus, Search, Wallet, X } from 'lucide-react'
import { useAuth } from '../context/AuthProvider'
import { useConsulta } from '../hooks/useConsulta'
import { supabase } from '../lib/supabase'
import { numero, plata } from '../lib/formato'
import {
  Aviso,
  Boton,
  Campo,
  Cargando,
  Encabezado,
  Etiqueta,
  Metrica,
  Modal,
  Tabla,
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

  const filtrados = useMemo(
    () => (categoria === 'todas' ? porTexto : porTexto.filter((p) => (p.categoria || 'Otro repuesto') === categoria)),
    [porTexto, categoria]
  )

  const grupos = useMemo(() => {
    const mapa = new Map()
    filtrados.forEach((p) => {
      const c = p.categoria || 'Otro repuesto'
      if (!mapa.has(c)) mapa.set(c, [])
      mapa.get(c).push(p)
    })
    return [...mapa.entries()].sort((a, b) => ordenCategoria(a[0], b[0]))
  }, [filtrados])

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
  const hayFiltro = busqueda.trim() !== '' || categoria !== 'todas'

  const limpiar = () => {
    setBusqueda('')
    setCategoria('todas')
  }

  return (
    <>
      <Encabezado titulo="Stock" detalle="Neumáticos, filtros, pastillas y repuestos del local.">
        {gestiona && (
          <Boton onClick={() => setEditando(vacio)}>
            <Plus size={16} /> Nuevo artículo
          </Boton>
        )}
      </Encabezado>

      <div className="cascada mb-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Metrica icono={Package} titulo="Artículos" valor={numero(resumen.articulos)} pie="Activos en el catálogo" />
        <Metrica icono={Boxes} titulo="Unidades" valor={numero(resumen.unidades)} pie="Suma de todo el stock" />
        <Metrica icono={Wallet} tono="marca" titulo="Valor a costo" valor={plata(resumen.valor)} pie="Capital inmovilizado" />
        <Metrica
          icono={AlertTriangle}
          tono={resumen.criticos ? 'atencion' : 'conforme'}
          titulo="Para reponer"
          valor={numero(resumen.criticos)}
          pie="En el mínimo o debajo"
        />
      </div>

      {/* Buscador y categorías en una sola barra: los chips ocupan una línea
          en vez de una columna de 280px llena de ceros. */}
      <Tarjeta className="mb-6 p-4">
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

        <div className="mt-3 flex flex-wrap gap-2">
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

      {cargando ? (
        <Tarjeta>
          <Cargando texto="Leyendo inventario…" alto="min-h-[40vh]" />
        </Tarjeta>
      ) : grupos.length === 0 ? (
        <Tarjeta>
          <Vacio
            icono={Boxes}
            titulo="No hay artículos"
            detalle={hayFiltro ? 'Probá con otra búsqueda o quitá los filtros.' : 'Cargá el primer artículo del inventario.'}
          />
        </Tarjeta>
      ) : (
        <div className="space-y-5">
          {grupos.map(([nombre, items]) => (
            <section key={nombre}>
              {/* Encabezado discreto: el conteo va una sola vez, al lado del
                  nombre, en vez de repetirse en un badge gigante. */}
              <div className="mb-2 flex items-baseline gap-2 px-1">
                <h2 className="display font-bold text-caucho-900">{nombre}</h2>
                <span className="font-mono text-xs text-acero-400">{numero(items.length)}</span>
              </div>

              <Tarjeta>
                <Tabla columnas={['Artículo', 'Medida', 'Precio', 'Stock', ...(gestiona ? [''] : [])]}>
                  {items.map((p) => {
                    const critico = p.stock <= p.stock_minimo
                    return (
                      <tr key={p.id} className="transition-colors hover:bg-concreto-50">
                        <td data-label="Artículo" className="px-4 py-3">
                          <div className="flex items-center gap-3">
                            {p.imagen_url ? (
                              <img
                                src={p.imagen_url}
                                alt=""
                                className="h-11 w-11 shrink-0 rounded-lg border border-concreto-200 object-cover"
                              />
                            ) : (
                              <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg border border-concreto-200 bg-concreto-50 text-acero-300">
                                <ImageOff size={16} aria-hidden="true" />
                              </span>
                            )}
                            <div className="min-w-0">
                              <p className="truncate font-semibold text-caucho-900">{p.marca}</p>
                              {p.descripcion && (
                                <p className="truncate text-sm text-acero-500">{p.descripcion}</p>
                              )}
                              {p.codigo && <p className="font-mono text-xs text-acero-400">{p.codigo}</p>}
                            </div>
                          </div>
                        </td>
                        <td data-label="Medida" className="px-4 py-3 font-mono text-caucho-700">
                          {p.medida}
                        </td>
                        <td data-label="Precio" className="px-4 py-3 font-semibold tabular-nums">
                          {plata(p.precio)}
                        </td>
                        <td data-label="Stock" className="px-4 py-3">
                          {/* Solo se etiqueta lo que necesita acción: un "OK" en
                              cada fila es ruido y esconde lo que sí importa. */}
                          <div className="flex items-center gap-2">
                            <span
                              className={`font-mono font-semibold tabular-nums ${
                                critico ? 'text-atencion-700' : 'text-caucho-900'
                              }`}
                            >
                              {p.stock}
                            </span>
                            {critico && <Etiqueta tono="atencion">reponer</Etiqueta>}
                          </div>
                        </td>
                        {gestiona && (
                          <td data-label="Acciones" className="px-4 py-3 text-right">
                            <Boton variante="fantasma" className="px-3 py-1.5" onClick={() => setEditando(p)}>
                              Editar
                            </Boton>
                          </td>
                        )}
                      </tr>
                    )
                  })}
                </Tabla>
              </Tarjeta>
            </section>
          ))}
        </div>
      )}

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
      className={`inline-flex items-center gap-2 rounded-full border px-3.5 py-1.5 text-sm font-medium transition-all duration-200 ${
        activo
          ? 'border-perez-600 bg-perez-600 text-white shadow-sm shadow-perez-900/20'
          : 'border-concreto-200 bg-white text-caucho-700 hover:border-acero-300 hover:bg-concreto-50'
      }`}
    >
      {children}
      <span
        className={`rounded-full px-1.5 py-0.5 text-xs font-semibold tabular-nums ${
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

    /* Mismo caso que en Personal: sin el bucket creado, Supabase solo dice
       "Bucket not found". Ver supabase/storage.sql. */
    if (errorSubida) {
      if (errorSubida.message?.toLowerCase().includes('bucket not found')) {
        throw new Error(
          'Falta el bucket «productos» en Supabase Storage. Corré supabase/storage.sql en el SQL Editor.'
        )
      }
      throw errorSubida
    }

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
