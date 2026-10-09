-- Existing notice journal, consent and sent receipts are preserved.
-- Backend only; no new client access and no replays of uncertain/failed deliveries.
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
      or (p_kind='professional_new' and a.status in ('confirmed','pending') and s.notify_professionals and a.start>now()))
  on conflict do nothing returning appointment_id into claimed;
  return claimed is not null;
end $$;
revoke all on function public.claim_appointment_notice(uuid,text,timestamptz) from public,anon,authenticated;
grant execute on function public.claim_appointment_notice(uuid,text,timestamptz) to service_role;

create or replace function public.due_appointment_reminders()
returns table(id uuid,business_id uuid,start timestamptz)
language sql security invoker set search_path='' as $$
  select a.id,a.business_id,a.start from public.appointments a
  join public.business_settings s on s.business_id=a.business_id
  join public.businesses b on b.id=a.business_id and b.tenant_id=a.tenant_id
  where a.status='confirmed' and a.reminder and s.notifications
    and a.start between now()+interval '15 minutes' and now()+interval '2 hours'
    and a.created_at<=now()-interval '10 minutes'
    and not exists(select 1 from public.appointment_whatsapp_notices n
      where n.appointment_id=a.id and n.kind='customer_reminder' and n.appointment_start=a.start)
  order by a.start limit 10;
$$;
revoke all on function public.due_appointment_reminders() from public,anon,authenticated;
grant execute on function public.due_appointment_reminders() to service_role;

-- A disconnected channel must not permanently lose a new-booking notification.
-- Only upcoming appointments created during the last day are recovered, never old history.
create function public.due_professional_booking_notices()
returns table(id uuid,business_id uuid,slug text)
language sql security invoker set search_path='' as $$
  select a.id,a.business_id,b.slug from public.appointments a
  join public.business_settings s on s.business_id=a.business_id
  join public.businesses b on b.id=a.business_id and b.tenant_id=a.tenant_id
  join public.professionals p on p.id=a.professional_id and p.business_id=a.business_id and p.tenant_id=a.tenant_id
  where a.status in ('confirmed','pending') and s.notify_professionals and a.start>now()
    and a.created_at>=now()-interval '24 hours'
    and (p.phone<>'' or exists(select 1 from public.professional_whatsapp_links l
      where l.business_id=a.business_id and l.professional_id=a.professional_id and l.status='open' and l.phone<>''))
    and (exists(select 1 from public.whatsapp_links l where l.business_id=a.business_id and l.status='open')
      or exists(select 1 from public.professional_whatsapp_links l where l.business_id=a.business_id and l.professional_id=a.professional_id and l.status='open')
      or exists(select 1 from public.whatsapp_accounts l where l.business_id=a.business_id))
    and not exists(select 1 from public.appointment_whatsapp_notices n
      where n.appointment_id=a.id and n.kind='professional_new' and n.appointment_start=a.start)
  order by a.created_at limit 10;
$$;
revoke all on function public.due_professional_booking_notices() from public,anon,authenticated;
grant execute on function public.due_professional_booking_notices() to service_role;
