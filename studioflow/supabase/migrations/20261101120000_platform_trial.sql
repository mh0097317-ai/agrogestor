-- Teste grátis: estabelecimento novo já nasce liberado por N dias, sem
-- esperar a equipe. N fica no /admin; 0 volta ao modelo "aguardando".

create table public.platform_settings (
  id text primary key default 'default' check (id = 'default'),
  trial_days integer not null default 30 check (trial_days between 0 and 365),
  updated_by uuid references auth.users(id) on delete set null,
  updated_at timestamptz not null default now()
);
alter table public.platform_settings enable row level security;
revoke all on public.platform_settings from anon, authenticated;
grant all on public.platform_settings to service_role;
insert into public.platform_settings (id) values ('default') on conflict do nothing;

create or replace function private.queue_business_access() returns trigger language plpgsql security definer set search_path = '' as $$
declare
  trial integer;
  ends timestamptz;
begin
  select trial_days into trial from public.platform_settings where id = 'default';
  trial := coalesce(trial, 30);
  insert into public.platform_access_events (business_id, action) values (new.id, 'created');
  if trial > 0 then
    ends := now() + make_interval(days => trial);
    insert into public.platform_access (business_id, status, access_until, note)
      values (new.id, 'active', ends, format('Teste grátis de %s dias', trial))
      on conflict do nothing;
    insert into public.platform_access_events (business_id, action, days, access_until)
      values (new.id, 'granted', trial, ends);
  else
    insert into public.platform_access (business_id, status) values (new.id, 'pending') on conflict do nothing;
  end if;
  return new;
end; $$;
revoke all on function private.queue_business_access() from public, anon, authenticated;
