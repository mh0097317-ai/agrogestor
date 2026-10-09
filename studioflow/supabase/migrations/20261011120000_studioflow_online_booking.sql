-- Additive, opt-out per establishment. Existing rows and new sign-ups keep their behavior.
alter table public.business_settings
  add column online_booking_enabled boolean not null default true;

comment on column public.business_settings.online_booking_enabled is
  'Enables new reservations from the public website only; internal and receptionist channels remain independent.';

-- Retain business_settings RLS, tenant foreign keys and admin_update policy.
-- Do not change the shared book_appointment RPC: other trusted channels use it too.
create function public.book_public_appointment(
  p_business_id uuid, p_service_ids uuid[], p_professional_id uuid,
  p_start timestamptz, p_name text, p_phone text,
  p_email text default null, p_reminder boolean default false
) returns jsonb language plpgsql set search_path='' as $$
declare enabled boolean;
begin
  perform pg_advisory_xact_lock(hashtextextended(p_business_id::text, 0));
  -- Keep the setting locked until the reservation commits. A concurrent disable
  -- waits for this transaction, or commits first and prevents the reservation.
  select online_booking_enabled into enabled
    from public.business_settings where business_id=p_business_id for share;
  if enabled is distinct from true then
    raise exception 'online booking disabled';
  end if;
  return public.book_appointment(
    p_business_id, p_service_ids, p_professional_id, p_start,
    p_name, p_phone, p_email, p_reminder
  );
end;
$$;

revoke all on function public.book_public_appointment(uuid,uuid[],uuid,timestamptz,text,text,text,boolean)
  from public, anon, authenticated;
grant execute on function public.book_public_appointment(uuid,uuid[],uuid,timestamptz,text,text,text,boolean)
  to service_role;
