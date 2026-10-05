-- Planos e módulos por estabelecimento, combinados com a equipe StudioFlow.
-- modules null = todos os módulos (quem já usava antes dos planos).

alter table public.platform_access
  add column modules text[] check (
    modules is null or modules <@ array['pagamentos', 'clube', 'recepcionista', 'produtos', 'recepcao', 'fidelidade', 'espera']
  ),
  add column plan text not null default '' check (length(plan) <= 40),
  add column monthly_price numeric(12,2) check (monthly_price >= 0 and monthly_price <= 100000);

alter table public.platform_access_events drop constraint if exists platform_access_events_action_check;
alter table public.platform_access_events add constraint platform_access_events_action_check
  check (action in ('created', 'granted', 'unlimited', 'until', 'suspended', 'pending', 'note', 'plan'));

-- Troca de plano, módulos e mensalidade, com registro.
create function public.platform_set_plan(
  p_business_id uuid, p_actor uuid, p_plan text, p_price numeric, p_modules text[]
) returns jsonb language plpgsql set search_path = '' as $$
declare acc public.platform_access;
begin
  if not exists (select 1 from public.businesses where id = p_business_id) then raise exception 'business not found'; end if;
  insert into public.platform_access (business_id) values (p_business_id) on conflict do nothing;
  update public.platform_access
  set plan = coalesce(p_plan, ''), monthly_price = p_price,
      modules = (select coalesce(array_agg(distinct m order by m), '{}') from unnest(p_modules) m),
      updated_by = p_actor
  where business_id = p_business_id returning * into acc;
  insert into public.platform_access_events (business_id, action, access_until, actor)
  values (p_business_id, 'plan', acc.access_until, p_actor);
  return to_jsonb(acc);
end; $$;
revoke all on function public.platform_set_plan(uuid, uuid, text, numeric, text[]) from public, anon, authenticated;
grant execute on function public.platform_set_plan(uuid, uuid, text, numeric, text[]) to service_role;

-- A visão geral passa a trazer plano, mensalidade e módulos.
create or replace function public.platform_overview() returns setof jsonb language sql stable security definer set search_path = '' as $$
  select jsonb_build_object(
    'id', b.id, 'name', b.name, 'slug', b.slug, 'category', b.category, 'phone', b.phone,
    'logo', coalesce(b.logo, ''), 'cover', b.cover, 'created_at', b.created_at,
    'status', coalesce(a.status, 'pending'), 'access_until', a.access_until, 'note', coalesce(a.note, ''),
    'modules', a.modules, 'plan', coalesce(a.plan, ''), 'monthly_price', a.monthly_price,
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
