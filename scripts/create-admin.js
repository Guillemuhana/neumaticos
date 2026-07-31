import dotenv from 'dotenv'

dotenv.config()

const url = process.env.SUPABASE_URL?.replace(/\/$/, '')
const serviceRole = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!url || !serviceRole) {
  console.error('Faltan las variables SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY en el entorno.')
  process.exit(1)
}

const adminBase = `${url}/auth/v1/admin`
const restBase = `${url}/rest/v1`
const headers = {
  apikey: serviceRole,
  Authorization: `Bearer ${serviceRole}`,
  'Content-Type': 'application/json'
}

async function fetchJson(path, options = {}, base = adminBase) {
  const res = await fetch(`${base}${path}`, { headers, ...options })
  const body = await res.json().catch(() => null)
  if (!res.ok) {
    throw new Error(body?.msg || body?.message || `${res.status} ${res.statusText}`)
  }
  return body
}

async function ensurePerfil(userId, nombre, rol) {
  const existing = await fetchJson(
    `/perfiles?select=id,nombre,rol&id=eq.${encodeURIComponent(userId)}`,
    {},
    restBase
  )
  const perfil = Array.isArray(existing) && existing[0]

  if (perfil) {
    const updates = {}
    if (perfil.nombre !== nombre) updates.nombre = nombre
    if (perfil.rol !== rol) updates.rol = rol
    if (Object.keys(updates).length > 0) {
      await fetchJson(
        `/perfiles?id=eq.${encodeURIComponent(userId)}`,
        {
          method: 'PATCH',
          body: JSON.stringify(updates)
        },
        restBase
      )
    }
    return
  }

  await fetchJson(
    '/perfiles',
    {
      method: 'POST',
      body: JSON.stringify({ id: userId, nombre, rol, activo: true })
    },
    restBase
  )
}

async function crearAdmin() {
  const email = process.env.ADMIN_EMAIL
  const password = process.env.ADMIN_PASSWORD
  const nombre = process.env.ADMIN_NOMBRE || 'Administrador'
  const role = 'gerencia'

  if (!email || !password) {
    console.error('Faltan ADMIN_EMAIL o ADMIN_PASSWORD en el entorno.')
    process.exit(1)
  }

  const existing = await fetchJson(`/users?email=${encodeURIComponent(email)}`)
  const user = Array.isArray(existing) && existing[0]

  if (user) {
    console.log('El usuario ya existe. Actualizando contraseña, metadata y perfil...')
    await fetchJson(`/users/${user.id}`, {
      method: 'PUT',
      body: JSON.stringify({
        password,
        email,
        user_metadata: { nombre, rol: role }
      })
    })
    await ensurePerfil(user.id, nombre, role)
    console.log('Usuario admin actualizado correctamente:', email)
    return
  }

  const created = await fetchJson('/users', {
    method: 'POST',
    body: JSON.stringify({
      email,
      password,
      email_confirm: true,
      user_metadata: { nombre, rol: role }
    })
  })

  await ensurePerfil(created.id, nombre, role)
  console.log('Usuario admin creado correctamente:', email)
}

crearAdmin().catch((err) => {
  console.error('Error inesperado:', err.message || err)
  process.exit(1)
})
