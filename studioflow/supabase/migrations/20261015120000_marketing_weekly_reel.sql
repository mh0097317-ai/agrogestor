-- Piloto automático: um Reel por semana feito das telas de um carrossel,
-- sem nova chamada à IA. source_id evita virar o mesmo post duas vezes.
alter table public.marketing_account
  add column weekly_reel boolean not null default true;
alter table public.marketing_posts
  add column source_id uuid references public.marketing_posts(id) on delete set null;
create index marketing_posts_source_idx on public.marketing_posts(source_id) where source_id is not null;
