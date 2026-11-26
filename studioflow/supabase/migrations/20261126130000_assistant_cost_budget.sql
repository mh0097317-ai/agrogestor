-- Custo da IA em reais por estabelecimento. Os tokens passam a ser guardados
-- também por modelo (o preço muda de um modelo para outro), o câmbio fica
-- configurável no /admin (nunca inventado) e cada casa pode ter um teto
-- mensal em reais: estourado, a recepcionista pausa e a equipe assume.
create table public.assistant_model_usage (
  business_id uuid not null references public.businesses(id) on delete cascade,
  day date not null,
  model text not null check (length(model) between 3 and 100),
  input_tokens bigint not null default 0,
  output_tokens bigint not null default 0,
  primary key (business_id, day, model)
);
alter table public.assistant_model_usage enable row level security;
revoke all on table public.assistant_model_usage from public, anon, authenticated;
grant all on table public.assistant_model_usage to service_role;

create or replace function public.assistant_add_model_tokens(
  p_business_id uuid, p_model text, p_input bigint, p_output bigint
) returns void
language sql set search_path = '' as $$
  insert into public.assistant_model_usage as u (business_id, day, model, input_tokens, output_tokens)
  values (p_business_id, (now() at time zone 'America/Sao_Paulo')::date, left(p_model, 100),
          greatest(p_input, 0), greatest(p_output, 0))
  on conflict (business_id, day, model) do update
    set input_tokens = u.input_tokens + excluded.input_tokens,
        output_tokens = u.output_tokens + excluded.output_tokens;
$$;
revoke all on function public.assistant_add_model_tokens(uuid, text, bigint, bigint) from public, anon, authenticated;
grant execute on function public.assistant_add_model_tokens(uuid, text, bigint, bigint) to service_role;

-- Câmbio usado só para estimar (US$ → R$). Sem valor, o painel mostra em US$.
alter table public.platform_settings
  add column usd_brl numeric(8,4) check (usd_brl is null or usd_brl between 1 and 50);

-- Teto mensal da IA por casa, em centavos de real (null = sem teto).
alter table public.business_ai_plan
  add column monthly_budget_cents integer check (monthly_budget_cents is null or monthly_budget_cents between 0 and 100000000);
