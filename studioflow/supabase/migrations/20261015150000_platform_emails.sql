-- E-mails da StudioFlow para os donos (Resend), controlados no /admin → E-mails.
create table public.platform_email_settings (
  id boolean primary key default true check (id),
  enabled boolean not null default true,
  billing boolean not null default true,
  onboarding boolean not null default true,
  weekly boolean not null default true,
  reply_to text not null default '' check (reply_to = '' or reply_to ~ '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$'),
  updated_at timestamptz not null default now()
);
insert into public.platform_email_settings(id) values (true) on conflict do nothing;

-- Tudo o que saiu (ou falhou), para o admin acompanhar.
create table public.platform_email_log (
  id uuid primary key default gen_random_uuid(),
  business_id uuid references public.businesses(id) on delete set null,
  kind text not null check (kind in ('billing','welcome','setup','share','weekly','test')),
  recipient text not null check (length(recipient) <= 320),
  subject text not null default '' check (length(subject) <= 300),
  status text not null check (status in ('sent','failed')),
  provider_id text,
  error text,
  created_at timestamptz not null default now()
);
create index platform_email_log_created_idx on public.platform_email_log(created_at desc);

-- Boas-vindas: cada passo sai uma vez por estabelecimento.
create table public.owner_email_notices (
  business_id uuid not null references public.businesses(id) on delete cascade,
  kind text not null check (kind in ('welcome','setup','share')),
  created_at timestamptz not null default now(),
  primary key (business_id, kind)
);

-- O dono pode tirar o relatório semanal do e-mail no painel dele.
alter table public.weekly_report_preferences
  add column email_enabled boolean not null default true;

alter table public.platform_email_settings enable row level security;
alter table public.platform_email_log enable row level security;
alter table public.owner_email_notices enable row level security;
revoke all on public.platform_email_settings, public.platform_email_log, public.owner_email_notices from anon, authenticated;
grant all on public.platform_email_settings, public.platform_email_log, public.owner_email_notices to service_role;
