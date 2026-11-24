-- Atendimentos travados: um run que parou no meio (a função foi encerrada
-- antes de registrar o resultado) ficava para sempre em "gerando", sem
-- resposta ao cliente e sem aviso ao dono. A recuperação só olhava conversas
-- ainda com a IA e com menos de 3 tentativas; o resto sumia em silêncio.

-- 1) A recuperação olha mais conversas por minuto e começa pelas mais
--    recentes: conversas que ela pula (WhatsApp caído, assistente desligado)
--    não ocupam as vagas de quem ainda está esperando.
create or replace function public.due_assistant_conversations()
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
  order by c.last_message_at desc limit 10;
$$;

-- 2) Runs parados num estado de trabalho há mais de 6 minutos que a
--    recuperação não vai retomar: conversa já com a equipe, tentativas
--    esgotadas, envio sem confirmação, ou parado há mais de 30 minutos.
--    "answered": a equipe ou a IA já falou depois da mensagem do cliente.
create or replace function public.stale_assistant_runs()
returns table(
  conversation_id uuid, business_id uuid, tenant_id uuid, state text,
  attempts integer, run_updated_at timestamptz, conversation_status text,
  channel text, contact_phone text, answered boolean
)
language sql set search_path='' as $$
  select r.conversation_id, r.business_id, r.tenant_id, r.state, r.attempts,
    r.updated_at, c.status, c.channel, c.contact_phone,
    exists(
      select 1 from public.conversation_messages m
      where m.conversation_id = r.conversation_id
        and m.role in ('staff','assistant') and m.created_at > r.cursor
    )
  from public.assistant_runs r
  join public.conversations c on c.id = r.conversation_id
  where r.state in ('UNDERSTANDING','UNDERSTOOD','DECIDING','GENERATING','VALIDATING','SENDING','RETRY')
    and r.updated_at < now() - interval '6 minutes'
    and (c.processing_until is null or c.processing_until < now())
    and (
      c.status <> 'ai' or r.attempts >= 3 or r.state = 'SENDING'
      or r.updated_at < now() - interval '30 minutes'
    )
  order by r.updated_at
  limit 20;
$$;
revoke all on function public.stale_assistant_runs() from public, anon, authenticated;
grant execute on function public.stale_assistant_runs() to service_role;
revoke all on function public.due_assistant_conversations() from public, anon, authenticated;
grant execute on function public.due_assistant_conversations() to service_role;
