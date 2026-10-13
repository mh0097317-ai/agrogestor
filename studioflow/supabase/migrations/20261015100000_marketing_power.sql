-- Marketing da StudioFlow: chave geral (liga/desliga tudo) e chave da IA
-- guardada cifrada pelo próprio /admin, sem precisar mexer na Vercel.
alter table public.marketing_account
  add column enabled boolean not null default true,
  add column ai_key_enc text;
