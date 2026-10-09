-- Explicit recovery of an unanswered request. No quota reset or new privileges
-- for browser roles; the authenticated workspace API authorizes the operator.
create function public.request_assistant_analysis(p_business_id uuid,p_id uuid)
returns text language plpgsql security invoker set search_path='' as $$
declare
  c public.conversations%rowtype;
  r public.assistant_runs%rowtype;
  latest public.conversation_messages%rowtype;
  first_at timestamptz;
  last_reply timestamptz;
  enabled boolean;
  daily_limit integer;
begin
  select * into c from public.conversations
    where id=p_id and business_id=p_business_id for update;
  if not found then return 'not-found'; end if;
  if c.channel<>'whatsapp' then return 'not-whatsapp'; end if;
  select * into r from public.assistant_runs where conversation_id=c.id;
  if r.state='SENDING' or r.error_code='delivery-unconfirmed' then
    return 'delivery-unconfirmed';
  end if;
  if c.processing_until>now() or
    (r.state='RETRY' and r.attempts=0 and r.updated_at>now()-interval '15 seconds') then
    return 'busy';
  end if;
  select * into latest from public.conversation_messages
    where business_id=c.business_id and conversation_id=c.id and role<>'event'
    order by created_at desc,id desc limit 1;
  if latest.id is null or latest.role<>'customer' then return 'answered'; end if;
  if latest.created_at<now()-interval '24 hours' then return 'expired'; end if;
  select max(created_at) into last_reply from public.conversation_messages
    where business_id=c.business_id and conversation_id=c.id and role in ('assistant','staff');
  select min(created_at) into first_at from public.conversation_messages
    where business_id=c.business_id and conversation_id=c.id and role='customer'
      and created_at>=latest.created_at-interval '12 seconds'
      and (last_reply is null or created_at>last_reply);
  if exists(select 1 from public.appointments where business_id=c.business_id
    and conversation_id=c.id and created_at>=first_at) then return 'appointment-created'; end if;
  select assistant_enabled,assistant_daily_limit into enabled,daily_limit
    from public.business_settings where business_id=c.business_id;
  if enabled is distinct from true then return 'disabled'; end if;
  if coalesce((select turns from public.assistant_usage where business_id=c.business_id
    and day=(now() at time zone 'America/Sao_Paulo')::date),0)>=daily_limit then
    return 'daily-limit';
  end if;
  update public.conversations set status='ai',unread=0,
    ai_cursor=first_at-interval '1 millisecond' where id=c.id;
  -- RETRY is durable: the scanner can recover this request if the after callback
  -- is interrupted. The conversation lease prevents simultaneous workers.
  insert into public.assistant_runs(conversation_id,business_id,tenant_id,cursor,state,attempts,retry_at)
    values(c.id,c.business_id,c.tenant_id,latest.created_at,'RETRY',0,now())
    on conflict(conversation_id) do update set cursor=excluded.cursor,state='RETRY',
      attempts=0,interpretation=null,error_code=null,retry_at=now(),updated_at=now();
  insert into public.conversation_messages(tenant_id,business_id,conversation_id,role,body)
    values(c.tenant_id,c.business_id,c.id,'event','Análise e resposta solicitadas pela equipe. StudioFlow vai reler o contexto do pedido pendente.');
  return 'queued';
end $$;
revoke all on function public.request_assistant_analysis(uuid,uuid) from public,anon,authenticated;
grant execute on function public.request_assistant_analysis(uuid,uuid) to service_role;
