import dotenv from 'dotenv'

dotenv.config()

const url = process.env.SUPABASE_URL?.replace(/\/$/, '')
const serviceRole = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!url || !serviceRole) {
  console.error('Faltan las variables SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY en el entorno.')
  process.exit(1)
}

const adminBase = `${url}/auth/v1/admin`
const headers = {
  apikey: serviceRole,
  Authorization: `Bearer ${serviceRole}`,
  'Content-Type': 'application/json'
}

async function fetchJson(path, options = {}) {
  const res = await fetch(`${adminBase}${path}`, { headers, ...options })
  const body = await res.json().catch(() => null)
  if (!res.ok) {
    throw new Error(body?.msg || body?.message || `${res.status} ${res.statusText}`)
  }
  return body
}

async function crearAdmin() {
  const email = process.env.ADMIN_EMAIL
  const password = process.env.ADMIN_PASSWORD
  const nombre = process.env.ADMIN_NOMBRE || 'Administrador'

  if (!email || !password) {
    console.error('Faltan ADMIN_EMAIL o ADMIN_PASSWORD en el entorno.')
    process.exit(1)
  }

  const existing = await fetchJson(`/users?email=${encodeURIComponent(email)}`)
  const user = Array.isArray(existing) && existing[0]

  if (user) {
    console.log('El usuario ya existe. Actualizando contraseña y metadata...')
    await fetchJson(`/users/${user.id}`, {
      method: 'PUT',
      body: JSON.stringify({
        password,
        email,
        user_metadata: { nombre, rol: 'gerencia' }
      })
    })
    console.log('Usuario admin actualizado correctamente:', email)
    return
  }

  await fetchJson('/users', {
    method: 'POST',
    body: JSON.stringify({
      email,
      password,
      email_confirm: true,
      user_metadata: { nombre, rol: 'gerencia' }
    })
  })

  console.log('Usuario admin creado correctamente:', email)
}

crearAdmin().catch((err) => {
  console.error('Error inesperado:', err.message || err)
  process.exit(1)
})
