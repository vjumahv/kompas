-- Kompas: tabla única tipo key-value que reemplaza el window.storage del prototipo.
-- Ejecuta esto en el SQL editor de tu proyecto Supabase (Database > SQL Editor).

create table if not exists kv_store (
  key text primary key,
  value jsonb not null,
  updated_at timestamptz not null default now()
);

alter table kv_store enable row level security;

-- La app no usa Supabase Auth (login simple nombre+PIN hasheado en el cliente),
-- así que no hay una identidad de servidor contra la cual filtrar filas.
-- Estas políticas dejan la tabla abierta a la anon key, igual que el prototipo
-- original (window.storage con shared:true) no tenía ningún control de acceso.
-- Los PIN se guardan hasheados (SHA-256), nunca en texto plano.
create policy "kv_store anon select" on kv_store
  for select to anon using (true);

create policy "kv_store anon insert" on kv_store
  for insert to anon with check (true);

create policy "kv_store anon update" on kv_store
  for update to anon using (true) with check (true);
