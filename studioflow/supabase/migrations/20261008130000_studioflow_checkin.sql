-- Check-in na recepção: o cliente escaneia o QR Code e avisa que chegou.
-- Vale só para o atendimento de hoje, perto do horário marcado.

alter table public.appointments add column checked_in_at timestamptz;

-- Janela: de 3 horas antes do início até o fim do atendimento.
create function private.check_in_appointment(p_id uuid) returns jsonb language plpgsql set search_path = '' as $$
declare appointment public.appointments;
begin
  select * into appointment from public.appointments where id = p_id for update;
  if appointment.status not in ('pending', 'confirmed', 'in_progress') then raise exception 'not checkable'; end if;
  if now() < appointment."start" - interval '3 hours' or now() > appointment."end" then raise exception 'outside window'; end if;
  if appointment.checked_in_at is null then
    update public.appointments set checked_in_at = now() where id = p_id returning * into appointment;
  end if;
  return jsonb_build_object(
    'business_id', appointment.business_id,
    'start', appointment."start",
    'checked_in_at', appointment.checked_in_at,
    'customer', split_part(appointment.customer_name, ' ', 1),
    'professional', (select split_part(p.name, ' ', 1) from public.professionals p where p.business_id = appointment.business_id and p.id = appointment.professional_id)
  );
end; $$;
revoke all on function private.check_in_appointment(uuid) from public, anon, authenticated;
grant execute on function private.check_in_appointment(uuid) to service_role;

-- Pelo link do comprovante (o aparelho do cliente guarda o token).
create function public.check_in_by_token(p_token text) returns jsonb language plpgsql set search_path = '' as $$
declare found_id uuid;
begin
  if p_token !~ '^[a-f0-9]{64}$' then raise exception 'unknown booking'; end if;
  select id into found_id from public.appointments where token_hash = extensions.digest(p_token, 'sha256');
  if found_id is null then raise exception 'unknown booking'; end if;
  return private.check_in_appointment(found_id);
end; $$;
revoke all on function public.check_in_by_token(text) from public, anon, authenticated;
grant execute on function public.check_in_by_token(text) to service_role;

-- Pelo WhatsApp informado na recepção: o próximo atendimento de hoje dessa pessoa.
create function public.check_in_by_phone(p_business_id uuid, p_phone text) returns jsonb language plpgsql set search_path = '' as $$
declare found_id uuid;
begin
  if p_phone !~ '^[0-9]{10,13}$' then raise exception 'unknown booking'; end if;
  select a.id into found_id from public.appointments a
  where a.business_id = p_business_id and a.customer_phone = p_phone
    and a.status in ('pending', 'confirmed', 'in_progress')
    and a."start" - interval '3 hours' <= now() and a."end" >= now()
  order by abs(extract(epoch from (a."start" - now()))) limit 1;
  if found_id is null then raise exception 'unknown booking'; end if;
  return private.check_in_appointment(found_id);
end; $$;
revoke all on function public.check_in_by_phone(uuid, text) from public, anon, authenticated;
grant execute on function public.check_in_by_phone(uuid, text) to service_role;
