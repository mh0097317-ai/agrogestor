-- Mensagem de retorno para quem sumiu: desligada por padrão, o dono liga.
-- O cliente que responde PARAR não recebe mais. Só o servidor lê e grava.
alter table public.business_settings
  add column winback_enabled boolean not null default false,
  add column winback_days integer not null default 35
    check (winback_days between 20 and 120);

create table public.customer_winbacks (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  phone text not null,
  kind text not null check (kind in ('sent', 'optout')),
  created_at timestamptz not null default now()
);
create index customer_winbacks_lookup
  on public.customer_winbacks(business_id, phone, created_at desc);
alter table public.customer_winbacks enable row level security;
revoke all on public.customer_winbacks from anon, authenticated;
