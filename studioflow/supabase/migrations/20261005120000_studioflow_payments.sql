-- Pagamentos: cada estabelecimento conecta a própria conta Asaas. O dinheiro
-- cai direto com o dono; o StudioFlow guarda só a chave cifrada e o estado.

-- Conexão com o provedor. Só o servidor (service_role) lê ou escreve: nem
-- membros veem a chave cifrada.
create table public.payment_accounts (
  business_id uuid primary key,
  tenant_id uuid not null,
  provider text not null default 'asaas' check (provider in ('asaas')),
  environment text not null check (environment in ('sandbox', 'production')),
  api_key_enc text not null,
  api_key_hint text not null default '',
  webhook_id text,
  webhook_token_hash bytea,
  connected_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (tenant_id, business_id) references public.businesses(tenant_id, id) on delete cascade
);
alter table public.payment_accounts enable row level security;
create trigger updated_at before update on public.payment_accounts for each row execute function private.touch_updated_at();
create trigger immutable_scope before update on public.payment_accounts for each row execute function private.preserve_scope();
revoke all on public.payment_accounts from anon, authenticated;
grant all on public.payment_accounts to service_role;

-- Sinal no agendamento: valor fixo ou percentual do serviço, pago via Pix
-- em até `deposit_hold` minutos, senão o horário volta a ficar livre.
alter table public.business_settings
  add column deposit_mode text not null default 'off' check (deposit_mode in ('off', 'fixed', 'percent')),
  add column deposit_value numeric(12,2) not null default 0 check (deposit_value >= 0 and deposit_value <= 100000),
  add column deposit_hold integer not null default 15 check (deposit_hold between 5 and 120),
  add constraint deposit_percent_range check (deposit_mode <> 'percent' or deposit_value <= 100);

-- Clube de assinatura: planos mensais com serviços inclusos.
create table public.membership_plans (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null,
  business_id uuid not null,
  name text not null check (length(trim(name)) between 2 and 60),
  description text not null default '' check (length(description) <= 240),
  price numeric(12,2) not null check (price >= 5 and price <= 100000),
  service_ids uuid[] not null check (cardinality(service_ids) between 1 and 30),
  monthly_limit integer check (monthly_limit between 1 and 31),
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (tenant_id, business_id) references public.businesses(tenant_id, id),
  unique (business_id, id)
);
create index membership_plans_business_idx on public.membership_plans(business_id) where active;

create table public.memberships (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null,
  business_id uuid not null,
  plan_id uuid not null,
  customer_id uuid not null,
  customer_name text not null,
  customer_phone text not null,
  price numeric(12,2) not null check (price > 0),
  status text not null default 'pending' check (status in ('pending', 'active', 'overdue', 'cancelled')),
  provider_customer_id text,
  provider_subscription_id text,
  invoice_url text,
  next_due_date date,
  token_hash bytea not null unique,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (tenant_id, business_id) references public.businesses(tenant_id, id),
  foreign key (business_id, plan_id) references public.membership_plans(business_id, id),
  foreign key (business_id, customer_id) references public.customers(business_id, id),
  unique (business_id, id),
  unique (business_id, provider_subscription_id)
);
create index memberships_business_status_idx on public.memberships(business_id, status);

-- Campos do sinal e do clube no agendamento. Todos opcionais: as RPCs
-- antigas inserem a linha inteira e continuam válidas.
alter table public.appointments
  add column deposit_amount numeric(12,2) check (deposit_amount > 0),
  add column deposit_status text check (deposit_status in ('pending', 'paid', 'expired')),
  add column deposit_charge_id text,
  add column deposit_expires_at timestamptz,
  add column membership_id uuid,
  add constraint appointments_membership_fk foreign key (business_id, membership_id) references public.memberships(business_id, id);
create unique index appointments_deposit_charge_idx on public.appointments(business_id, deposit_charge_id) where deposit_charge_id is not null;
create index appointments_membership_idx on public.appointments(business_id, membership_id) where membership_id is not null;

-- O sinal entra no financeiro como pagamento Pix, uma vez por cobrança.
alter table public.payments add column provider_charge_id text;
create unique index payments_provider_charge_idx on public.payments(business_id, provider_charge_id) where provider_charge_id is not null;

do $$ declare table_name text; begin
  foreach table_name in array array['membership_plans', 'memberships'] loop
    execute format('alter table public.%I enable row level security', table_name);
    execute format('create trigger updated_at before update on public.%I for each row execute function private.touch_updated_at()', table_name);
    execute format('create trigger immutable_scope before update on public.%I for each row execute function private.preserve_scope()', table_name);
    execute format('grant select on public.%I to authenticated', table_name);
    execute format('grant all on public.%I to service_role', table_name);
    execute format('create policy member_read on public.%I for select to authenticated using (private.member_role(business_id) is not null)', table_name);
    execute format('revoke all on public.%I from anon', table_name);
  end loop;
end; $$;

-- Reserva com sinal vencido libera o horário. Chamada sob o lock do
-- estabelecimento, antes de qualquer checagem de disponibilidade.
create function private.expire_holds(p_business uuid) returns void language sql set search_path = '' as $$
  update public.appointments set status = 'cancelled', deposit_status = 'expired'
  where business_id = p_business and status = 'pending' and deposit_status = 'pending' and deposit_expires_at < now();
$$;
revoke all on function private.expire_holds(uuid) from public, anon, authenticated;
grant execute on function private.expire_holds(uuid) to service_role;

create function public.expire_deposit_holds(p_business_id uuid) returns void language plpgsql set search_path = '' as $$
begin
  perform pg_advisory_xact_lock(hashtextextended(p_business_id::text, 0));
  perform private.expire_holds(p_business_id);
end; $$;
revoke all on function public.expire_deposit_holds(uuid) from public, anon, authenticated;
grant execute on function public.expire_deposit_holds(uuid) to service_role;

create or replace function public.book_appointment(p_business_id uuid,p_service_ids uuid[],p_professional_id uuid,p_start timestamptz,p_name text,p_phone text,p_email text default null,p_reminder boolean default false)
returns jsonb language plpgsql set search_path='' as $$
declare person uuid;tenant uuid;customer uuid;appointment uuid;duration_minutes integer;total numeric;buffer_minutes integer;token text;begin
 if p_phone!~'^[1-9][0-9](9[0-9]{8}|[2-5][0-9]{7})$'or length(trim(p_name))<3 or length(p_name)>100 then raise exception 'invalid customer';end if;
 select tenant_id into tenant from public.businesses where id=p_business_id;
 if not found then raise exception 'unknown business';end if;
 -- Business transaction lock serializes professional assignment, reservations and blocks. Exclusion constraint is independent defense.
 perform pg_advisory_xact_lock(hashtextextended(p_business_id::text,0));
 perform private.expire_holds(p_business_id);
 select id into person from public.professionals where business_id=p_business_id and active and(p_professional_id is null or id=p_professional_id)and private.slot_available(p_business_id,id,p_service_ids,p_start)order by name limit 1;
 if person is null then raise exception 'unavailable';end if;
 select sum(duration),sum(price)into duration_minutes,total from public.services where business_id=p_business_id and id=any(p_service_ids);
 select buffer into buffer_minutes from public.business_settings where business_id=p_business_id;
 insert into public.customers(tenant_id,business_id,name,phone,email)values(tenant,p_business_id,p_name,p_phone,p_email)
 on conflict(business_id,phone)do update set updated_at=now()returning id into customer;
 token=encode(extensions.gen_random_bytes(32),'hex');
 insert into public.appointments(tenant_id,business_id,customer_id,professional_id,customer_name,customer_phone,"start","end",occupied_end,price,reminder,token_hash)
 values(tenant,p_business_id,customer,person,p_name,p_phone,p_start,p_start+make_interval(mins=>duration_minutes),p_start+make_interval(mins=>duration_minutes+buffer_minutes),total,p_reminder,extensions.digest(token,'sha256'))returning id into appointment;
 insert into public.appointment_services(tenant_id,business_id,appointment_id,service_id,duration,price)select tenant,p_business_id,appointment,id,duration,price from public.services where business_id=p_business_id and id=any(p_service_ids);
 return private.appointment_json(appointment)||jsonb_build_object('token',token);end;$$;

create or replace function public.manage_booking(p_token text,p_action text,p_start timestamptz default null,p_professional_id uuid default null)returns jsonb language plpgsql set search_path='' as $$
declare appointment public.appointments;settings public.business_settings;services uuid[];person uuid;duration_minutes integer;begin
 select * into appointment from public.appointments where token_hash=extensions.digest(p_token,'sha256');
 if not found then raise exception 'unknown booking';end if;
 perform pg_advisory_xact_lock(hashtextextended(appointment.business_id::text,0));
 perform private.expire_holds(appointment.business_id);
 select * into appointment from public.appointments where id=appointment.id for update;
 if p_action='cancel'and appointment.status='cancelled'then return private.appointment_json(appointment.id)||jsonb_build_object('token',p_token);end if;
 select * into settings from public.business_settings where business_id=appointment.business_id;
 if appointment.status not in('confirmed','pending')or appointment."start"<now()+make_interval(hours=>settings.cancellation_hours)then raise exception 'cancellation policy';end if;
 -- A reserva aguardando o Pix não muda de horário: paga ou deixa vencer.
 if p_action='reschedule'and appointment.deposit_status='pending'then raise exception 'deposit pending';end if;
 if p_action='cancel'then update public.appointments set status='cancelled'where id=appointment.id;
 elsif p_action='reschedule'then
  select array_agg(service_id),sum(duration)into services,duration_minutes from public.appointment_services where business_id=appointment.business_id and appointment_id=appointment.id;
  select id into person from public.professionals where business_id=appointment.business_id and(p_professional_id is null or id=p_professional_id)and private.slot_available(appointment.business_id,id,services,p_start,appointment.id)order by name limit 1;
  if person is null then raise exception 'unavailable';end if;
  update public.appointments set professional_id=person,"start"=p_start,"end"=p_start+make_interval(mins=>duration_minutes),occupied_end=p_start+make_interval(mins=>duration_minutes+settings.buffer)where id=appointment.id;
 else raise exception 'invalid action';end if;
 return private.appointment_json(appointment.id)||jsonb_build_object('token',p_token);end;$$;

-- Segura o horário até o Pix: a reserva fica pendente com prazo.
create function public.hold_for_deposit(p_appointment_id uuid, p_amount numeric, p_minutes integer)
returns void language plpgsql set search_path = '' as $$
declare appointment public.appointments; begin
  if p_amount is null or p_amount <= 0 or p_minutes not between 5 and 120 then raise exception 'invalid deposit'; end if;
  select * into appointment from public.appointments where id = p_appointment_id;
  if not found then raise exception 'unknown booking'; end if;
  perform pg_advisory_xact_lock(hashtextextended(appointment.business_id::text, 0));
  update public.appointments
  set status = 'pending', deposit_amount = least(p_amount, price), deposit_status = 'pending',
      deposit_expires_at = now() + make_interval(mins => p_minutes)
  where id = p_appointment_id and status = 'confirmed' and deposit_status is null and membership_id is null;
  if not found then raise exception 'invalid deposit'; end if;
end; $$;
revoke all on function public.hold_for_deposit(uuid, numeric, integer) from public, anon, authenticated;
grant execute on function public.hold_for_deposit(uuid, numeric, integer) to service_role;

-- Pix recebido (aviso do Asaas ou consulta). Idempotente.
-- Pago no prazo: confirma. Pago depois que venceu: volta a confirmar se o
-- horário continua livre; senão fica cancelado com o sinal pago, e o painel
-- avisa para devolver. O valor entra uma vez no financeiro.
create function public.confirm_deposit(p_business_id uuid, p_charge_id text)
returns text language plpgsql set search_path = '' as $$
declare appointment public.appointments; services uuid[]; outcome text; begin
  perform pg_advisory_xact_lock(hashtextextended(p_business_id::text, 0));
  select * into appointment from public.appointments where business_id = p_business_id and deposit_charge_id = p_charge_id for update;
  if not found then return 'unknown'; end if;
  if appointment.deposit_status = 'paid' then return 'already'; end if;
  if appointment.status = 'pending' and appointment.deposit_status = 'pending' then
    update public.appointments set status = 'confirmed', deposit_status = 'paid' where id = appointment.id;
    outcome = 'confirmed';
  else
    select array_agg(service_id) into services from public.appointment_services where business_id = p_business_id and appointment_id = appointment.id;
    if appointment.deposit_status = 'expired' and appointment.status = 'cancelled' and appointment."start" > now()
       and private.slot_available(p_business_id, appointment.professional_id, services, appointment."start", appointment.id, true) then
      update public.appointments set status = 'confirmed', deposit_status = 'paid' where id = appointment.id;
      outcome = 'confirmed';
    else
      update public.appointments set deposit_status = 'paid' where id = appointment.id;
      outcome = 'refund';
    end if;
  end if;
  insert into public.payments (tenant_id, business_id, appointment_id, amount, method, provider_charge_id)
  values (appointment.tenant_id, p_business_id, appointment.id, appointment.deposit_amount, 'pix', p_charge_id)
  on conflict (business_id, provider_charge_id) where provider_charge_id is not null do nothing;
  return outcome;
end; $$;
revoke all on function public.confirm_deposit(uuid, text) from public, anon, authenticated;
grant execute on function public.confirm_deposit(uuid, text) to service_role;

-- Uso do clube no mês (calendário de São Paulo) do atendimento.
create function private.membership_usage(p_membership uuid, p_start timestamptz, p_exclude uuid default null)
returns integer language sql stable set search_path = '' as $$
  select count(*)::integer from public.appointments a
  where a.membership_id = p_membership and a.status in ('confirmed', 'pending', 'in_progress', 'completed')
    and (p_exclude is null or a.id <> p_exclude)
    and date_trunc('month', a."start" at time zone 'America/Sao_Paulo') = date_trunc('month', p_start at time zone 'America/Sao_Paulo');
$$;
revoke all on function private.membership_usage(uuid, timestamptz, uuid) from public, anon, authenticated;
grant execute on function private.membership_usage(uuid, timestamptz, uuid) to service_role;

-- Atendimento pelo clube: assinatura ativa, mesmo WhatsApp, serviços do
-- plano e dentro do limite do mês. Zera o preço (histórico incluso).
create function public.apply_membership(p_appointment_id uuid, p_token text)
returns text language plpgsql set search_path = '' as $$
declare appointment public.appointments; member public.memberships; plan public.membership_plans; services uuid[]; begin
  if p_token !~ '^[a-f0-9]{64}$' then return 'invalid'; end if;
  select * into appointment from public.appointments where id = p_appointment_id;
  if not found then return 'invalid'; end if;
  perform pg_advisory_xact_lock(hashtextextended(appointment.business_id::text, 0));
  select * into appointment from public.appointments where id = p_appointment_id for update;
  if appointment.membership_id is not null then return 'covered'; end if;
  if appointment.status <> 'confirmed' or appointment.deposit_status is not null then return 'invalid'; end if;
  select * into member from public.memberships where business_id = appointment.business_id and token_hash = extensions.digest(p_token, 'sha256');
  if not found then return 'invalid'; end if;
  if member.status <> 'active' then return 'inactive'; end if;
  if member.customer_phone <> appointment.customer_phone then return 'phone'; end if;
  select * into plan from public.membership_plans where business_id = appointment.business_id and id = member.plan_id;
  select array_agg(service_id) into services from public.appointment_services where business_id = appointment.business_id and appointment_id = appointment.id;
  if not (services <@ plan.service_ids) then return 'services'; end if;
  if plan.monthly_limit is not null and private.membership_usage(member.id, appointment."start", appointment.id) >= plan.monthly_limit then return 'limit'; end if;
  update public.appointments set membership_id = member.id, price = 0 where id = appointment.id;
  update public.appointment_services set price = 0 where business_id = appointment.business_id and appointment_id = appointment.id;
  return 'covered';
end; $$;
revoke all on function public.apply_membership(uuid, text) from public, anon, authenticated;
grant execute on function public.apply_membership(uuid, text) to service_role;

-- Comprovante: informa se o atendimento é pelo clube.
create or replace function public.get_booking(p_token text) returns jsonb language plpgsql set search_path = '' as $$
declare appointment public.appointments; begin
 if p_token !~ '^[a-f0-9]{64}$' then return null; end if;
 select * into appointment from public.appointments where token_hash = extensions.digest(p_token, 'sha256');
 if not found then return null; end if;
 return jsonb_build_object('appointment', private.appointment_json(appointment.id) || jsonb_build_object('token', p_token),
 'business', (select to_jsonb(b) from public.businesses b where b.id = appointment.business_id),
 'services', (select jsonb_agg(to_jsonb(s)) from public.services s join public.appointment_services a on a.business_id = s.business_id and a.service_id = s.id where a.business_id = appointment.business_id and a.appointment_id = appointment.id),
 'professional', (select to_jsonb(p) - 'phone' - 'user_id' from public.professionals p where p.business_id = appointment.business_id and p.id = appointment.professional_id),
 'review', (select jsonb_build_object('rating', r.rating, 'comment', r.comment, 'created_at', r.created_at) from public.reviews r where r.business_id = appointment.business_id and r.appointment_id = appointment.id),
 'loyalty_visits', (select count(*) from public.appointments a where a.business_id = appointment.business_id and a.customer_id = appointment.customer_id and a.status = 'completed'),
 'membership_plan', (select p.name from public.memberships m join public.membership_plans p on p.business_id = m.business_id and p.id = m.plan_id where m.business_id = appointment.business_id and m.id = appointment.membership_id));
end; $$;
revoke all on function public.get_booking(text) from public, anon, authenticated;
grant execute on function public.get_booking(text) to service_role;
