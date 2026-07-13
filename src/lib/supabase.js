import { createClient } from "@supabase/supabase-js";

const url = import.meta.env.VITE_SUPABASE_URL;
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

export const supabaseConfigured = Boolean(url && anonKey);

if (!supabaseConfigured) {
  console.error(
    "Faltan VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY. Configúralas en .env (local) o en las variables de entorno de Vercel."
  );
}

// Evita que createClient lance una excepción al cargar el módulo cuando
// faltan las variables de entorno; en ese caso la app muestra una pantalla
// de aviso en lugar de una página en blanco (ver App.jsx).
export const supabase = supabaseConfigured
  ? createClient(url, anonKey)
  : createClient("https://placeholder.supabase.co", "placeholder-anon-key");
