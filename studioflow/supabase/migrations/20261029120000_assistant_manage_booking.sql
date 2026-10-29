-- A recepcionista do WhatsApp cancela ou remarca pelo id do agendamento: o
-- token do comprovante só existe como hash. O telefone verificado da conversa
-- precisa ser o do agendamento, e valem as mesmas regras do comprovante.
create or replace function public.assistant_manage_booking(
  p_business_id uuid,
  p_appointment_id uuid,
  p_phone text,
  p_action text,
  p_start timestamptz default null,
  p_professional_id uuid default null
) returns jsonb
language plpgsql
set search_path to ''
as $function$
declare appointment public.appointments;settings public.business_settings;services uuid[];person uuid;duration_minutes integer;
begin
  perform pg_advisory_xact_lock(hashtextextended(p_business_id::text,0));
  perform private.expire_holds(p_business_id);
  select * into appointment from public.appointments
    where id=p_appointment_id and business_id=p_business_id for update;
  if not found then raise exception 'unknown booking';end if;
  if right(regexp_replace(appointment.customer_phone,'\D','','g'),11)
     <> right(regexp_replace(coalesce(p_phone,''),'\D','','g'),11)
     or length(regexp_replace(coalesce(p_phone,''),'\D','','g'))<10
  then raise exception 'unknown booking';end if;
  if p_action='cancel'and appointment.status='cancelled'then return private.appointment_json(appointment.id);end if;
  select * into settings from public.business_settings where business_id=appointment.business_id;
  if appointment.status not in('confirmed','pending')or appointment."start"<now()+make_interval(hours=>settings.cancellation_hours)then raise exception 'cancellation policy';end if;
  if p_action='reschedule'and appointment.deposit_status='pending'then raise exception 'deposit pending';end if;
  if p_action='cancel'then update public.appointments set status='cancelled'where id=appointment.id;
  elsif p_action='reschedule'then
    select array_agg(service_id),sum(duration)into services,duration_minutes from public.appointment_services where business_id=appointment.business_id and appointment_id=appointment.id;
    if private.customer_busy(appointment.business_id,appointment.customer_phone,p_start,duration_minutes,appointment.id)then raise exception 'customer busy';end if;
    select id into person from public.professionals where business_id=appointment.business_id and(p_professional_id is null or id=p_professional_id)and private.slot_available(appointment.business_id,id,services,p_start,appointment.id)order by name limit 1;
    if person is null then raise exception 'unavailable';end if;
    update public.appointments set professional_id=person,"start"=p_start,"end"=p_start+make_interval(mins=>duration_minutes),occupied_end=p_start+make_interval(mins=>duration_minutes+settings.buffer)where id=appointment.id;
  else raise exception 'invalid action';end if;
  return private.appointment_json(appointment.id);
end;$function$;
revoke all on function public.assistant_manage_booking(uuid,uuid,text,text,timestamptz,uuid)from public,anon,authenticated;
grant execute on function public.assistant_manage_booking(uuid,uuid,text,text,timestamptz,uuid)to service_role;
