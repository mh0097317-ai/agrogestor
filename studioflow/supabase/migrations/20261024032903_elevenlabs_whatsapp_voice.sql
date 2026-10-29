create table public.platform_voice_credentials (
  id text primary key check (id = 'elevenlabs'),
  secret_enc text not null,
  key_hint text not null check (length(key_hint) <= 4),
  voice_id text not null check (length(voice_id) between 3 and 100),
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users(id)
);

alter table public.platform_voice_credentials enable row level security;
revoke all on public.platform_voice_credentials from public,anon,authenticated;
grant all on public.platform_voice_credentials to service_role;

alter table public.platform_config_events
  drop constraint platform_config_events_action_check;
alter table public.platform_config_events
  add constraint platform_config_events_action_check
  check (action in (
    'ai_key_saved','ai_key_removed','assistant_settings','evolution_saved',
    'elevenlabs_saved','elevenlabs_removed','manual_invoice_created','manual_invoice_paid',
    'manual_invoice_cancelled'
  ));

create function public.platform_save_voice_credential(
  p_actor uuid,p_secret text,p_hint text,p_voice_id text
) returns void language plpgsql set search_path='' as $$
begin
  if not exists(select 1 from public.platform_admins where user_id=p_actor) then
    raise exception 'forbidden';
  end if;
  if p_secret is null then
    delete from public.platform_voice_credentials where id='elevenlabs';
    insert into public.platform_config_events(actor,action)
      values(p_actor,'elevenlabs_removed');
  else
    insert into public.platform_voice_credentials(id,secret_enc,key_hint,voice_id,updated_by)
      values('elevenlabs',p_secret,p_hint,p_voice_id,p_actor)
      on conflict(id) do update set
        secret_enc=excluded.secret_enc,key_hint=excluded.key_hint,
        voice_id=excluded.voice_id,updated_by=excluded.updated_by,updated_at=now();
    insert into public.platform_config_events(actor,action)
      values(p_actor,'elevenlabs_saved');
  end if;
end; $$;

revoke all on function public.platform_save_voice_credential(uuid,text,text,text) from public,anon,authenticated;
grant execute on function public.platform_save_voice_credential(uuid,text,text,text) to service_role;
