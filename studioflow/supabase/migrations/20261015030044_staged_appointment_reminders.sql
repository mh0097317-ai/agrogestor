-- Three consented reminders. Keep the legacy 2h journal shared with n8n.
create table public.appointment_reminder_steps (
  appointment_id uuid not null,
  business_id uuid not null,
  tenant_id uuid not null,
  appointment_start timestamptz not null,
  step_minutes integer not null check (step_minutes in (720,120,60)),
  status text not null default 'claimed' check (status in ('claimed','sent','failed')),
  created_at timestamptz not null default now(),
  sent_at timestamptz,
  primary key (appointment_id,appointment_start,step_minutes),
  foreign key (business_id,appointment_id) references public.appointments(business_id,id),
  foreign key (tenant_id,business_id) references public.businesses(tenant_id,id)
);
alter table public.appointment_reminder_steps enable row level security;
revoke all on public.appointment_reminder_steps from public,anon,authenticated;
grant select,insert,update on public.appointment_reminder_steps to service_role;

create function public.claim_staged_appointment_reminder(p_id uuid,p_start timestamptz,p_minutes integer)
returns boolean language plpgsql security invoker set search_path='' as $$
declare a public.appointments; claimed uuid;
begin
  if p_minutes not in (720,120,60) then return false; end if;
  select ap.* into a from public.appointments ap
  join public.business_settings s on s.business_id=ap.business_id
  where ap.id=p_id and ap.start=p_start and ap.status='confirmed'
    and ap.reminder and s.notifications and ap.created_at<=now()-interval '10 minutes'
    and ap.start between now()+make_interval(mins=>p_minutes-15) and now()+make_interval(mins=>p_minutes);
  if not found then return false; end if;
  -- A legacy workflow and the new scheduler cannot both claim the 2h message.
  if p_minutes=120 and not public.claim_appointment_notice(p_id,'customer_reminder',p_start)
    then return false; end if;
  insert into public.appointment_reminder_steps(appointment_id,business_id,tenant_id,appointment_start,step_minutes)
    values(a.id,a.business_id,a.tenant_id,a.start,p_minutes)
    on conflict do nothing returning appointment_id into claimed;
  return claimed is not null;
end $$;
revoke all on function public.claim_staged_appointment_reminder(uuid,timestamptz,integer) from public,anon,authenticated;
grant execute on function public.claim_staged_appointment_reminder(uuid,timestamptz,integer) to service_role;

create function public.due_staged_appointment_reminders()
returns table(id uuid,business_id uuid,start timestamptz,step_minutes integer)
language sql security invoker set search_path='' as $$
  select a.id,a.business_id,a.start,v.minutes from public.appointments a
  join public.business_settings s on s.business_id=a.business_id
  cross join (values(720),(120),(60)) v(minutes)
  where a.status='confirmed' and a.reminder and s.notifications
    and a.created_at<=now()-interval '10 minutes'
    and a.start between now()+make_interval(mins=>v.minutes-15) and now()+make_interval(mins=>v.minutes)
    and not exists(select 1 from public.appointment_reminder_steps r where r.appointment_id=a.id
      and r.appointment_start=a.start and r.step_minutes=v.minutes)
    and (v.minutes<>120 or not exists(select 1 from public.appointment_whatsapp_notices n
      where n.appointment_id=a.id and n.appointment_start=a.start and n.kind='customer_reminder'))
  order by a.start,v.minutes limit 30;
$$;
revoke all on function public.due_staged_appointment_reminders() from public,anon,authenticated;
grant execute on function public.due_staged_appointment_reminders() to service_role;
