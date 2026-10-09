-- Additive operational state and a separate encrypted audio credential per tenant.
create table public.business_transcription_credentials (
  business_id uuid primary key,
  tenant_id uuid not null,
  provider text not null check(provider in ('groq','openai')),
  model text not null,
  secret_enc text not null,
  key_hint text not null check(length(key_hint)<=4),
  updated_by uuid references auth.users(id),
  updated_at timestamptz not null default now(),
  foreign key(tenant_id,business_id) references public.businesses(tenant_id,id)
);
create table public.assistant_runs (
  conversation_id uuid primary key,
  business_id uuid not null,
  tenant_id uuid not null,
  cursor timestamptz not null,
  state text not null check(state in ('RECEIVED','UNDERSTANDING','UNDERSTOOD','DECIDING','GENERATING','VALIDATING','SENDING','SENT','SILENT','RETRY','FAILED')),
  interpretation jsonb,
  attempts integer not null default 0 check(attempts between 0 and 3),
  retry_at timestamptz,
  error_code text,
  updated_at timestamptz not null default now(),
  foreign key(tenant_id,business_id) references public.businesses(tenant_id,id),
  foreign key(business_id,conversation_id) references public.conversations(business_id,id)
);
alter table public.business_transcription_credentials enable row level security;
alter table public.assistant_runs enable row level security;
revoke all on public.business_transcription_credentials,public.assistant_runs from public,anon,authenticated;
grant select,insert,update on public.business_transcription_credentials,public.assistant_runs to service_role;
create trigger immutable_scope before update on public.business_transcription_credentials for each row execute function private.preserve_scope();
create trigger immutable_scope before update on public.assistant_runs for each row execute function private.preserve_scope();

create function public.start_assistant_run(p_id uuid,p_cursor timestamptz)
returns integer language plpgsql set search_path='' as $$
declare attempt integer;
begin
  insert into public.assistant_runs(conversation_id,business_id,tenant_id,cursor,state,attempts)
    select id,business_id,tenant_id,p_cursor,'UNDERSTANDING',1 from public.conversations where id=p_id
    on conflict(conversation_id) do update set
      attempts=case when public.assistant_runs.cursor=excluded.cursor then least(3,public.assistant_runs.attempts+1) else 1 end,
      cursor=excluded.cursor,state='UNDERSTANDING',retry_at=null,error_code=null,updated_at=now()
    returning attempts into attempt;
  return attempt;
end $$;
create function public.due_assistant_conversations()
returns table(id uuid,business_id uuid,tenant_id uuid,slug text)
language sql set search_path='' as $$
  select c.id,c.business_id,c.tenant_id,b.slug from public.conversations c
  join public.businesses b on b.id=c.business_id
  join public.business_settings s on s.business_id=c.business_id
  left join public.assistant_runs r on r.conversation_id=c.id
  where c.channel='whatsapp' and c.status='ai' and s.assistant_enabled
    and (c.processing_until is null or c.processing_until<now())
    and exists(select 1 from public.conversation_messages m where m.conversation_id=c.id and m.role='customer' and m.created_at>c.ai_cursor and m.created_at>now()-interval '24 hours' and m.created_at<now()-interval '8 seconds')
    and (r.conversation_id is null or r.cursor<(select max(m.created_at) from public.conversation_messages m where m.conversation_id=c.id and m.role='customer') or (r.state in ('RETRY','UNDERSTANDING','UNDERSTOOD','DECIDING','GENERATING','VALIDATING') and r.attempts<3 and coalesce(r.retry_at,r.updated_at+interval '2 minutes')<=now()))
    and coalesce(r.state,'RECEIVED')<>'SENDING'
  order by c.last_message_at limit 3;
$$;
revoke all on function public.start_assistant_run(uuid,timestamptz),public.due_assistant_conversations() from public,anon,authenticated;
grant execute on function public.start_assistant_run(uuid,timestamptz),public.due_assistant_conversations() to service_role;
