-- Marketing pela Zernio: o Instagram da StudioFlow é conectado uma vez pelo
-- login oficial (a Zernio guarda e renova o acesso), sem token da Meta que
-- vence. A chave da Zernio fica cifrada; o servidor também aceita a variável
-- ZERNIO_API_KEY. Só colunas novas, todas opcionais.

alter table public.marketing_account
  add column zernio_key_enc text,
  add column zernio_hint text not null default '' check (length(zernio_hint) <= 4),
  add column zernio_profile_id text check (zernio_profile_id ~ '^[A-Za-z0-9_-]{1,64}$'),
  add column zernio_account_id text check (zernio_account_id ~ '^[A-Za-z0-9_-]{1,64}$'),
  add column zernio_username text check (length(zernio_username) <= 100);

-- Cada publicação pela Zernio leva uma chave de tentativa: se o servidor cair
-- no meio, a nova tentativa repete a mesma chave e a Zernio não publica duas
-- vezes. As métricas vêm da Zernio (a Meta só dava curtidas e comentários).
alter table public.marketing_posts
  add column zernio_post_id text check (zernio_post_id ~ '^[A-Za-z0-9_-]{1,64}$'),
  add column zernio_attempt uuid,
  add column views integer check (views >= 0),
  add column reach integer check (reach >= 0),
  add column saves integer check (saves >= 0),
  add column shares integer check (shares >= 0);
create index marketing_posts_zernio_pending_idx on public.marketing_posts(updated_at)
  where status = 'publishing' and zernio_post_id is not null;
