import dotenv from 'dotenv'

dotenv.config()

const url = process.env.VITE_SUPABASE_URL
const anonKey = process.env.VITE_SUPABASE_ANON_KEY
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY
const email = process.env.ADMIN_EMAIL
const password = process.env.ADMIN_PASSWORD

console.log('VITE_SUPABASE_URL=', url)
console.log('VITE_SUPABASE_ANON_KEY length=', anonKey?.length)
console.log('SUPABASE_URL=', process.env.SUPABASE_URL)
console.log('SERVICE_ROLE_KEY length=', serviceRoleKey?.length)
console.log('ADMIN_EMAIL=', email)
console.log('ADMIN_PASSWORD length=', password?.length)

if (!url || !anonKey) {
  console.error('Faltan VITE_SUPABASE_URL o VITE_SUPABASE_ANON_KEY')
  process.exit(1)
}

const login = async () => {
  const params = new URLSearchParams({ grant_type: 'password', email, password })
  const res = await fetch(`${url}/auth/v1/token`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      apikey: anonKey,
      Authorization: `Bearer ${anonKey}`,
    },
    body: params,
  })
  const text = await res.text()
  console.log('LOGIN status:', res.status)
  console.log('LOGIN body:', text)
}

const lookup = async () => {
  if (!serviceRoleKey) {
    console.log('No service role key available for lookup')
    return
  }
  const res = await fetch(`${url}/auth/v1/admin/users?email=${encodeURIComponent(email)}`, {
    method: 'GET',
    headers: {
      apikey: serviceRoleKey,
      Authorization: `Bearer ${serviceRoleKey}`,
      'Content-Type': 'application/json',
    },
  })
  console.log('LOOKUP status:', res.status)
  console.log('LOOKUP body:', await res.text())
}

await login()
await lookup()
