-- Avisos por e-mail ao cliente (Resend): confirmação logo após marcar e lembrete na véspera.
-- Complementa o WhatsApp, que lembra perto do horário. Só para quem informou e-mail.
create table public.appointment_email_notices (
  appointment_id uuid not null references public.appointments(id) on delete cascade,
  business_id uuid not null references public.businesses(id) on delete cascade,
  kind text not null check (kind in ('confirmation','day_before')),
  appointment_start timestamptz not null,
  status text not null default 'claimed' check (status in ('claimed','sent','failed')),
  created_at timestamptz not null default now(),
  sent_at timestamptz,
  primary key (appointment_id, kind, appointment_start)
);
alter table public.appointment_email_notices enable row level security;
revoke all on public.appointment_email_notices from public, anon, authenticated;
grant select, insert, update on public.appointment_email_notices to service_role;

alter table public.business_settings add column if not exists email_notices boolean not null default true;

create or replace function private.email_notice_due(p_kind text, a public.appointments, s public.business_settings)
returns boolean language sql stable set search_path = '' as $$
  select s.email_notices and a.status in ('confirmed','pending') and a."start" > now() + interval '1 hour'
    and case p_kind
      when 'confirmation' then a.created_at >= now() - interval '1 day' and a.created_at <= now() - interval '2 minutes'
      when 'day_before' then a.status = 'confirmed' and a."start" between now() + interval '18 hours' and now() + interval '30 hours'
        and a.created_at <= now() - interval '6 hours'
      else false end;
$$;
revoke all on function private.email_notice_due(text, public.appointments, public.business_settings) from public, anon, authenticated;
grant execute on function private.email_notice_due(text, public.appointments, public.business_settings) to service_role;

create or replace function public.due_email_notices()
returns table(id uuid, business_id uuid, start timestamptz, kind text, email text)
language sql security invoker set search_path = '' as $$
  select a.id, a.business_id, a."start", k.kind, c.email
  from public.appointments a
  join public.business_settings s on s.business_id = a.business_id
  join public.customers c on c.id = a.customer_id and c.business_id = a.business_id
  cross join (values ('confirmation'), ('day_before')) k(kind)
  where c.email is not null and c.email ~ '^[^@\s]+@[^@\s]+\.[^@\s]+$'
    and private.email_notice_due(k.kind, a, s)
    and not exists (select 1 from public.appointment_email_notices n
      where n.appointment_id = a.id and n.kind = k.kind and n.appointment_start = a."start")
  order by a."start" limit 20;
$$;
revoke all on function public.due_email_notices() from public, anon, authenticated;
grant execute on function public.due_email_notices() to service_role;

create or replace function public.claim_email_notice(p_id uuid, p_kind text, p_start timestamptz)
returns boolean language plpgsql security invoker set search_path = '' as $$
declare claimed uuid;
begin
  insert into public.appointment_email_notices(appointment_id, business_id, kind, appointment_start)
  select a.id, a.business_id, p_kind, a."start"
  from public.appointments a join public.business_settings s on s.business_id = a.business_id
  where a.id = p_id and a."start" = p_start and private.email_notice_due(p_kind, a, s)
  on conflict do nothing returning appointment_id into claimed;
  return claimed is not null;
end $$;
revoke all on function public.claim_email_notice(uuid, text, timestamptz) from public, anon, authenticated;
grant execute on function public.claim_email_notice(uuid, text, timestamptz) to service_role;
