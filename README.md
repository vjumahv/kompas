# Kompas

Comunidad para empezar a crear contenido. React + Vite, datos en Supabase.

## Setup local

1. `npm install`
2. Copia `.env.example` a `.env` y pon tu `VITE_SUPABASE_URL` y `VITE_SUPABASE_ANON_KEY` (Supabase dashboard → Settings → API).
3. En el SQL Editor de Supabase, corre [`supabase/schema.sql`](supabase/schema.sql) para crear la tabla `kv_store`.
4. `npm run dev`

## Deploy

Conecta el repo en [vercel.com](https://vercel.com/new), y define las mismas dos variables de entorno (`VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`) en Project Settings → Environment Variables.

## Notas

- Login simple con nombre + PIN de 4 dígitos (se guarda hasheado, no en texto plano).
- La tabla `kv_store` no usa Supabase Auth, así que las políticas RLS quedan abiertas a la anon key (igual de "confiado en el cliente" que el prototipo original). No guardes ahí nada más sensible que el PIN hasheado.
