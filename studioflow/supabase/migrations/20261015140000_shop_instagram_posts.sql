-- Divulgar: a barbearia publica as artes da agenda no próprio Instagram.
-- As imagens ficam num bucket público só até a Meta buscar; depois saem.
insert into storage.buckets(id, name, public, file_size_limit, allowed_mime_types)
values ('shop-posts', 'shop-posts', true, 10485760, array['image/jpeg'])
on conflict (id) do nothing;

create table public.shop_instagram_posts (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  format text not null check (format in ('post','story')),
  kind text not null default '' check (length(kind) <= 40),
  media_id text,
  permalink text,
  created_at timestamptz not null default now()
);
create index shop_instagram_posts_business_idx on public.shop_instagram_posts(business_id, created_at desc);
alter table public.shop_instagram_posts enable row level security;
revoke all on public.shop_instagram_posts from anon, authenticated;
grant all on public.shop_instagram_posts to service_role;
