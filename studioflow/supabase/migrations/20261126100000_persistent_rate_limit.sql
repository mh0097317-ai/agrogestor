-- Limite de tentativas que vale para todas as instâncias da Vercel. O limite
-- em memória continua na frente (barato); este segura abuso distribuído nas
-- rotas públicas que custam caro (chat com IA, reserva, lista de espera).
create table public.rate_limits (
  key text primary key,
  hits integer not null default 0,
  window_start timestamptz not null default now()
);
alter table public.rate_limits enable row level security;
revoke all on table public.rate_limits from public, anon, authenticated;
grant all on table public.rate_limits to service_role;

-- true = pode seguir. Janela fixa por chave; a chave já vem com hash do IP.
create or replace function public.rate_limit_hit(p_key text, p_max integer, p_window_seconds integer)
returns boolean
language plpgsql security definer set search_path = '' as $$
declare
  v_hits integer;
begin
  if p_key is null or length(p_key) > 200 or p_max < 1 or p_window_seconds < 1 then
    return true;
  end if;
  insert into public.rate_limits as r (key, hits, window_start)
  values (p_key, 1, now())
  on conflict (key) do update
    set hits = case when r.window_start < now() - make_interval(secs => p_window_seconds) then 1 else r.hits + 1 end,
        window_start = case when r.window_start < now() - make_interval(secs => p_window_seconds) then now() else r.window_start end
  returning hits into v_hits;
  return v_hits <= p_max;
end;
$$;
revoke all on function public.rate_limit_hit(text, integer, integer) from public, anon, authenticated;
grant execute on function public.rate_limit_hit(text, integer, integer) to service_role;

-- Limpeza: chaves paradas há mais de um dia.
create or replace function public.prune_rate_limits()
returns integer
language sql security definer set search_path = '' as $$
  with gone as (delete from public.rate_limits where window_start < now() - interval '1 day' returning 1)
  select count(*)::integer from gone;
$$;
revoke all on function public.prune_rate_limits() from public, anon, authenticated;
grant execute on function public.prune_rate_limits() to service_role;
