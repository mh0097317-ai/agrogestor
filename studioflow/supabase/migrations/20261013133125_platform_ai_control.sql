create table public.platform_ai_control (
  id boolean primary key default true check (id),
  enabled boolean not null default false,
  updated_by uuid references auth.users(id),
  updated_at timestamptz not null default now()
);
alter table public.platform_ai_control enable row level security;
revoke all on public.platform_ai_control from public, anon, authenticated;
grant select, insert, update on public.platform_ai_control to service_role;
insert into public.platform_ai_control (id, enabled) values (true, false);
