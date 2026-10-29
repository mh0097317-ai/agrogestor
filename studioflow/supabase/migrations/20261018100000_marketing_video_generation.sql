-- Configuração e operações de geração de vídeos do Marketing StudioFlow.
alter table public.marketing_account
  add column google_video_key_enc text;

create table public.marketing_video_jobs (
  id uuid primary key default gen_random_uuid(),
  status text not null default 'starting'
    check (status in ('starting','processing','saving','completed','failed')),
  prompt text not null check (length(prompt) between 20 and 2000),
  caption text not null default '' check (length(caption) <= 2200),
  aspect_ratio text not null check (aspect_ratio in ('9:16','16:9')),
  resolution text not null check (resolution in ('720p','1080p')),
  operation_name text unique,
  post_id uuid references public.marketing_posts(id) on delete set null,
  error text check (error is null or length(error) <= 500),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index marketing_video_jobs_recent_idx
  on public.marketing_video_jobs(created_at desc);

alter table public.marketing_video_jobs enable row level security;
revoke all on public.marketing_video_jobs from public, anon, authenticated;
grant select, insert, update on public.marketing_video_jobs to service_role;
