-- Modelo que escreve os posts do Marketing, escolhido no /admin.
alter table public.marketing_account
  add column ai_model text not null default 'claude-opus-5-5'
  check (ai_model in ('claude-haiku-5-5','claude-sonnet-5-5','claude-opus-5-5'));
