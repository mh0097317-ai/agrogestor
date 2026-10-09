-- O mesmo cliente não marca dois horários ao mesmo tempo (página, comprovante e recepcionista).
-- A trava por profissional continua na exclusion constraint no_double_booking.

create or replace function private.customer_busy(p_business uuid, p_phone text, p_start timestamptz, p_minutes integer, p_exclude uuid default null)
returns boolean language sql stable set search_path = '' as $$
  select exists (
    select 1 from public.appointments a
    where a.business_id = p_business and a.customer_phone = p_phone
      and (p_exclude is null or a.id <> p_exclude)
      and a.status in ('confirmed', 'pending', 'in_progress')
      and tstzrange(a."start", a."end", '[)') && tstzrange(p_start, p_start + make_interval(mins => p_minutes), '[)')
  );
$$;
revoke all on function private.customer_busy(uuid, text, timestamptz, integer, uuid) from public, anon, authenticated;
grant execute on function private.customer_busy(uuid, text, timestamptz, integer, uuid) to service_role;

create or replace function public.book_appointment(p_business_id uuid,p_service_ids uuid[],p_professional_id uuid,p_start timestamptz,p_name text,p_phone text,p_email text default null,p_reminder boolean default false)
returns jsonb language plpgsql set search_path='' as $$
declare person uuid;tenant uuid;customer uuid;appointment uuid;duration_minutes integer;total numeric;buffer_minutes integer;token text;begin
 if p_phone!~'^[1-9][0-9](9[0-9]{8}|[2-5][0-9]{7})$'or length(trim(p_name))<3 or length(p_name)>100 then raise exception 'invalid customer';end if;
 select tenant_id into tenant from public.businesses where id=p_business_id;
 if not found then raise exception 'unknown business';end if;
 -- Business transaction lock serializes professional assignment, reservations and blocks. Exclusion constraint is independent defense.
 perform pg_advisory_xact_lock(hashtextextended(p_business_id::text,0));
 perform private.expire_holds(p_business_id);
 select sum(duration),sum(price)into duration_minutes,total from public.services where business_id=p_business_id and id=any(p_service_ids);
 if private.customer_busy(p_business_id,p_phone,p_start,coalesce(duration_minutes,0))then raise exception 'customer busy';end if;
 select id into person from public.professionals where business_id=p_business_id and active and(p_professional_id is null or id=p_professional_id)and private.slot_available(p_business_id,id,p_service_ids,p_start)order by name limit 1;
 if person is null then raise exception 'unavailable';end if;
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
  if private.customer_busy(appointment.business_id,appointment.customer_phone,p_start,duration_minutes,appointment.id)then raise exception 'customer busy';end if;
  select id into person from public.professionals where business_id=appointment.business_id and(p_professional_id is null or id=p_professional_id)and private.slot_available(appointment.business_id,id,services,p_start,appointment.id)order by name limit 1;
  if person is null then raise exception 'unavailable';end if;
  update public.appointments set professional_id=person,"start"=p_start,"end"=p_start+make_interval(mins=>duration_minutes),occupied_end=p_start+make_interval(mins=>duration_minutes+settings.buffer)where id=appointment.id;
 else raise exception 'invalid action';end if;
 return private.appointment_json(appointment.id)||jsonb_build_object('token',p_token);end;$$;
