-- Atendimento sem baixa: 15 minutos depois do horário, se ninguém iniciou o
-- atendimento na plataforma, o profissional recebe no WhatsApp a pergunta
-- "atendeu?". Duas horas sem resposta, o dono recebe a lista. Nada muda de
-- status sozinho.
alter table public.appointment_whatsapp_notices
  drop constraint appointment_whatsapp_notices_kind_check;
alter table public.appointment_whatsapp_notices
  add constraint appointment_whatsapp_notices_kind_check
  check(kind in ('customer_reminder','professional_new','customer_booking','professional_checkup','owner_unsettled'));

alter table public.business_settings
  add column attendance_check boolean not null default true;

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
        and a.booking_channel<>'assistant_whatsapp')
      or (p_kind='professional_checkup' and a.status='confirmed' and s.attendance_check
        and a.start between now()-interval '3 hours' and now()-interval '15 minutes')
      or (p_kind='owner_unsettled' and a.status='confirmed' and s.attendance_check
        and exists(select 1 from public.appointment_whatsapp_notices n
          where n.appointment_id=a.id and n.kind='professional_checkup' and n.appointment_start=a.start
            and n.status='sent' and n.sent_at<=now()-interval '2 hours')))
  on conflict do nothing returning appointment_id into claimed;
  return claimed is not null;
end $$;
revoke all on function public.claim_appointment_notice(uuid,text,timestamptz) from public,anon,authenticated;
grant execute on function public.claim_appointment_notice(uuid,text,timestamptz) to service_role;

-- Horários confirmados que já começaram há 15 minutos e ninguém iniciou.
create function public.due_attendance_checks()
returns table(id uuid,business_id uuid,slug text)
language sql security invoker set search_path='' as $$
  select a.id,a.business_id,b.slug from public.appointments a
  join public.business_settings s on s.business_id=a.business_id
  join public.businesses b on b.id=a.business_id and b.tenant_id=a.tenant_id
  join public.professionals p on p.id=a.professional_id and p.business_id=a.business_id and p.tenant_id=a.tenant_id
  where a.status='confirmed' and s.attendance_check
    and a.start between now()-interval '3 hours' and now()-interval '15 minutes'
    and (p.phone<>'' or exists(select 1 from public.professional_whatsapp_links l
      where l.business_id=a.business_id and l.professional_id=a.professional_id and l.status='open' and l.phone<>''))
    and (exists(select 1 from public.whatsapp_links l where l.business_id=a.business_id and l.status='open')
      or exists(select 1 from public.professional_whatsapp_links l where l.business_id=a.business_id and l.professional_id=a.professional_id and l.status='open')
      or exists(select 1 from public.whatsapp_accounts l where l.business_id=a.business_id))
    and not exists(select 1 from public.appointment_whatsapp_notices n
      where n.appointment_id=a.id and n.kind='professional_checkup' and n.appointment_start=a.start)
  order by a.start limit 20;
$$;
revoke all on function public.due_attendance_checks() from public,anon,authenticated;
grant execute on function public.due_attendance_checks() to service_role;

-- Perguntas sem resposta há 2 horas: vão para o dono, uma lista por casa.
create function public.due_unsettled_owner_alerts()
returns table(id uuid,business_id uuid,slug text)
language sql security invoker set search_path='' as $$
  select a.id,a.business_id,b.slug from public.appointments a
  join public.business_settings s on s.business_id=a.business_id
  join public.businesses b on b.id=a.business_id and b.tenant_id=a.tenant_id
  join public.appointment_whatsapp_notices n on n.appointment_id=a.id and n.kind='professional_checkup'
    and n.appointment_start=a.start and n.status='sent' and n.sent_at<=now()-interval '2 hours'
  where a.status='confirmed' and s.attendance_check and a.start>=now()-interval '36 hours'
    and not exists(select 1 from public.appointment_whatsapp_notices o
      where o.appointment_id=a.id and o.kind='owner_unsettled' and o.appointment_start=a.start)
  order by a.business_id,a.start limit 50;
$$;
revoke all on function public.due_unsettled_owner_alerts() from public,anon,authenticated;
grant execute on function public.due_unsettled_owner_alerts() to service_role;

-- Resposta do profissional pelo link do WhatsApp. Só sai de "confirmado"
-- (ou de "em atendimento" para concluído/falta) e atualiza a ficha do cliente.
create function public.settle_attendance(p_id uuid, p_status text)
returns text language plpgsql security invoker set search_path='' as $$
declare hit record;
begin
  if p_status not in ('in_progress','completed','no_show') then return null; end if;
  update public.appointments a set status=p_status
  where a.id=p_id
    and (a.status='confirmed' or (a.status='in_progress' and p_status in ('completed','no_show')))
  returning a.business_id,a.customer_id into hit;
  if hit is null then return null; end if;
  update public.customers c set
    visits=(select count(*) from public.appointments x where x.business_id=hit.business_id and x.customer_id=c.id and x.status='completed'),
    last_visit=(select max(x."start") from public.appointments x where x.business_id=hit.business_id and x.customer_id=c.id and x.status='completed')
  where c.business_id=hit.business_id and c.id=hit.customer_id;
  return p_status;
end $$;
revoke all on function public.settle_attendance(uuid,text) from public,anon,authenticated;
grant execute on function public.settle_attendance(uuid,text) to service_role;
