-- Recepcionista também no Instagram Direct do estabelecimento.

alter table public.conversations drop constraint if exists conversations_channel_check;
alter table public.conversations add constraint conversations_channel_check
  check (channel in ('web', 'whatsapp', 'instagram'));
-- Quem escreveu no Instagram (id do remetente na conta da casa).
alter table public.conversations add column contact_ref text not null default '' check (length(contact_ref) <= 100);
create unique index conversations_instagram_contact_idx on public.conversations(business_id, contact_ref) where channel = 'instagram';

-- Conexão com a conta profissional do Instagram. Só o servidor.
create table public.instagram_accounts (
  business_id uuid primary key,
  tenant_id uuid not null,
  ig_user_id text not null unique check (ig_user_id ~ '^[0-9]{5,40}$'),
  username text not null default '',
  access_token_enc text not null,
  app_secret_enc text not null,
  verify_token_hash bytea not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (tenant_id, business_id) references public.businesses(tenant_id, id) on delete cascade
);
alter table public.instagram_accounts enable row level security;
create trigger updated_at before update on public.instagram_accounts for each row execute function private.touch_updated_at();
create trigger immutable_scope before update on public.instagram_accounts for each row execute function private.preserve_scope();
revoke all on public.instagram_accounts from anon, authenticated;
grant all on public.instagram_accounts to service_role;
