-- Plataforma: a equipe StudioFlow libera o acesso de cada estabelecimento.
-- Cadastro novo nasce "aguardando"; painel e agenda online só abrem com
-- acesso ativo e dentro do prazo. Tudo aqui é só do servidor.

create table public.platform_admins (
  user_id uuid primary key references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);

create table public.platform_access (
  business_id uuid primary key references public.businesses(id) on delete cascade,
  status text not null default 'pending' check (status in ('pending', 'active', 'suspended')),
  -- Fim do acesso; null = sem prazo.
  access_until timestamptz,
  note text not null default '' check (length(note) <= 500),
  updated_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create trigger updated_at before update on public.platform_access for each row execute function private.touch_updated_at();

create table public.platform_access_events (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  action text not null check (action in ('created', 'granted', 'unlimited', 'until', 'suspended', 'pending', 'note')),
  days integer,
  access_until timestamptz,
  actor uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);
create index platform_access_events_business_idx on public.platform_access_events(business_id, created_at desc);

do $$ declare table_name text; begin
  foreach table_name in array array['platform_admins', 'platform_access', 'platform_access_events'] loop
    execute format('alter table public.%I enable row level security', table_name);
    execute format('revoke all on public.%I from anon, authenticated', table_name);
    execute format('grant all on public.%I to service_role', table_name);
  end loop;
end; $$;

-- Quem já usa continua usando, sem prazo, até a equipe decidir.
insert into public.platform_access (business_id, status)
select id, 'active' from public.businesses
on conflict (business_id) do nothing;

-- Todo estabelecimento novo entra na fila de liberação.
create function private.queue_business_access() returns trigger language plpgsql security definer set search_path = '' as $$
begin
  insert into public.platform_access (business_id, status) values (new.id, 'pending') on conflict do nothing;
  insert into public.platform_access_events (business_id, action) values (new.id, 'created');
  return new;
end; $$;
revoke all on function private.queue_business_access() from public, anon, authenticated;
create trigger queue_access after insert on public.businesses for each row execute function private.queue_business_access();

-- Uma mudança de acesso e o registro dela, juntos.
create function public.platform_set_access(
  p_business_id uuid, p_actor uuid, p_action text,
  p_days integer default null, p_until timestamptz default null, p_note text default null
) returns jsonb language plpgsql set search_path = '' as $$
declare acc public.platform_access; base timestamptz;
begin
  select * into acc from public.platform_access where business_id = p_business_id for update;
  if not found then
    if not exists (select 1 from public.businesses where id = p_business_id) then raise exception 'business not found'; end if;
    insert into public.platform_access (business_id) values (p_business_id) returning * into acc;
  end if;
  if p_action = 'granted' then
    if p_days is null or p_days not between 1 and 3660 then raise exception 'invalid days'; end if;
    base := case when acc.access_until is not null and acc.access_until > now() then acc.access_until else now() end;
    update public.platform_access set status = 'active', access_until = base + make_interval(days => p_days), updated_by = p_actor
      where business_id = p_business_id returning * into acc;
  elsif p_action = 'until' then
    if p_until is null or p_until <= now() then raise exception 'invalid date'; end if;
    update public.platform_access set status = 'active', access_until = p_until, updated_by = p_actor
      where business_id = p_business_id returning * into acc;
  elsif p_action = 'unlimited' then
    update public.platform_access set status = 'active', access_until = null, updated_by = p_actor
      where business_id = p_business_id returning * into acc;
  elsif p_action = 'suspended' then
    update public.platform_access set status = 'suspended', updated_by = p_actor
      where business_id = p_business_id returning * into acc;
  elsif p_action = 'pending' then
    update public.platform_access set status = 'pending', updated_by = p_actor
      where business_id = p_business_id returning * into acc;
  elsif p_action = 'note' then
    if length(coalesce(p_note, '')) > 500 then raise exception 'note too long'; end if;
    update public.platform_access set note = coalesce(p_note, ''), updated_by = p_actor
      where business_id = p_business_id returning * into acc;
  else
    raise exception 'invalid action';
  end if;
  insert into public.platform_access_events (business_id, action, days, access_until, actor)
  values (p_business_id, p_action, p_days, acc.access_until, p_actor);
  return to_jsonb(acc);
end; $$;
revoke all on function public.platform_set_access(uuid, uuid, text, integer, timestamptz, text) from public, anon, authenticated;
grant execute on function public.platform_set_access(uuid, uuid, text, integer, timestamptz, text) to service_role;

-- Visão geral para o painel da plataforma: estabelecimento, dono e uso.
create function public.platform_overview() returns setof jsonb language sql stable security definer set search_path = '' as $$
  select jsonb_build_object(
    'id', b.id, 'name', b.name, 'slug', b.slug, 'category', b.category, 'phone', b.phone,
    'logo', coalesce(b.logo, ''), 'cover', b.cover, 'created_at', b.created_at,
    'status', coalesce(a.status, 'pending'), 'access_until', a.access_until, 'note', coalesce(a.note, ''),
    'owner_name', coalesce(p.name, ''), 'owner_email', coalesce(u.email, ''), 'last_sign_in_at', u.last_sign_in_at,
    'appointments_30d', (select count(*) from public.appointments ap where ap.business_id = b.id and ap."start" > now() - interval '30 days' and ap.status <> 'cancelled'),
    'customers', (select count(*) from public.customers c where c.business_id = b.id),
    'last_appointment_at', (select max(ap.created_at) from public.appointments ap where ap.business_id = b.id)
  )
  from public.businesses b
  left join public.platform_access a on a.business_id = b.id
  left join lateral (
    select m.user_id from public.business_members m where m.business_id = b.id and m.role = 'owner' and m.active order by m.created_at limit 1
  ) o on true
  left join public.profiles p on p.id = o.user_id
  left join auth.users u on u.id = o.user_id
  order by b.created_at desc;
$$;
revoke all on function public.platform_overview() from public, anon, authenticated;
grant execute on function public.platform_overview() to service_role;
