-- Despesas da casa (aluguel, produtos, contas...). Só o servidor lê e grava,
-- depois de conferir o papel (dono, admin ou gerência). Nada é apagado:
-- lançamento errado é estornado (voided_at) e o histórico continua.
create table if not exists public.business_expenses (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  category text not null check (category in (
    'aluguel','pessoal','produtos','contas','marketing','impostos',
    'manutencao','sistemas','taxas','outros')),
  description text not null check (char_length(description) between 1 and 120),
  amount_cents integer not null check (amount_cents > 0 and amount_cents <= 100000000),
  due_date date not null,
  paid_at date,
  method text check (method in ('pix','cash','credit','debit','other')),
  created_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  voided_at timestamptz,
  void_reason text check (void_reason is null or char_length(void_reason) <= 200)
);
create index if not exists business_expenses_business_due
  on public.business_expenses (business_id, due_date);
create index if not exists business_expenses_business_paid
  on public.business_expenses (business_id, paid_at) where paid_at is not null;

alter table public.business_expenses enable row level security;
revoke all on public.business_expenses from anon, authenticated;
grant all on public.business_expenses to service_role;
