-- MWAPI serves Claude using the Anthropic Messages API. Preserve the current
-- encrypted provider credential as a backup when an admin changes providers.
alter table public.business_ai_credentials
  drop constraint business_ai_credentials_provider_check,
  add constraint business_ai_credentials_provider_check
    check (provider in ('anthropic', 'openai', 'mwapi')),
  add column fallback_provider text,
  add column fallback_model text,
  add column fallback_secret_enc text,
  add column fallback_key_hint text,
  add constraint business_ai_credentials_fallback_provider_check
    check (fallback_provider is null or fallback_provider in ('anthropic', 'openai', 'mwapi')),
  add constraint business_ai_credentials_fallback_key_hint_check
    check (fallback_key_hint is null or length(fallback_key_hint) <= 4),
  add constraint business_ai_credentials_fallback_complete_check
    check (
      (fallback_provider is null and fallback_model is null and fallback_secret_enc is null and fallback_key_hint is null)
      or
      (fallback_provider is not null and fallback_model is not null and fallback_secret_enc is not null and fallback_key_hint is not null)
    );

create or replace function public.platform_save_ai_key(
  p_business_id uuid,
  p_actor uuid,
  p_provider text,
  p_model text,
  p_secret text,
  p_hint text
) returns void
language plpgsql
set search_path=''
as $$
begin
  if not exists(select 1 from public.platform_admins where user_id=p_actor) then
    raise exception 'forbidden';
  end if;

  if p_secret is null then
    delete from public.business_ai_credentials where business_id=p_business_id;
    insert into public.platform_config_events(business_id,actor,action)
      values(p_business_id,p_actor,'ai_key_removed');
  else
    insert into public.business_ai_credentials(
      business_id,tenant_id,provider,model,secret_enc,key_hint,updated_by
    )
    select id,tenant_id,p_provider,p_model,p_secret,p_hint,p_actor
    from public.businesses
    where id=p_business_id
    on conflict(business_id) do update set
      fallback_provider = case
        when excluded.provider is distinct from business_ai_credentials.provider
          then business_ai_credentials.provider
        else business_ai_credentials.fallback_provider
      end,
      fallback_model = case
        when excluded.provider is distinct from business_ai_credentials.provider
          then business_ai_credentials.model
        else business_ai_credentials.fallback_model
      end,
      fallback_secret_enc = case
        when excluded.provider is distinct from business_ai_credentials.provider
          then business_ai_credentials.secret_enc
        else business_ai_credentials.fallback_secret_enc
      end,
      fallback_key_hint = case
        when excluded.provider is distinct from business_ai_credentials.provider
          then business_ai_credentials.key_hint
        else business_ai_credentials.fallback_key_hint
      end,
      provider=excluded.provider,
      model=excluded.model,
      secret_enc=excluded.secret_enc,
      key_hint=excluded.key_hint,
      updated_by=p_actor,
      updated_at=now();

    if not found then raise exception 'business not found'; end if;
    insert into public.platform_config_events(business_id,actor,action)
      values(p_business_id,p_actor,'ai_key_saved');
  end if;
end;
$$;

revoke all on function public.platform_save_ai_key(uuid,uuid,text,text,text,text)
  from public,anon,authenticated;
grant execute on function public.platform_save_ai_key(uuid,uuid,text,text,text,text)
  to service_role;
