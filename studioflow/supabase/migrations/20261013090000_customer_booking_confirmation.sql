-- Immediate customer acknowledgement is separate from optional future reminders.
-- Never replay old history or uncertain provider outcomes.
alter table public.appointment_whatsapp_notices
  drop constraint appointment_whatsapp_notices_kind_check;
alter table public.appointment_whatsapp_notices
  add constraint appointment_whatsapp_notices_kind_check
  check(kind in ('customer_reminder','professional_new','customer_booking'));
alter table public.appointment_whatsapp_notices add column provider_message_id text;

create or replace function public.claim_appointment_notice(p_id uuid, p_kind text, p_start timestamptz)
returns boolean language plpgsql security invoker set search_path='' as $$
declare claimed uuid;
begin
  insert into public.appointment_whatsapp_notices(appointment_id,business_id,tenant_id,kind,appointment_start)
  select a.id,a.business_id,a.tenant_id,p_kind,a.start
  from public.appointments a join public.business_settings s on s.business_id=a.business_id
  join public.businesses b on b.id=a.business_id and b.tenant_id=a.tenant_id
  where a.id=p_id and a.start=p_start
    and ((p_kind='customer_reminder' and a.status='confirmed' and a.reminder and s.notifications
      and a.start between now()+interval '15 minutes' and now()+interval '2 hours'
      and a.created_at<=now()-interval '10 minutes')
      or (p_kind='professional_new' and a.status in ('confirmed','pending') and s.notify_professionals and a.start>now())
      or (p_kind='customer_booking' and a.status in ('confirmed','pending') and s.notifications
        and a.start>now() and a.created_at>=now()-interval '10 minutes'
        and a.booking_channel<>'assistant_whatsapp'))
  on conflict do nothing returning appointment_id into claimed;
  return claimed is not null;
end $$;
revoke all on function public.claim_appointment_notice(uuid,text,timestamptz) from public,anon,authenticated;
grant execute on function public.claim_appointment_notice(uuid,text,timestamptz) to service_role;
