-- Avisos ao dono quando a recepcionista falha, deixa um cliente esperando ou
-- o WhatsApp da loja desconecta. Guardados para não repetir o mesmo aviso e
-- para limitar quantos saem por dia. Só o servidor (service role) acessa.
create table public.assistant_alerts (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  conversation_id uuid references public.conversations(id) on delete cascade,
  kind text not null check (kind in ('failed','no_reply','disconnected')),
  channel text not null default 'none' check (channel in ('whatsapp','email','none')),
  created_at timestamptz not null default now()
);
create index assistant_alerts_recent on public.assistant_alerts(business_id, created_at desc);
alter table public.assistant_alerts enable row level security;
revoke all on public.assistant_alerts from anon, authenticated;

-- Clientes esperando: mensagem que a recepcionista ainda não tratou (nem
-- respondeu, nem decidiu silêncio, nem passou para a equipe) há mais de 2 min.
create or replace function public.assistant_waiting_customers()
returns table(conversation_id uuid, business_id uuid, contact_phone text, waiting_since timestamptz)
language sql
set search_path to ''
as $function$
  select c.id, c.business_id, c.contact_phone, min(m.created_at)
  from public.conversations c
  join public.business_settings s on s.business_id = c.business_id and s.assistant_enabled
  join public.conversation_messages m on m.conversation_id = c.id and m.role = 'customer'
  where c.status = 'ai' and c.channel = 'whatsapp'
    and m.created_at > c.ai_cursor
    and m.created_at < now() - interval '2 minutes'
    and m.created_at > now() - interval '30 minutes'
    and (c.processing_until is null or c.processing_until < now())
  group by c.id, c.business_id, c.contact_phone
  limit 50;
$function$;
revoke all on function public.assistant_waiting_customers() from public, anon, authenticated;
grant execute on function public.assistant_waiting_customers() to service_role;
