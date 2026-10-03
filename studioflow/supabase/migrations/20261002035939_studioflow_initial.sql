-- StudioFlow: all booking writes use server-only transactional RPCs.
create extension if not exists pgcrypto with schema extensions;
create extension if not exists btree_gist with schema extensions;
grant usage on schema extensions to service_role;
create schema if not exists private;
revoke all on schema private from public, anon;
grant usage on schema private to authenticated, service_role;

create table public.tenants (
  id uuid primary key default gen_random_uuid(), name text not null,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  name text not null default '', created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table public.businesses (
  id uuid primary key default gen_random_uuid(), tenant_id uuid not null references public.tenants(id),
  slug text not null unique check (slug ~ '^[a-z0-9-]{3,80}$'), name text not null,
  category text not null, description text not null default '', address text not null default '',
  phone text not null default '', instagram text not null default '', cover text not null default '',
  logo text, color text, cnpj text, photos text[] not null default '{}', amenities text[] not null default '{}',
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(), unique(tenant_id,id)
);
create table public.business_members (
  id uuid primary key default gen_random_uuid(), tenant_id uuid not null, business_id uuid not null,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null check(role in ('owner','admin','manager','receptionist','professional')), active boolean not null default true,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  foreign key(tenant_id,business_id) references public.businesses(tenant_id,id), unique(business_id,user_id)
);
create index business_members_user_id_idx on public.business_members(user_id,business_id) where active;
create table public.customers (
  id uuid primary key default gen_random_uuid(), tenant_id uuid not null, business_id uuid not null,
  name text not null, phone text not null check(phone ~ '^[1-9][0-9](9[0-9]{8}|[2-5][0-9]{7})$'), email text,
  visits integer not null default 0, total_spent numeric(12,2) not null default 0, last_visit timestamptz,
  favorite_service text, favorite_professional text, return_interval integer,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  foreign key(tenant_id,business_id) references public.businesses(tenant_id,id), unique(business_id,id),unique(business_id,phone)
);
create index customers_business_name_idx on public.customers(business_id,name);
create table public.professionals (
  id uuid primary key default gen_random_uuid(), tenant_id uuid not null, business_id uuid not null,
  user_id uuid references auth.users(id), name text not null, photo text not null default '', phone text not null default '',
  specialties text[] not null default '{}', commission numeric(5,2) not null default 0 check(commission between 0 and 100),
  active boolean not null default true, days integer[] not null default '{1,2,3,4,5,6}',
  "start" time not null default '09:00', "end" time not null default '18:00', break_start time, break_end time,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  foreign key(tenant_id,business_id) references public.businesses(tenant_id,id), unique(business_id,id),check("end">"start"),
  check((break_start is null and break_end is null) or (break_start>= "start" and break_end>break_start and break_end<= "end"))
);
create index professionals_business_active_idx on public.professionals(business_id) where active;
create table public.services (
  id uuid primary key default gen_random_uuid(), tenant_id uuid not null, business_id uuid not null,
  name text not null, category text not null, description text not null default '', duration integer not null check(duration between 5 and 480),
  price numeric(12,2) not null check(price>=0), image text not null default '', active boolean not null default true,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  foreign key(tenant_id,business_id) references public.businesses(tenant_id,id), unique(business_id,id)
);
create index services_business_active_idx on public.services(business_id) where active;
create table public.professional_services (
  tenant_id uuid not null,business_id uuid not null,professional_id uuid not null,service_id uuid not null,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  primary key(business_id,professional_id,service_id),
  foreign key(tenant_id,business_id) references public.businesses(tenant_id,id),
  foreign key(business_id,professional_id) references public.professionals(business_id,id),
  foreign key(business_id,service_id) references public.services(business_id,id)
);
create table public.business_settings (
  tenant_id uuid not null,business_id uuid primary key, min_notice integer not null default 30 check(min_notice between 0 and 10080),
  max_days integer not null default 60 check(max_days between 1 and 365),buffer integer not null default 0 check(buffer between 0 and 120),
  cancellation_hours integer not null default 2 check(cancellation_hours between 0 and 168),
  open_days integer[] not null default '{1,2,3,4,5,6}',open_start time not null default '09:00',open_end time not null default '20:00',
  notifications boolean not null default true,created_at timestamptz not null default now(),updated_at timestamptz not null default now(),
  foreign key(tenant_id,business_id) references public.businesses(tenant_id,id),check(open_end>open_start)
);
create table public.business_hours (
  id uuid primary key default gen_random_uuid(),tenant_id uuid not null,business_id uuid not null,
  weekday smallint not null check(weekday between 0 and 6),opens_at time not null,closes_at time not null,
  created_at timestamptz not null default now(),updated_at timestamptz not null default now(),
  foreign key(tenant_id,business_id) references public.businesses(tenant_id,id),unique(business_id,weekday),check(closes_at>opens_at)
);
create table public.professional_hours (
  id uuid primary key default gen_random_uuid(),tenant_id uuid not null,business_id uuid not null,professional_id uuid not null,
  weekday smallint not null check(weekday between 0 and 6),opens_at time not null,closes_at time not null,
  created_at timestamptz not null default now(),updated_at timestamptz not null default now(),
  foreign key(tenant_id,business_id) references public.businesses(tenant_id,id),
  foreign key(business_id,professional_id) references public.professionals(business_id,id),unique(business_id,professional_id,weekday),check(closes_at>opens_at)
);
create table public.professional_breaks (
  id uuid primary key default gen_random_uuid(),tenant_id uuid not null,business_id uuid not null,professional_id uuid not null,
  weekday smallint not null check(weekday between 0 and 6),starts_at time not null,ends_at time not null,
  created_at timestamptz not null default now(),updated_at timestamptz not null default now(),
  foreign key(tenant_id,business_id) references public.businesses(tenant_id,id),
  foreign key(business_id,professional_id) references public.professionals(business_id,id),check(ends_at>starts_at)
);
create table public.appointments (
  id uuid primary key default gen_random_uuid(),tenant_id uuid not null,business_id uuid not null,customer_id uuid not null,professional_id uuid not null,
  customer_name text not null, customer_phone text not null,"start" timestamptz not null,"end" timestamptz not null,occupied_end timestamptz not null,
  price numeric(12,2) not null check(price>=0), status text not null default 'confirmed' check(status in ('confirmed','pending','in_progress','completed','cancelled','no_show')),
  reminder boolean not null default false,token_hash bytea unique,
  created_at timestamptz not null default now(),updated_at timestamptz not null default now(),
  foreign key(tenant_id,business_id) references public.businesses(tenant_id,id),
  foreign key(business_id,customer_id) references public.customers(business_id,id),
  foreign key(business_id,professional_id) references public.professionals(business_id,id),unique(business_id,id),check("end">"start"),check(occupied_end>= "end"),
  constraint no_double_booking exclude using gist (business_id with =,professional_id with =,tstzrange("start",occupied_end,'[)') with &&)
    where (status in ('confirmed','pending','in_progress','completed'))
);
create index appointments_business_start_idx on public.appointments(business_id,"start");
create index appointments_customer_start_idx on public.appointments(business_id,customer_id,"start");
create table public.appointment_services (
  tenant_id uuid not null,business_id uuid not null,appointment_id uuid not null,service_id uuid not null,
  duration integer not null,price numeric(12,2) not null,created_at timestamptz not null default now(),updated_at timestamptz not null default now(),
  primary key(business_id,appointment_id,service_id),foreign key(tenant_id,business_id) references public.businesses(tenant_id,id),
  foreign key(business_id,appointment_id) references public.appointments(business_id,id),foreign key(business_id,service_id) references public.services(business_id,id)
);
create table public.blocked_times (
  id uuid primary key default gen_random_uuid(),tenant_id uuid not null,business_id uuid not null,professional_id uuid not null,
  "start" timestamptz not null,"end" timestamptz not null,reason text not null,
  created_at timestamptz not null default now(),updated_at timestamptz not null default now(),
  foreign key(tenant_id,business_id) references public.businesses(tenant_id,id),foreign key(business_id,professional_id) references public.professionals(business_id,id),check("end">"start")
);
create index blocked_times_professional_start_idx on public.blocked_times(business_id,professional_id,"start");
create table public.payments (
  id uuid primary key default gen_random_uuid(),tenant_id uuid not null,business_id uuid not null,appointment_id uuid not null,
  amount numeric(12,2) not null check(amount>0),method text not null check(method in ('pix','cash','credit','debit','other')),
  created_at timestamptz not null default now(),updated_at timestamptz not null default now(),
  foreign key(tenant_id,business_id) references public.businesses(tenant_id,id),foreign key(business_id,appointment_id) references public.appointments(business_id,id)
);
create index payments_business_created_idx on public.payments(business_id,created_at);
create table public.commissions (
  id uuid primary key default gen_random_uuid(),tenant_id uuid not null,business_id uuid not null,appointment_id uuid not null,professional_id uuid not null,
  amount numeric(12,2) not null check(amount>=0),paid boolean not null default false,
  created_at timestamptz not null default now(),updated_at timestamptz not null default now(),
  foreign key(tenant_id,business_id) references public.businesses(tenant_id,id),foreign key(business_id,appointment_id) references public.appointments(business_id,id),
  foreign key(business_id,professional_id) references public.professionals(business_id,id),unique(business_id,appointment_id,professional_id)
);

create function private.touch_updated_at() returns trigger language plpgsql set search_path='' as $$begin new.updated_at=now();return new;end;$$;
create function private.preserve_scope()returns trigger language plpgsql set search_path=''as $$begin
 if to_jsonb(new)->'id'is distinct from to_jsonb(old)->'id'or to_jsonb(new)->'tenant_id'is distinct from to_jsonb(old)->'tenant_id'or to_jsonb(new)->'business_id'is distinct from to_jsonb(old)->'business_id'then raise exception 'record scope is immutable';end if;return new;end;$$;
create function private.member_role(p_business uuid) returns text language sql stable security definer set search_path='' as $$
 select role from public.business_members where business_id=p_business and user_id=(select auth.uid()) and active limit 1;
$$;
revoke all on function private.member_role(uuid) from public,anon;
grant execute on function private.member_role(uuid) to authenticated,service_role;
create function private.create_profile() returns trigger language plpgsql security definer set search_path='' as $$
begin insert into public.profiles(id,name)values(new.id,coalesce(new.raw_user_meta_data->>'name',''));return new;end;$$;
revoke all on function private.create_profile() from public,anon,authenticated;
create trigger auth_user_profile after insert on auth.users for each row execute function private.create_profile();

do $$ declare table_name text; begin
  foreach table_name in array array['tenants','profiles','businesses','business_members','customers','professionals','services','professional_services','business_settings','business_hours','professional_hours','professional_breaks','appointments','appointment_services','blocked_times','payments','commissions'] loop
    execute format('alter table public.%I enable row level security',table_name);
    execute format('create trigger updated_at before update on public.%I for each row execute function private.touch_updated_at()',table_name);
    if table_name not in('tenants','profiles')then execute format('create trigger immutable_scope before update on public.%I for each row execute function private.preserve_scope()',table_name);end if;
    execute format('grant select on public.%I to authenticated',table_name);
    execute format('grant all on public.%I to service_role',table_name);
  end loop;
end;$$;
create policy profiles_self_read on public.profiles for select to authenticated using(id=(select auth.uid()));
create policy profiles_self_update on public.profiles for update to authenticated using(id=(select auth.uid()))with check(id=(select auth.uid()));
grant update(name)on public.profiles to authenticated;
create policy tenant_member_read on public.tenants for select to authenticated using(exists(select 1 from public.business_members m where m.tenant_id=tenants.id and m.user_id=(select auth.uid()) and m.active));
create policy membership_self_read on public.business_members for select to authenticated using(user_id=(select auth.uid()) and active);
create policy business_member_read on public.businesses for select to authenticated using(private.member_role(id)is not null);
create policy business_admin_update on public.businesses for update to authenticated using(private.member_role(id)in('owner','admin','manager'))with check(private.member_role(id)in('owner','admin','manager'));
grant update(name,category,description,address,phone,instagram,cover,logo,color,cnpj,photos,amenities)on public.businesses to authenticated;
do $$ declare table_name text;begin
 foreach table_name in array array['customers','professionals','services','professional_services','business_settings','business_hours','professional_hours','professional_breaks','appointments','appointment_services','blocked_times','payments','commissions']loop
  execute format('create policy member_read on public.%I for select to authenticated using(private.member_role(business_id)is not null)',table_name);
 end loop;
 foreach table_name in array array['services','professionals','professional_services','business_settings','business_hours','professional_hours','professional_breaks']loop
  execute format('create policy admin_insert on public.%I for insert to authenticated with check(private.member_role(business_id)in(''owner'',''admin'',''manager''))',table_name);
  execute format('create policy admin_update on public.%I for update to authenticated using(private.member_role(business_id)in(''owner'',''admin'',''manager''))with check(private.member_role(business_id)in(''owner'',''admin'',''manager''))',table_name);
  execute format('grant insert,update on public.%I to authenticated',table_name);
 end loop;
end;$$;
-- No anon table access; public data is an explicit server projection. No direct client appointment/block/payment writes.
revoke all on all tables in schema public from anon;
alter default privileges in schema public revoke execute on functions from public;

create function private.appointment_json(p_id uuid)returns jsonb language sql stable set search_path='' as $$
 select (to_jsonb(a)-'token_hash'-'occupied_end')||jsonb_build_object('service_ids',(select coalesce(jsonb_agg(s.service_id),'[]')from public.appointment_services s where s.business_id=a.business_id and s.appointment_id=a.id)) from public.appointments a where id=p_id;
$$;
revoke all on function private.appointment_json(uuid)from public,anon,authenticated;
grant execute on function private.appointment_json(uuid)to service_role;

create function private.slot_available(p_business uuid,p_professional uuid,p_services uuid[],p_start timestamptz,p_exclude uuid default null,p_staff boolean default false)
returns boolean language plpgsql set search_path='' as $$
declare person public.professionals;settings public.business_settings;duration_minutes integer;finish timestamptz;local_start timestamp;day integer;open_time time;close_time time; begin
 select * into person from public.professionals where business_id=p_business and id=p_professional and active;
 if not found then return false;end if;
 select * into settings from public.business_settings where business_id=p_business;
 if not found then return false;end if;
 select sum(duration)into duration_minutes from public.services where business_id=p_business and id=any(p_services)and active;
 if duration_minutes is null or cardinality(p_services)<1 or cardinality(p_services)<>(select count(*)from public.services where business_id=p_business and id=any(p_services)and active)then return false;end if;
 if cardinality(p_services)<>(select count(*)from public.professional_services where business_id=p_business and professional_id=p_professional and service_id=any(p_services))then return false;end if;
 if not p_staff and(p_start<now()+make_interval(mins=>settings.min_notice)or(p_start at time zone 'America/Sao_Paulo')::date>(now()at time zone 'America/Sao_Paulo')::date+settings.max_days)then return false;end if;
 local_start=p_start at time zone 'America/Sao_Paulo';day=extract(dow from local_start);finish=p_start+make_interval(mins=>duration_minutes+settings.buffer);
 if not(day=any(settings.open_days))or not(day=any(person.days))then return false;end if;
 open_time=greatest(settings.open_start,person."start");close_time=least(settings.open_end,person."end");
 select greatest(open_time,opens_at),least(close_time,closes_at)into open_time,close_time from public.professional_hours where business_id=p_business and professional_id=p_professional and weekday=day;
 if not found then open_time=greatest(settings.open_start,person."start");close_time=least(settings.open_end,person."end");end if;
 if local_start::time<open_time or(finish at time zone 'America/Sao_Paulo')::date<>local_start::date or(finish at time zone 'America/Sao_Paulo')::time>close_time then return false;end if;
 if person.break_start is not null and tstzrange(p_start,finish,'[)')&&tstzrange((local_start::date+person.break_start)at time zone 'America/Sao_Paulo',(local_start::date+person.break_end)at time zone 'America/Sao_Paulo','[)')then return false;end if;
 if exists(select 1 from public.professional_breaks b where b.business_id=p_business and b.professional_id=p_professional and b.weekday=day and tstzrange(p_start,finish,'[)')&&tstzrange((local_start::date+b.starts_at)at time zone 'America/Sao_Paulo',(local_start::date+b.ends_at)at time zone 'America/Sao_Paulo','[)'))then return false;end if;
 if exists(select 1 from public.blocked_times b where b.business_id=p_business and b.professional_id=p_professional and tstzrange(p_start,finish,'[)')&&tstzrange(b."start",b."end",'[)'))then return false;end if;
 if exists(select 1 from public.appointments a where a.business_id=p_business and a.professional_id=p_professional and(a.id<>p_exclude or p_exclude is null)and a.status in('confirmed','pending','in_progress','completed')and tstzrange(p_start,finish,'[)')&&tstzrange(a."start",a.occupied_end,'[)'))then return false;end if;
 return true;end;$$;
revoke all on function private.slot_available(uuid,uuid,uuid[],timestamptz,uuid,boolean)from public,anon,authenticated;
grant execute on function private.slot_available(uuid,uuid,uuid[],timestamptz,uuid,boolean)to service_role;

create function public.book_appointment(p_business_id uuid,p_service_ids uuid[],p_professional_id uuid,p_start timestamptz,p_name text,p_phone text,p_email text default null,p_reminder boolean default false)
returns jsonb language plpgsql set search_path='' as $$
declare person uuid;tenant uuid;customer uuid;appointment uuid;duration_minutes integer;total numeric;buffer_minutes integer;token text;begin
 if p_phone!~'^[1-9][0-9](9[0-9]{8}|[2-5][0-9]{7})$'or length(trim(p_name))<3 or length(p_name)>100 then raise exception 'invalid customer';end if;
 select tenant_id into tenant from public.businesses where id=p_business_id;
 if not found then raise exception 'unknown business';end if;
 -- Business transaction lock serializes professional assignment, reservations and blocks. Exclusion constraint is independent defense.
 perform pg_advisory_xact_lock(hashtextextended(p_business_id::text,0));
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
revoke all on function public.book_appointment(uuid,uuid[],uuid,timestamptz,text,text,text,boolean)from public,anon,authenticated;
grant execute on function public.book_appointment(uuid,uuid[],uuid,timestamptz,text,text,text,boolean)to service_role;

create function public.get_booking(p_token text)returns jsonb language plpgsql set search_path='' as $$
declare appointment public.appointments;begin
 if p_token!~'^[a-f0-9]{64}$'then return null;end if;
 select * into appointment from public.appointments where token_hash=extensions.digest(p_token,'sha256');
 if not found then return null;end if;
 return jsonb_build_object('appointment',private.appointment_json(appointment.id)||jsonb_build_object('token',p_token),
 'business',(select to_jsonb(b)from public.businesses b where b.id=appointment.business_id),
 'services',(select jsonb_agg(to_jsonb(s))from public.services s join public.appointment_services a on a.business_id=s.business_id and a.service_id=s.id where a.business_id=appointment.business_id and a.appointment_id=appointment.id),
 'professional',(select to_jsonb(p)-'phone'-'user_id'from public.professionals p where p.business_id=appointment.business_id and p.id=appointment.professional_id));end;$$;
revoke all on function public.get_booking(text)from public,anon,authenticated;
grant execute on function public.get_booking(text)to service_role;
create function public.manage_booking(p_token text,p_action text,p_start timestamptz default null,p_professional_id uuid default null)returns jsonb language plpgsql set search_path='' as $$
declare appointment public.appointments;settings public.business_settings;services uuid[];person uuid;duration_minutes integer;begin
 select * into appointment from public.appointments where token_hash=extensions.digest(p_token,'sha256');
 if not found then raise exception 'unknown booking';end if;
 perform pg_advisory_xact_lock(hashtextextended(appointment.business_id::text,0));
 select * into appointment from public.appointments where id=appointment.id for update;
 if p_action='cancel'and appointment.status='cancelled'then return private.appointment_json(appointment.id)||jsonb_build_object('token',p_token);end if;
 select * into settings from public.business_settings where business_id=appointment.business_id;
 if appointment.status not in('confirmed','pending')or appointment."start"<now()+make_interval(hours=>settings.cancellation_hours)then raise exception 'cancellation policy';end if;
 if p_action='cancel'then update public.appointments set status='cancelled'where id=appointment.id;
 elsif p_action='reschedule'then
  select array_agg(service_id),sum(duration)into services,duration_minutes from public.appointment_services where business_id=appointment.business_id and appointment_id=appointment.id;
  select id into person from public.professionals where business_id=appointment.business_id and(p_professional_id is null or id=p_professional_id)and private.slot_available(appointment.business_id,id,services,p_start,appointment.id)order by name limit 1;
  if person is null then raise exception 'unavailable';end if;
  update public.appointments set professional_id=person,"start"=p_start,"end"=p_start+make_interval(mins=>duration_minutes),occupied_end=p_start+make_interval(mins=>duration_minutes+settings.buffer)where id=appointment.id;
 else raise exception 'invalid action';end if;
 return private.appointment_json(appointment.id)||jsonb_build_object('token',p_token);end;$$;
revoke all on function public.manage_booking(text,text,timestamptz,uuid)from public,anon,authenticated;
grant execute on function public.manage_booking(text,text,timestamptz,uuid)to service_role;

create function private.snake_json(p_input jsonb)returns jsonb language sql immutable set search_path='' as $$
 select coalesce(jsonb_object_agg(lower(regexp_replace(key,'([A-Z])','_\1','g')),value),'{}')from jsonb_each(p_input);
$$;
revoke all on function private.snake_json(jsonb)from public,anon,authenticated;
grant execute on function private.snake_json(jsonb)to service_role;

create function public.workspace_mutation(p_business_id uuid,p_user_id uuid,p_entity text,p_action text,p_data jsonb)
returns void language plpgsql set search_path='' as $$
declare tenant uuid;member_role text;record_id uuid;payload jsonb;previous jsonb;services uuid[];person uuid;customer uuid;duration_minutes integer;total numeric;buffer_minutes integer;target_business uuid;record_table text;same_services boolean;same_slot boolean;paid numeric;service_record public.services;person_record public.professionals;customer_record public.customers;appointment_record public.appointments;block_record public.blocked_times;payment_record public.payments;business_record public.businesses;settings_record public.business_settings;begin
 select role,tenant_id into member_role,tenant from public.business_members where business_id=p_business_id and user_id=p_user_id and active;
 if not found then raise exception 'forbidden';end if;
 if p_entity in('services','professionals','business','settings','payments')and member_role not in('owner','admin','manager')then raise exception 'forbidden';end if;
 if member_role='professional'then raise exception 'forbidden';end if;
 if p_action not in('create','update','delete')then raise exception 'invalid action';end if;
 perform pg_advisory_xact_lock(hashtextextended(p_business_id::text,0));
 record_id=coalesce((p_data->>'id')::uuid,gen_random_uuid());
 record_table=case p_entity when 'services'then 'services'when 'professionals'then 'professionals'when 'customers'then 'customers'when 'appointments'then 'appointments'when 'blockedTimes'then 'blocked_times'when 'payments'then 'payments'else null end;
 if record_table is not null then
  execute format('select business_id from public.%I where id=$1',record_table)into target_business using record_id;
  if target_business is not null and(target_business<>p_business_id or p_action='create')then raise exception 'identifier already exists or forbidden';end if;
 end if;
 payload=private.snake_json(p_data)-'business_id'-'tenant_id'-'id'-'created_at'-'updated_at'-'token_hash'-'occupied_end';
 if p_entity='services'then select to_jsonb(s)into previous from public.services s where business_id=p_business_id and id=record_id;
 elsif p_entity='professionals'then select to_jsonb(p)into previous from public.professionals p where business_id=p_business_id and id=record_id;
 elsif p_entity='customers'then select to_jsonb(c)into previous from public.customers c where business_id=p_business_id and id=record_id;
 elsif p_entity='appointments'then select private.appointment_json(record_id)into previous; if previous->>'business_id'<>p_business_id::text then raise exception 'forbidden';end if;
 elsif p_entity='blockedTimes'then select to_jsonb(b)into previous from public.blocked_times b where business_id=p_business_id and id=record_id;
 elsif p_entity='payments'then select to_jsonb(p)into previous from public.payments p where business_id=p_business_id and id=record_id;
 elsif p_entity='business'then select to_jsonb(b)into previous from public.businesses b where id=p_business_id;
 elsif p_entity='settings'then select to_jsonb(s)into previous from public.business_settings s where business_id=p_business_id;
 else raise exception 'invalid entity';end if;
 if p_action<>'create'and previous is null then raise exception 'record not found';end if;
 if p_action='delete'then
  if p_entity='services'then update public.services set active=false where business_id=p_business_id and id=record_id;
  elsif p_entity='professionals'then update public.professionals set active=false where business_id=p_business_id and id=record_id;
  elsif p_entity='appointments'then update public.appointments set status='cancelled'where business_id=p_business_id and id=record_id;
  elsif p_entity='customers'then delete from public.customers where business_id=p_business_id and id=record_id;
  elsif p_entity='blockedTimes'then delete from public.blocked_times where business_id=p_business_id and id=record_id;
  elsif p_entity='payments'then delete from public.payments where business_id=p_business_id and id=record_id;
  else raise exception 'invalid delete';end if;
  return;
 end if;
 payload=coalesce(previous,'{}')||payload||jsonb_build_object('id',record_id,'tenant_id',tenant,'business_id',p_business_id);
 if p_entity='services'then
  service_record=jsonb_populate_record(null::public.services,jsonb_build_object('description','','image','','active',true,'created_at',now(),'updated_at',now())||payload);
  insert into public.services values(service_record.*)on conflict(id)do update set name=excluded.name,category=excluded.category,description=excluded.description,duration=excluded.duration,price=excluded.price,image=excluded.image,active=excluded.active;
  if p_data?'professionalIds'then
   delete from public.professional_services where business_id=p_business_id and service_id=record_id;
   insert into public.professional_services(tenant_id,business_id,professional_id,service_id)select tenant,p_business_id,value::uuid,record_id from jsonb_array_elements_text(payload->'professional_ids');
  end if;
 elsif p_entity='professionals'then
  person_record=jsonb_populate_record(null::public.professionals,jsonb_build_object('photo','','phone','','specialties','[]'::jsonb,'commission',0,'active',true,'days','[1,2,3,4,5,6]'::jsonb,'start','09:00','end','18:00','created_at',now(),'updated_at',now())||payload||jsonb_build_object('break_start',nullif(payload->>'break_start',''),'break_end',nullif(payload->>'break_end','')));
  insert into public.professionals values(person_record.*)on conflict(id)do update set name=excluded.name,photo=excluded.photo,phone=excluded.phone,specialties=excluded.specialties,commission=excluded.commission,active=excluded.active,days=excluded.days,"start"=excluded."start","end"=excluded."end",break_start=excluded.break_start,break_end=excluded.break_end;
 elsif p_entity='customers'then
  customer_record=jsonb_populate_record(null::public.customers,jsonb_build_object('visits',0,'total_spent',0,'created_at',now(),'updated_at',now())||payload);
  insert into public.customers values(customer_record.*)on conflict(id)do update set name=excluded.name,phone=excluded.phone,email=excluded.email;
 elsif p_entity='appointments'then
  select array_agg(value::uuid)into services from jsonb_array_elements_text(payload->'service_ids');
  person=(payload->>'professional_id')::uuid;
  same_services=p_action='update'and services @> array(select jsonb_array_elements_text(previous->'service_ids')::uuid)and services <@ array(select jsonb_array_elements_text(previous->'service_ids')::uuid);
  if p_action='update'and not coalesce(same_services,false)and exists(select 1 from public.payments where business_id=p_business_id and appointment_id=record_id)then raise exception 'appointment has payments';end if;
  same_slot=same_services and(payload->>'start')::timestamptz=(previous->>'start')::timestamptz and person=(previous->>'professional_id')::uuid;
  if coalesce(payload->>'status','confirmed')not in('cancelled','no_show')and not coalesce(same_slot,false)and not private.slot_available(p_business_id,person,services,(payload->>'start')::timestamptz,case when p_action='update'then record_id else null end,true)then raise exception 'unavailable';end if;
  if same_services then select sum(duration)into duration_minutes from public.appointment_services where business_id=p_business_id and appointment_id=record_id;total=(previous->>'price')::numeric;
  else select sum(duration),sum(price)into duration_minutes,total from public.services where business_id=p_business_id and id=any(services)and active;end if;
  if duration_minutes is null then raise exception 'invalid services';end if;
  select buffer into buffer_minutes from public.business_settings where business_id=p_business_id;
  customer=(payload->>'customer_id')::uuid;
  if customer is null then
   insert into public.customers(tenant_id,business_id,name,phone)values(tenant,p_business_id,payload->>'customer_name',payload->>'customer_phone')on conflict(business_id,phone)do update set updated_at=now()returning id into customer;
  end if;
  appointment_record=jsonb_populate_record(null::public.appointments,jsonb_build_object('status','confirmed','reminder',false,'created_at',now(),'updated_at',now())||payload||jsonb_build_object('customer_id',customer,'price',total,'end',(payload->>'start')::timestamptz+make_interval(mins=>duration_minutes),'occupied_end',case when same_slot then (select occupied_end from public.appointments where business_id=p_business_id and id=record_id)else (payload->>'start')::timestamptz+make_interval(mins=>duration_minutes+buffer_minutes)end,'token_hash',case when p_action='update'then (select token_hash from public.appointments where business_id=p_business_id and id=record_id)else extensions.digest(extensions.gen_random_bytes(32),'sha256')end));
  insert into public.appointments values(appointment_record.*)on conflict(id)do update set customer_id=excluded.customer_id,professional_id=excluded.professional_id,customer_name=excluded.customer_name,customer_phone=excluded.customer_phone,"start"=excluded."start","end"=excluded."end",occupied_end=excluded.occupied_end,price=excluded.price,status=excluded.status,reminder=excluded.reminder;
  if not coalesce(same_services,false)then
   delete from public.appointment_services where business_id=p_business_id and appointment_id=record_id;
   insert into public.appointment_services(tenant_id,business_id,appointment_id,service_id,duration,price)select tenant,p_business_id,record_id,id,duration,price from public.services where business_id=p_business_id and id=any(services);
  end if;
 elsif p_entity='blockedTimes'then
  block_record=jsonb_populate_record(null::public.blocked_times,jsonb_build_object('created_at',now(),'updated_at',now())||payload);
  if exists(select 1 from public.appointments where business_id=p_business_id and professional_id=block_record.professional_id and status in('confirmed','pending','in_progress','completed')and tstzrange("start",occupied_end,'[)')&&tstzrange(block_record."start",block_record."end",'[)'))then raise exception 'unavailable';end if;
  insert into public.blocked_times values(block_record.*)on conflict(id)do update set professional_id=excluded.professional_id,"start"=excluded."start","end"=excluded."end",reason=excluded.reason;
 elsif p_entity='payments'then
  payment_record=jsonb_populate_record(null::public.payments,jsonb_build_object('created_at',now(),'updated_at',now())||payload);
  if p_action='update'and payment_record.appointment_id<>(previous->>'appointment_id')::uuid then raise exception 'payment appointment is immutable';end if;
  select * into appointment_record from public.appointments where business_id=p_business_id and id=payment_record.appointment_id for update;
  if not found or appointment_record.status<>'completed'then raise exception 'complete appointment before payment';end if;
  select coalesce(sum(amount),0)into paid from public.payments where business_id=p_business_id and appointment_id=payment_record.appointment_id and id<>record_id;
  if paid+payment_record.amount>appointment_record.price then raise exception 'payment exceeds remaining balance';end if;
  insert into public.payments values(payment_record.*)on conflict(id)do update set amount=excluded.amount,method=excluded.method;
 elsif p_entity='business'then
  business_record=jsonb_populate_record(null::public.businesses,payload||jsonb_build_object('id',p_business_id));
  update public.businesses set name=business_record.name,category=business_record.category,description=business_record.description,address=business_record.address,phone=business_record.phone,instagram=business_record.instagram,cover=business_record.cover,logo=business_record.logo,color=business_record.color,amenities=business_record.amenities,cnpj=business_record.cnpj,photos=business_record.photos where id=p_business_id;
 elsif p_entity='settings'then
  settings_record=jsonb_populate_record(null::public.business_settings,payload);
  update public.business_settings set min_notice=settings_record.min_notice,max_days=settings_record.max_days,buffer=settings_record.buffer,cancellation_hours=settings_record.cancellation_hours,open_days=settings_record.open_days,open_start=settings_record.open_start,open_end=settings_record.open_end,notifications=settings_record.notifications where business_id=p_business_id;
 end if;
 update public.customers c set visits=(select count(*)from public.appointments a where a.business_id=p_business_id and a.customer_id=c.id and a.status='completed'),last_visit=(select max(a."start")from public.appointments a where a.business_id=p_business_id and a.customer_id=c.id and a.status='completed'),total_spent=coalesce((select sum(p.amount)from public.payments p join public.appointments a on a.business_id=p.business_id and a.id=p.appointment_id where a.business_id=p_business_id and a.customer_id=c.id),0)where c.business_id=p_business_id;
 insert into public.commissions(tenant_id,business_id,appointment_id,professional_id,amount)select tenant,p_business_id,a.id,a.professional_id,a.price*p.commission/100 from public.appointments a join public.professionals p on p.business_id=a.business_id and p.id=a.professional_id where a.business_id=p_business_id and a.status='completed'on conflict(business_id,appointment_id,professional_id)do nothing;
end;$$;
revoke all on function public.workspace_mutation(uuid,uuid,text,text,jsonb)from public,anon,authenticated;
grant execute on function public.workspace_mutation(uuid,uuid,text,text,jsonb)to service_role;

create function public.create_workspace(p_user_id uuid,p_slug text,p_input jsonb)returns text language plpgsql set search_path='' as $$
declare tenant uuid;business uuid;person uuid;service uuid;professional_name text;service_input jsonb;days integer[];begin
 select array_agg(value::integer)into days from jsonb_array_elements_text(p_input->'openDays');
 insert into public.tenants(name)values(p_input->>'name')returning id into tenant;
 insert into public.businesses(tenant_id,slug,name,category,description,cover)values(tenant,p_slug,p_input->>'name',p_input->>'category','Seu próximo momento de cuidado começa aqui.',coalesce(p_input->>'cover',''))returning id into business;
 insert into public.business_members(tenant_id,business_id,user_id,role)values(tenant,business,p_user_id,'owner');
 insert into public.business_settings(tenant_id,business_id,open_days,open_start,open_end)values(tenant,business,days,(p_input->>'openStart')::time,(p_input->>'openEnd')::time);
 for professional_name in select jsonb_array_elements_text(p_input->'professionalNames')loop
  insert into public.professionals(tenant_id,business_id,name,days,"start","end")values(tenant,business,professional_name,days,(p_input->>'openStart')::time,(p_input->>'openEnd')::time)returning id into person;
 end loop;
 for service_input in select jsonb_array_elements(p_input->'services')loop
  insert into public.services(tenant_id,business_id,name,category,duration,price)values(tenant,business,service_input->>'name',p_input->>'category',(service_input->>'duration')::integer,(service_input->>'price')::numeric)returning id into service;
  insert into public.professional_services(tenant_id,business_id,professional_id,service_id)select tenant,business,id,service from public.professionals where business_id=business;
 end loop;
 return p_slug;end;$$;
revoke all on function public.create_workspace(uuid,text,jsonb)from public,anon,authenticated;
grant execute on function public.create_workspace(uuid,text,jsonb)to service_role;
