-- Até 3 fotos por serviço, link do Google Maps e Instagram na página pública.

-- A foto principal continua em services.image; aqui ficam até mais duas.
alter table public.services add column photos text[] not null default '{}' check (cardinality(photos) <= 2);

-- Link do perfil no Google Maps (opcional); sem ele, o mapa usa o endereço.
alter table public.businesses add column maps_url text not null default '' check (length(maps_url) <= 500);

-- Conta do Instagram que mostra os posts na página. Só o servidor.
create table public.instagram_feeds (
  business_id uuid primary key,
  tenant_id uuid not null,
  ig_user_id text not null check (ig_user_id ~ '^[0-9]{5,40}$'),
  username text not null default '' check (length(username) <= 60),
  access_token_enc text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (tenant_id, business_id) references public.businesses(tenant_id, id) on delete cascade
);
alter table public.instagram_feeds enable row level security;
create trigger updated_at before update on public.instagram_feeds for each row execute function private.touch_updated_at();
create trigger immutable_scope before update on public.instagram_feeds for each row execute function private.preserve_scope();
revoke all on public.instagram_feeds from anon, authenticated;
grant all on public.instagram_feeds to service_role;
