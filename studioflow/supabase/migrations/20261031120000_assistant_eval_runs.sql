-- Conversas de teste da recepcionista rodadas pelo /admin com o modelo de
-- verdade, numa cópia da agenda em memória. Só o servidor (service role)
-- lê e grava: sem políticas, nenhum usuário acessa pela API pública.
create table public.assistant_eval_runs (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  model text not null,
  passed integer not null,
  total integer not null,
  results jsonb not null,
  created_by uuid,
  created_at timestamptz not null default now()
);
create index assistant_eval_runs_business on public.assistant_eval_runs(business_id, created_at desc);
alter table public.assistant_eval_runs enable row level security;
revoke all on public.assistant_eval_runs from anon, authenticated;
