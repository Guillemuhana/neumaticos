# Gestión Pérez

Sistema de gestión para Neumáticos y Servicios Pérez: stock, ventas, órdenes de
taller y personal.

Stack: React 19 + Vite, React Router, Tailwind CSS v4 y Supabase (auth).

## Puesta en marcha

```bash
npm install
cp .env.example .env   # completar con el proyecto de Supabase
# Agregar también estas variables para crear el usuario admin:
# VITE_SUPABASE_URL=https://<project>.supabase.co
# VITE_SUPABASE_ANON_KEY=<anon-key>                 # clave anon real necesaria para login
# SUPABASE_URL=https://<project>.supabase.co
# SUPABASE_SERVICE_ROLE_KEY=<service-role-key>
# ADMIN_EMAIL=admin@dominio.com
# ADMIN_PASSWORD=ContraseñaSegura123
# ADMIN_NOMBRE=Administrador
npm run create-admin
npm run dev
```

Las credenciales salen de Supabase → Project Settings → API (`Project URL` y la
clave `anon`).

## Estructura

```
src/
  main.jsx              punto de entrada, monta router y AuthProvider
  App.jsx               rutas y guardia de sesión
  index.css             tokens de marca (Tailwind v4, @theme)
  lib/supabase.js       cliente de Supabase
  context/AuthProvider  sesión, iniciarSesion, cerrarSesion
  components/UI.jsx     Boton, Campo, Aviso, Cargando, estiloInput
  pages/                Login, Inicio
```

## Pendiente

- `public/logo-perez.png` (el logo referenciado por Login e Inicio)
- Los módulos de stock, ventas, taller y personal: hoy son tarjetas sin destino
