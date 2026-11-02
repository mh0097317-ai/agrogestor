-- Captação: barbearias que podem virar clientes da StudioFlow.
-- Achadas no Google Maps (ou OpenStreetMap), investigadas pelo site,
-- com nota e motivo. A mensagem sai pelo WhatsApp de quem está no /admin,
-- com um toque: nada é disparado sozinho. Só o servidor lê estas tabelas.

create table public.platform_leads (
  id uuid primary key default gen_random_uuid(),
  place_id text unique,
  name text not null check (length(name) between 1 and 200),
  phone text not null default '' check (phone ~ '^[0-9]{0,15}$'),
  website text not null default '' check (length(website) <= 500),
  instagram text not null default '' check (length(instagram) <= 100),
  address text not null default '' check (length(address) <= 300),
  city text not null default '' check (length(city) <= 120),
  category text not null default '' check (length(category) <= 120),
  rating numeric(2, 1) check (rating between 0 and 5),
  reviews integer check (reviews >= 0),
  maps_url text not null default '' check (length(maps_url) <= 500),
  source text not null default 'google_maps' check (source in ('google_maps', 'openstreetmap', 'manual')),
  signals jsonb not null default '{}',
  score integer not null default 0 check (score between 0 and 100),
  reasons text[] not null default '{}',
  status text not null default 'new'
    check (status in ('new', 'contacted', 'replied', 'demo', 'trial', 'customer', 'lost', 'opted_out')),
  message text not null default '' check (length(message) <= 1200),
  notes text not null default '' check (length(notes) <= 2000),
  contacted_at timestamptz,
  follow_up_at timestamptz,
  profiled_at timestamptz,
  business_id uuid references public.businesses(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index platform_leads_status_idx on public.platform_leads(status, score desc);
create index platform_leads_phone_idx on public.platform_leads(phone) where phone <> '';
create index platform_leads_follow_up_idx on public.platform_leads(follow_up_at) where follow_up_at is not null;
create trigger updated_at before update on public.platform_leads
  for each row execute function private.touch_updated_at();

create table public.platform_lead_events (
  id uuid primary key default gen_random_uuid(),
  lead_id uuid not null references public.platform_leads(id) on delete cascade,
  kind text not null check (kind in ('found', 'profiled', 'drafted', 'contacted', 'status', 'note')),
  detail jsonb not null default '{}',
  actor uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);
create index platform_lead_events_lead_idx on public.platform_lead_events(lead_id, created_at desc);

create table public.platform_lead_settings (
  id text primary key default 'default' check (id = 'default'),
  serper_key_enc text,
  serper_hint text not null default '' check (length(serper_hint) <= 4),
  sender_name text not null default '' check (length(sender_name) <= 60),
  searches integer not null default 0,
  updated_by uuid references auth.users(id) on delete set null,
  updated_at timestamptz not null default now()
);
insert into public.platform_lead_settings (id) values ('default') on conflict do nothing;

do $$ declare table_name text; begin
  foreach table_name in array array['platform_leads', 'platform_lead_events', 'platform_lead_settings'] loop
    execute format('alter table public.%I enable row level security', table_name);
    execute format('revoke all on public.%I from anon, authenticated', table_name);
    execute format('grant all on public.%I to service_role', table_name);
  end loop;
end; $$;
