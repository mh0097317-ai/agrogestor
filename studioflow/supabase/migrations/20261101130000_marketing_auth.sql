-- Quando a Meta recusa o token do Instagram, o Marketing para de tentar
-- publicar (os posts esperam na fila) até alguém reconectar.
alter table public.marketing_account
  add column auth_failed_at timestamptz,
  add column auth_error text check (length(auth_error) <= 300);

-- Token recusado depois da última conexão: já entra marcado.
update public.marketing_account a
set auth_failed_at = f.last, auth_error = 'A Meta recusou o token salvo.'
from (
  select max(updated_at) as last from public.marketing_posts
  where status = 'failed' and error like 'A Meta recusou a autorização%'
) f
where a.id = 1 and a.access_token_enc is not null and f.last is not null and f.last > a.updated_at;
