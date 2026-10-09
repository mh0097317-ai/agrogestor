-- Auditoria por estabelecimento: ações do painel e visitas/cliques da página.
-- Só o servidor grava e lê (a equipe StudioFlow vê no /admin).
create table public.activity_log (
  id bigint generated always as identity primary key,
  business_id uuid not null references public.businesses(id) on delete cascade,
  actor_id uuid,
  actor text not null default '' check (length(actor) <= 120),
  source text not null check (source in ('painel', 'cliente', 'recepcionista', 'sistema', 'plataforma')),
  action text not null check (length(action) between 1 and 60),
  detail text not null default '' check (length(detail) <= 400),
  created_at timestamptz not null default now()
);
create index activity_log_business_idx on public.activity_log(business_id, created_at desc);
alter table public.activity_log enable row level security;
grant all on public.activity_log to service_role;

create table public.page_events (
  id bigint generated always as identity primary key,
  business_id uuid not null references public.businesses(id) on delete cascade,
  visitor text not null check (length(visitor) between 8 and 64),
  kind text not null check (kind in ('view', 'agendar', 'whatsapp', 'instagram', 'localizacao', 'compartilhar', 'chat', 'clube', 'etapa', 'agendou')),
  detail text not null default '' check (length(detail) <= 60),
  device text not null default '' check (device in ('', 'celular', 'computador', 'tablet')),
  referrer text not null default '' check (length(referrer) <= 80),
  created_at timestamptz not null default now()
);
create index page_events_business_idx on public.page_events(business_id, created_at desc);
alter table public.page_events enable row level security;
grant all on public.page_events to service_role;
