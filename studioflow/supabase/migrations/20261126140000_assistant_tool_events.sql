-- Rastreabilidade: cada ferramenta que a recepcionista usou numa conversa
-- (consultar horários, mostrar lista, agendar, cancelar, remarcar, chamar a
-- equipe), com resultado. Só o servidor grava e lê; o painel mostra por
-- conversa. Sem conteúdo de mensagem, só o nome da ferramenta e um resumo.
create table public.assistant_tool_events (
  id bigint generated always as identity primary key,
  business_id uuid not null references public.businesses(id) on delete cascade,
  conversation_id uuid not null references public.conversations(id) on delete cascade,
  tool text not null check (length(tool) between 2 and 60),
  ok boolean not null,
  summary text not null default '' check (length(summary) <= 300),
  created_at timestamptz not null default now()
);
create index assistant_tool_events_conversation on public.assistant_tool_events (conversation_id, created_at desc);
create index assistant_tool_events_business on public.assistant_tool_events (business_id, created_at desc);
alter table public.assistant_tool_events enable row level security;
revoke all on table public.assistant_tool_events from public, anon, authenticated;
grant all on table public.assistant_tool_events to service_role;
