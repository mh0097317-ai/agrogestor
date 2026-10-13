-- Modo da IA de cada cliente (Econômico, Equilibrado, Máximo), trocado só
-- pela equipe StudioFlow no /admin. Sem políticas: só o servidor lê e grava.
create table public.business_ai_plan (
  business_id uuid primary key references public.businesses(id) on delete cascade,
  tier text not null default 'economico' check (tier in ('economico','equilibrado','maximo')),
  updated_by uuid,
  updated_at timestamptz not null default now()
);
alter table public.business_ai_plan enable row level security;
revoke all on public.business_ai_plan from anon, authenticated;
