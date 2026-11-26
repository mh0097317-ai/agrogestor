-- CRM: aniversário e consentimento de mensagens de marketing (LGPD).
-- Consentimento nasce falso; muda só pelo servidor e cada mudança vira
-- evento (quem, quando, por onde) para servir de prova.
alter table public.customers
  add column if not exists birth_date date
    check (birth_date is null or (birth_date >= date '1900-01-01' and birth_date <= current_date)),
  add column if not exists marketing_consent boolean not null default false,
  add column if not exists consent_updated_at timestamptz;

create table if not exists public.customer_consent_events (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  customer_id uuid not null references public.customers(id) on delete cascade,
  consent boolean not null,
  source text not null check (source in ('painel','cliente_pediu','agendamento','whatsapp_sair')),
  actor uuid,
  note text check (note is null or char_length(note) <= 200),
  created_at timestamptz not null default now()
);
create index if not exists customer_consent_events_customer
  on public.customer_consent_events (business_id, customer_id, created_at desc);
alter table public.customer_consent_events enable row level security;
revoke all on public.customer_consent_events from anon, authenticated;
grant all on public.customer_consent_events to service_role;
