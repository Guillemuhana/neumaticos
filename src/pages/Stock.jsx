import { useMemo, useState } from 'react'
import { Boxes, Plus, Search } from 'lucide-react'
import { useAuth } from '../context/AuthProvider'
import { useConsulta } from '../hooks/useConsulta'
import { supabase } from '../lib/supabase'
import { plata } from '../lib/formato'
import {
  Aviso,
  Boton,
  Campo,
  Cargando,
  Encabezado,
  Etiqueta,
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

export default function Stock() {
  const { puede } = useAuth()
  const [busqueda, setBusqueda] = useState('')
  const [editando, setEditando] = useState(null)

  const { datos, cargando, error, recargar } = useConsulta(
    () => supabase.from('productos').select('*').eq('activo', true).order('categoria').order('marca'),
    []
  )

  const filtrados = useMemo(() => {
    if (!datos) return []
    const q = busqueda.trim().toLowerCase()
    if (!q) return datos
    return datos.filter((p) => {
      const texto = [
        p.categoria || '',
        p.marca,
        p.medida,
        p.codigo || '',
        p.descripcion || '',
        p.precio != null ? String(p.precio) : '',
        p.costo != null ? String(p.costo) : '',
        p.stock != null ? String(p.stock) : '',
        p.stock_minimo != null ? String(p.stock_minimo) : '',
      ]
        .join(' ')
        .toLowerCase()
      return texto.includes(q)
    })
  }, [datos, busqueda])

  const productosPorCategoria = useMemo(() => {
    if (!filtrados) return {}
    return filtrados.reduce((acc, p) => {
      const categoria = p.categoria || 'Otro repuesto'
      if (!acc[categoria]) acc[categoria] = []
      acc[categoria].push(p)
      return acc
    }, {})
  }, [filtrados])

  const gestiona = puede('gerencia')

  return (
    <>
      <Encabezado
        titulo="Stock"
        detalle="Neumáticos, amortiguadores, filtros, pastillas y repuestos profesionales."
      >
        {gestiona && (
          <Boton onClick={() => setEditando(vacio)}>
            <Plus size={16} /> Nuevo artículo
          </Boton>
        )}
      </Encabezado>

      <div className="relative mb-4">
        <Search
          size={16}
          className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-acero-500"
          aria-hidden="true"
        />
        <input
          className={`${estiloInput} pl-9`}
          placeholder="Buscar por categoría, marca, medida, precio o código…"
          value={busqueda}
          onChange={(e) => setBusqueda(e.target.value)}
        />
      </div>

      {error && <Aviso>{error}</Aviso>}

      {cargando ? (
        <Tarjeta>
          <Cargando texto="Leyendo inventario…" alto="min-h-[40vh]" />
        </Tarjeta>
      ) : filtrados.length === 0 ? (
        <Tarjeta>
          <Vacio
            icono={Boxes}
            titulo="No hay artículos"
            detalle={busqueda ? 'Probá con otra búsqueda.' : 'Cargá el primer artículo del inventario.'}
          />
        </Tarjeta>
      ) : (
        Object.keys(productosPorCategoria)
          .sort((a, b) => {
            const indexA = CATEGORIAS.indexOf(a)
            const indexB = CATEGORIAS.indexOf(b)
            if (indexA === -1 && indexB === -1) return a.localeCompare(b)
            if (indexA === -1) return 1
            if (indexB === -1) return -1
            return indexA - indexB
          })
          .map((categoria) => (
            <Tarjeta key={categoria} className="mb-4">
              <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="text-sm font-semibold uppercase tracking-[0.18em] text-acero-500">{categoria}</p>
                  <p className="mt-1 text-sm text-acero-500">{productosPorCategoria[categoria].length} artículo(s)</p>
                </div>
              </div>
              <Tabla columnas={['Artículo', 'Medida', 'Precio', 'Stock', ...(gestiona ? [''] : [])]}>
                {productosPorCategoria[categoria].map((p) => {
                  const critico = p.stock <= p.stock_minimo
                  return (
                    <tr
                      key={p.id}
                      className="hover:bg-concreto-50 rounded-xl bg-white shadow-sm sm:bg-transparent sm:shadow-none"
                    >
                      <td data-label="Artículo" className="px-4 py-3">
                        <div className="flex items-center gap-3">
                          {p.imagen_url ? (
                            <img
                              src={p.imagen_url}
                              alt={p.marca}
                              className="h-16 w-16 rounded-xl object-cover border border-concreto-200"
                            />
                          ) : (
                            <div className="flex h-16 w-16 items-center justify-center rounded-xl border border-concreto-200 bg-concreto-50 text-xs uppercase text-acero-500">
                              Sin foto
                            </div>
                          )}
                          <div>
                            <p className="font-medium">{p.marca}</p>
                            <p className="text-sm text-acero-500">{p.descripcion || 'Repuesto profesional'}</p>
                            {p.codigo && <p className="font-mono text-xs text-acero-500">{p.codigo}</p>}
                          </div>
                        </div>
                      </td>
                      <td data-label="Medida" className="px-4 py-3 font-mono">
                        {p.medida}
                      </td>
                      <td data-label="Precio" className="px-4 py-3 tabular-nums">
                        {plata(p.precio)}
                      </td>
                      <td data-label="Stock" className="px-4 py-3">
                        <span className="mr-2 font-mono font-semibold tabular-nums">{p.stock}</span>
                        {critico && <Etiqueta tono="atencion">reponer</Etiqueta>}
                      </td>
                      {gestiona && (
                        <td data-label="Acciones" className="px-4 py-3 text-right">
                          <Boton variante="fantasma" className="px-2 py-1" onClick={() => setEditando(p)}>
                            Editar
                          </Boton>
                        </td>
                      )}
                    </tr>
                  )
                })}
              </Tabla>
            </Tarjeta>
          ))
      )}

      {editando && (
        <FormularioProducto
          producto={editando}
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

function FormularioProducto({ producto, onCerrar, onGuardado }) {
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

    const nombre = `productos/${Date.now()}_${imagenFile.name}`
    const { error: uploadError } = await supabase.storage
      .from('productos')
      .upload(nombre, imagenFile, { cacheControl: '3600', upsert: true })

    if (uploadError) throw uploadError

    const { data: urlData, error: urlError } = await supabase.storage
      .from('productos')
      .getPublicUrl(nombre)

    if (urlError) throw urlError
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

    if (!form.id && !imagenFile) {
      setError('Subí una imagen antes de guardar el producto.')
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
        setGuardando(false)
      } else onGuardado()
    } catch (err) {
      setError(err.message ?? 'Error subiendo la imagen')
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
          <Campo etiqueta="Imagen" ayuda="Subí una foto desde tu equipo. Solo se acepta carga de archivo.">
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
