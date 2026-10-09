-- Server-only delivery journal. Existing appointments and consent are preserved.
create table public.appointment_whatsapp_notices (
  appointment_id uuid not null references public.appointments(id),
  business_id uuid not null references public.businesses(id),
  tenant_id uuid not null references public.tenants(id),
  kind text not null check (kind in ('customer_reminder','professional_new')),
  appointment_start timestamptz not null,
  status text not null default 'claimed' check (status in ('claimed','sent','failed')),
  created_at timestamptz not null default now(),
  sent_at timestamptz,
  primary key (appointment_id, kind, appointment_start),
  foreign key (business_id,appointment_id) references public.appointments(business_id,id),
  foreign key (tenant_id,business_id) references public.businesses(tenant_id,id)
);
alter table public.appointment_whatsapp_notices enable row level security;
revoke all on public.appointment_whatsapp_notices from anon, authenticated;
grant select, insert, update on public.appointment_whatsapp_notices to service_role;

create function public.claim_appointment_notice(p_id uuid, p_kind text, p_start timestamptz)
returns boolean language plpgsql security definer set search_path='' as $$
declare claimed uuid;
begin
  insert into public.appointment_whatsapp_notices(appointment_id,business_id,tenant_id,kind,appointment_start)
  select a.id,a.business_id,a.tenant_id,p_kind,a.start
  from public.appointments a join public.business_settings s on s.business_id=a.business_id
  join public.businesses b on b.id=a.business_id and b.tenant_id=a.tenant_id
  where a.id=p_id and a.start=p_start
    and ((p_kind='customer_reminder' and a.status='confirmed' and a.reminder and s.notifications and a.start>now()
      and a.start<=now()+interval '2 hours' and a.start>=now()+interval '105 minutes')
      or (p_kind='professional_new' and a.status in ('confirmed','pending') and s.notify_professionals))
  on conflict do nothing returning appointment_id into claimed;
  return claimed is not null;
end $$;
revoke all on function public.claim_appointment_notice(uuid,text,timestamptz) from public,anon,authenticated;
grant execute on function public.claim_appointment_notice(uuid,text,timestamptz) to service_role;

create function public.verify_appointment_scheduler(p_secret text)
returns boolean language plpgsql security definer set search_path='' as $$
declare valid boolean;
begin
  select p_secret=decrypted_secret into valid from vault.decrypted_secrets
    where name='studioflow_appointment_scheduler' limit 1;
  return coalesce(valid,false);
end;
$$;
revoke all on function public.verify_appointment_scheduler(text) from public,anon,authenticated;
grant execute on function public.verify_appointment_scheduler(text) to service_role;

create function public.due_appointment_reminders()
returns table(id uuid,business_id uuid,start timestamptz)
language plpgsql security definer set search_path='' as $$
begin
  return query select a.id,a.business_id,a.start from public.appointments a
  join public.business_settings s on s.business_id=a.business_id
  where a.status='confirmed' and a.reminder and s.notifications
    and a.start between now()+interval '105 minutes' and now()+interval '2 hours'
    and not exists(select 1 from public.appointment_whatsapp_notices n
      where n.appointment_id=a.id and n.kind='customer_reminder' and n.appointment_start=a.start)
  order by a.start limit 10;
end $$;
revoke all on function public.due_appointment_reminders() from public,anon,authenticated;
grant execute on function public.due_appointment_reminders() to service_role;
