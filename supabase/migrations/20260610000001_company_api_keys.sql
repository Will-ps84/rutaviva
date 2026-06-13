-- Tabla para API keys de integración externa por empresa
-- Las claves se almacenan como hash SHA-256 (nunca en texto plano)

create table if not exists public.company_api_keys (
  id            uuid primary key default gen_random_uuid(),
  company_id    uuid not null references public.companies(id) on delete cascade,
  name          text not null,                     -- ej: "Integración Shopify"
  key_hash      text not null unique,              -- SHA-256 de la clave real
  key_prefix    text not null,                     -- primeros 8 chars para identificación: "rv_live_"
  is_active     boolean not null default true,
  request_count integer not null default 0,
  last_used_at  timestamptz,
  created_by    uuid references auth.users(id),
  created_at    timestamptz not null default now(),
  expires_at    timestamptz                        -- null = nunca vence
);

-- RLS: solo admins/owners ven las keys de su empresa
alter table public.company_api_keys enable row level security;

create policy "company_api_keys_select"
  on public.company_api_keys for select
  using (
    company_id = public.get_user_company_id()
    and public.has_role(auth.uid(), 'admin')
  );

create policy "company_api_keys_insert"
  on public.company_api_keys for insert
  with check (
    company_id = public.get_user_company_id()
    and public.has_role(auth.uid(), 'admin')
  );

create policy "company_api_keys_update"
  on public.company_api_keys for update
  using (
    company_id = public.get_user_company_id()
    and public.has_role(auth.uid(), 'admin')
  );

create policy "company_api_keys_delete"
  on public.company_api_keys for delete
  using (
    company_id = public.get_user_company_id()
    and public.has_role(auth.uid(), 'owner')
  );

-- Tabla de logs de notificaciones (referenciada desde send-notification)
create table if not exists public.notification_logs (
  id              uuid primary key default gen_random_uuid(),
  event           text not null,
  recipient_phone text not null,
  channel         text not null default 'whatsapp',
  success         boolean not null,
  twilio_sid      text,
  error_message   text,
  message_body    text,
  created_at      timestamptz not null default now()
);

-- Sin RLS en logs por ahora (solo accesible desde service role en Edge Functions)
alter table public.notification_logs enable row level security;

-- Índices
create index if not exists company_api_keys_company_id_idx on public.company_api_keys(company_id);
create index if not exists company_api_keys_key_hash_idx on public.company_api_keys(key_hash);
create index if not exists notification_logs_created_at_idx on public.notification_logs(created_at desc);
