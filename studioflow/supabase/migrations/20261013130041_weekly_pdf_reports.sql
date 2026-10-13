create table public.weekly_report_preferences (
  business_id uuid primary key references public.businesses(id),
  owner_phone text not null default '' check(owner_phone = '' or owner_phone ~ '^[0-9]{10,15}$'),
  enabled boolean not null default false,
  include_professionals boolean not null default true,
  updated_at timestamptz not null default now(),
  check(not enabled or owner_phone <> '')
);
create table public.weekly_report_deliveries (
  business_id uuid not null references public.businesses(id),
  week date not null,
  target text not null,
  status text not null default 'claimed' check(status in ('claimed','sent','failed')),
  provider_message_id text,
  created_at timestamptz not null default now(),
  sent_at timestamptz,
  primary key(business_id,week,target)
);
alter table public.weekly_report_preferences enable row level security;
alter table public.weekly_report_deliveries enable row level security;
revoke all on public.weekly_report_preferences,public.weekly_report_deliveries from public,anon,authenticated;
grant select,insert,update on public.weekly_report_preferences,public.weekly_report_deliveries to service_role;
create table public.platform_weekly_report_preferences (
  id boolean primary key default true check(id),
  owner_phone text not null default '' check(owner_phone = '' or owner_phone ~ '^[0-9]{10,15}$'),
  enabled boolean not null default false,
  updated_at timestamptz not null default now(),
  check(not enabled or owner_phone <> '')
);
create table public.platform_weekly_report_deliveries (
  week date primary key,
  status text not null default 'claimed' check(status in ('claimed','sent','failed')),
  provider_message_id text,
  created_at timestamptz not null default now(),
  sent_at timestamptz
);
alter table public.platform_weekly_report_preferences enable row level security;
alter table public.platform_weekly_report_deliveries enable row level security;
revoke all on public.platform_weekly_report_preferences,public.platform_weekly_report_deliveries from public,anon,authenticated;
grant select,insert,update on public.platform_weekly_report_preferences,public.platform_weekly_report_deliveries to service_role;
