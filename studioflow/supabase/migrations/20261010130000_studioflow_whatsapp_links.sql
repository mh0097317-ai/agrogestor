-- WhatsApp da loja conectado por QR Code (Evolution API do StudioFlow).
-- Só o servidor lê: o nome da instância e o hash do token do webhook.

create table public.whatsapp_links (
  business_id uuid primary key,
  tenant_id uuid not null,
  instance text not null unique check (instance ~ '^sf-[a-z0-9-]{8,60}$'),
  status text not null default 'connecting' check (status in ('connecting', 'open', 'close')),
  phone text not null default '' check (phone ~ '^[0-9]{0,15}$'),
  profile_name text not null default '' check (length(profile_name) <= 120),
  webhook_token_hash bytea not null,
  connected_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (tenant_id, business_id) references public.businesses(tenant_id, id) on delete cascade
);
alter table public.whatsapp_links enable row level security;
create trigger updated_at before update on public.whatsapp_links for each row execute function private.touch_updated_at();
create trigger immutable_scope before update on public.whatsapp_links for each row execute function private.preserve_scope();
revoke all on public.whatsapp_links from anon, authenticated;
grant all on public.whatsapp_links to service_role;

-- Avisos no WhatsApp: ao profissional quando entra um agendamento.
alter table public.business_settings
  add column notify_professionals boolean not null default true;
