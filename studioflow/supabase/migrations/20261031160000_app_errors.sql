-- Erros guardados por 30 dias (os logs da Vercel somem em cerca de uma hora).
-- Só código e contexto técnico: nada de texto de mensagem ou telefone.
-- Só o servidor (service role) lê e grava.
create table public.app_errors (
  id uuid primary key default gen_random_uuid(),
  business_id uuid references public.businesses(id) on delete cascade,
  scope text not null,
  code text not null,
  detail jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create index app_errors_recent on public.app_errors(created_at desc);
create index app_errors_business on public.app_errors(business_id, created_at desc);
alter table public.app_errors enable row level security;
revoke all on public.app_errors from anon, authenticated;
