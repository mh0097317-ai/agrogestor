-- Modo Marketing: a IA da StudioFlow cria e publica no Instagram da própria StudioFlow.
-- Só o servidor (service_role) lê e escreve; o /admin chama o servidor.
create table public.marketing_account (
  id smallint primary key default 1 check (id = 1),
  ig_user_id text,
  username text,
  access_token_enc text,
  autopilot boolean not null default false,
  auto_publish boolean not null default false,
  posts_per_week smallint not null default 3 check (posts_per_week between 1 and 14),
  post_hour smallint not null default 12 check (post_hour between 6 and 22),
  voice text not null default '' check (length(voice) <= 1000),
  last_generated_at timestamptz,
  updated_at timestamptz not null default now()
);
insert into public.marketing_account(id) values (1) on conflict do nothing;

create table public.marketing_posts (
  id uuid primary key default gen_random_uuid(),
  status text not null default 'draft'
    check (status in ('draft','scheduled','publishing','published','failed','discarded')),
  format text not null check (format in ('post','carousel','story','reel')),
  theme text not null default '' check (length(theme) <= 200),
  slides jsonb not null default '[]'::jsonb check (jsonb_typeof(slides) = 'array' and jsonb_array_length(slides) <= 10),
  caption text not null default '' check (length(caption) <= 2200),
  video_url text check (video_url is null or video_url ~ '^https://'),
  scheduled_for timestamptz,
  published_at timestamptz,
  ig_media_id text,
  permalink text,
  error text,
  likes integer,
  comments integer,
  origin text not null default 'ia' check (origin in ('ia','admin')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index marketing_posts_due_idx on public.marketing_posts(scheduled_for) where status = 'scheduled';
create index marketing_posts_created_idx on public.marketing_posts(created_at desc);

alter table public.marketing_account enable row level security;
alter table public.marketing_posts enable row level security;
revoke all on public.marketing_account, public.marketing_posts from public, anon, authenticated;
grant select, insert, update on public.marketing_account to service_role;
grant select, insert, update, delete on public.marketing_posts to service_role;

-- Um post vencido por vez, sem dois envios do mesmo post mesmo com execuções simultâneas.
create or replace function public.claim_marketing_post()
returns uuid language plpgsql security invoker set search_path = '' as $$
declare picked uuid;
begin
  update public.marketing_posts set status = 'publishing', updated_at = now()
  where id = (
    select id from public.marketing_posts
    where status = 'scheduled' and scheduled_for <= now()
    order by scheduled_for limit 1 for update skip locked
  ) returning id into picked;
  return picked;
end $$;
revoke all on function public.claim_marketing_post() from public, anon, authenticated;
grant execute on function public.claim_marketing_post() to service_role;

-- Vídeos dos Reels, enviados direto do navegador do admin (link público para a Meta buscar).
insert into storage.buckets(id, name, public, file_size_limit, allowed_mime_types)
values ('marketing', 'marketing', true, 104857600, array['video/mp4','video/quicktime','image/jpeg','image/png'])
on conflict (id) do nothing;

do $$
begin
  if not exists (select 1 from pg_extension where extname = 'pg_cron')
     or not exists (select 1 from pg_extension where extname = 'pg_net') then
    return;
  end if;
  perform cron.schedule('studioflow-marketing', '*/15 * * * *',
    $job$select net.http_post(url:='https://app.studioflowapp.tech/api/cron/marketing',headers:=jsonb_build_object('Content-Type','application/json','Authorization','Bearer '||(select decrypted_secret from vault.decrypted_secrets where name='studioflow_appointment_scheduler' limit 1)),body:='{}'::jsonb,timeout_milliseconds:=120000);$job$);
end $$;
