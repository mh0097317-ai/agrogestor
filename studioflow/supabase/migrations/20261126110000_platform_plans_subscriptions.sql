-- Planos do StudioFlow configuráveis (preço sai do código e vai para o
-- banco) e pedidos do dono para mudar de plano ou cancelar. Valores nascem
-- vazios: a página de preços mostra "sob consulta" até a equipe definir.
-- Separado de tudo que é dinheiro das barbearias (payments, memberships).
create table public.platform_plans (
  key text primary key check (key ~ '^[a-z0-9-]{2,30}$'),
  name text not null check (length(name) between 2 and 40),
  tagline text not null default '' check (length(tagline) <= 160),
  monthly_cents integer check (monthly_cents is null or monthly_cents between 0 and 10000000),
  annual_cents integer check (annual_cents is null or annual_cents between 0 and 100000000),
  modules text[] not null default '{}',
  highlight boolean not null default false,
  active boolean not null default true,
  sort integer not null default 0,
  updated_at timestamptz not null default now(),
  updated_by uuid
);
alter table public.platform_plans enable row level security;
revoke all on table public.platform_plans from public, anon, authenticated;
grant all on table public.platform_plans to service_role;
-- A vitrine de preços é pública: só planos ativos e só as colunas de venda.
grant select (key, name, tagline, monthly_cents, annual_cents, modules, highlight, sort)
  on table public.platform_plans to anon, authenticated;
create policy platform_plans_public_read on public.platform_plans
  for select to anon, authenticated using (active);

insert into public.platform_plans (key, name, tagline, modules, highlight, sort) values
  ('essencial', 'Essencial', 'Agenda online, página da casa e gestão do dia a dia.', array['fidelidade','espera'], false, 1),
  ('profissional', 'Profissional', 'Sinal no Pix, clube, produtos, check-in e Modo TV.', array['fidelidade','espera','pagamentos','clube','produtos','recepcao'], true, 2),
  ('premium', 'Premium', 'Tudo, com a recepcionista que agenda no WhatsApp.', array['fidelidade','espera','pagamentos','clube','produtos','recepcao','recepcionista'], false, 3)
on conflict (key) do nothing;

create table public.platform_subscription_requests (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  kind text not null check (kind in ('change_plan', 'cancel')),
  to_plan text references public.platform_plans(key),
  reason text not null default '' check (length(reason) <= 500),
  status text not null default 'pending' check (status in ('pending', 'done', 'rejected', 'withdrawn')),
  requested_by uuid,
  resolved_by uuid,
  resolution_note text not null default '' check (length(resolution_note) <= 500),
  created_at timestamptz not null default now(),
  resolved_at timestamptz,
  check ((kind = 'change_plan') = (to_plan is not null))
);
-- Um pedido aberto por vez por casa.
create unique index platform_subscription_requests_one_open
  on public.platform_subscription_requests (business_id) where status = 'pending';
create index platform_subscription_requests_status on public.platform_subscription_requests (status, created_at desc);
alter table public.platform_subscription_requests enable row level security;
revoke all on table public.platform_subscription_requests from public, anon, authenticated;
grant all on table public.platform_subscription_requests to service_role;
