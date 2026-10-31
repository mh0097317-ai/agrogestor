-- Saúde da recepcionista por dia (horário de Brasília), últimos 7 dias:
-- quantas respostas, em quanto tempo, quantas falhas e quantos avisos.
create or replace function public.assistant_health(p_business uuid)
returns table(day date, replies integer, p50 numeric, p90 numeric, failures integer, alerts integer)
language sql
set search_path to ''
as $function$
  with days as (
    select (now() at time zone 'America/Sao_Paulo')::date - g as day
    from generate_series(0, 6) g
  ),
  pairs as (
    select (m.created_at at time zone 'America/Sao_Paulo')::date as day,
           extract(epoch from m.created_at - m.prev_at) as seconds
    from (
      select x.created_at, x.role,
             lag(x.role) over w as prev_role, lag(x.created_at) over w as prev_at
      from public.conversation_messages x
      join public.conversations c on c.id = x.conversation_id
      where c.business_id = p_business and c.channel = 'whatsapp'
        and x.created_at > now() - interval '8 days'
        and x.role in ('customer','assistant')
      window w as (partition by x.conversation_id order by x.created_at)
    ) m
    where m.role = 'assistant' and m.prev_role = 'customer'
      and m.created_at - m.prev_at < interval '10 minutes'
  )
  select d.day,
    (select count(*)::integer from pairs p where p.day = d.day),
    (select round(percentile_cont(0.5) within group (order by p.seconds)::numeric, 1) from pairs p where p.day = d.day),
    (select round(percentile_cont(0.9) within group (order by p.seconds)::numeric, 1) from pairs p where p.day = d.day),
    (select count(*)::integer from public.assistant_runs r
       where r.business_id = p_business and r.state = 'FAILED'
         and (r.updated_at at time zone 'America/Sao_Paulo')::date = d.day),
    (select count(*)::integer from public.assistant_alerts a
       where a.business_id = p_business
         and (a.created_at at time zone 'America/Sao_Paulo')::date = d.day)
  from days d
  order by d.day desc;
$function$;
revoke all on function public.assistant_health(uuid) from public, anon, authenticated;
grant execute on function public.assistant_health(uuid) to service_role;
