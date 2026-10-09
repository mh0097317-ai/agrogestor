-- Private operational configuration. Existing businesses and records are preserved.
create table public.business_ai_credentials (
  business_id uuid primary key,
  tenant_id uuid not null,
  provider text not null check (provider in ('anthropic','openai')),
  model text not null check (length(model) between 1 and 100),
  secret_enc text not null,
  key_hint text not null check (length(key_hint) <= 4),
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users(id),
  foreign key (tenant_id,business_id) references public.businesses(tenant_id,id) on delete cascade
);
create table public.platform_integrations (
  id text primary key check (id = 'evolution'),
  endpoint text not null,
  secret_enc text not null,
  key_hint text not null,
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users(id)
);
create table public.platform_config_events (
  id uuid primary key default gen_random_uuid(),
  business_id uuid references public.businesses(id),
  action text not null check (action in ('ai_key_saved','ai_key_removed','assistant_settings','evolution_saved','manual_invoice_created','manual_invoice_paid','manual_invoice_cancelled')),
  actor uuid not null references auth.users(id),
  created_at timestamptz not null default now()
);
create index platform_config_events_date_idx on public.platform_config_events(created_at desc);
create table public.professional_whatsapp_links (
  business_id uuid not null,
  professional_id uuid not null,
  tenant_id uuid not null,
  instance text not null unique,
  status text not null default 'connecting' check (status in ('connecting','open','close')),
  phone text not null default '' check (phone ~ '^[0-9]{0,15}$'),
  profile_name text not null default '',
  webhook_token_hash bytea not null,
  connected_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (business_id,professional_id),
  foreign key (tenant_id,business_id) references public.businesses(tenant_id,id) on delete cascade,
  foreign key (business_id,professional_id) references public.professionals(business_id,id) on delete cascade
);
create trigger updated_at before update on public.professional_whatsapp_links for each row execute function private.touch_updated_at();
create trigger immutable_scope before update on public.professional_whatsapp_links for each row execute function private.preserve_scope();

alter table public.conversations add column whatsapp_professional_id uuid;
alter table public.conversations add constraint conversation_whatsapp_professional_fk foreign key (business_id,whatsapp_professional_id) references public.professionals(business_id,id);
-- A customer speaking to the shop and to a professional has distinct histories.
drop index public.conversations_whatsapp_contact_idx;
create unique index conversations_whatsapp_contact_idx on public.conversations(business_id,contact_phone,coalesce(whatsapp_professional_id,'00000000-0000-0000-0000-000000000000'::uuid)) where channel='whatsapp';

create table public.platform_manual_invoices (
  id uuid primary key,
  business_id uuid not null references public.businesses(id),
  value numeric(12,2) not null check (value > 0 and value <= 100000),
  period_days integer not null check (period_days between 1 and 366),
  due_date date not null,
  status text not null default 'pending' check (status in ('pending','paid','cancelled')),
  method text not null check (method in ('pix','cash','card','transfer','other')),
  note text not null default '' check (length(note) <= 500),
  paid_at timestamptz,
  created_at timestamptz not null default now(),
  actor uuid not null references auth.users(id),
  check ((status='paid') = (paid_at is not null))
);
create index platform_manual_invoices_business_idx on public.platform_manual_invoices(business_id,created_at desc);

alter table public.business_ai_credentials enable row level security;
alter table public.platform_integrations enable row level security;
alter table public.platform_config_events enable row level security;
alter table public.professional_whatsapp_links enable row level security;
alter table public.platform_manual_invoices enable row level security;
revoke all on public.business_ai_credentials,public.platform_integrations,public.platform_config_events,public.professional_whatsapp_links,public.platform_manual_invoices from public,anon,authenticated;
grant all on public.business_ai_credentials,public.platform_integrations,public.platform_config_events,public.professional_whatsapp_links,public.platform_manual_invoices to service_role;

create function public.platform_save_ai_key(p_business_id uuid,p_actor uuid,p_provider text,p_model text,p_secret text,p_hint text) returns void language plpgsql set search_path='' as $$
begin
  if not exists(select 1 from public.platform_admins where user_id=p_actor) then raise exception 'forbidden'; end if;
  if p_secret is null then
    delete from public.business_ai_credentials where business_id=p_business_id;
    insert into public.platform_config_events(business_id,actor,action) values(p_business_id,p_actor,'ai_key_removed');
  else
    insert into public.business_ai_credentials(business_id,tenant_id,provider,model,secret_enc,key_hint,updated_by)
      select id,tenant_id,p_provider,p_model,p_secret,p_hint,p_actor from public.businesses where id=p_business_id
      on conflict(business_id) do update set provider=excluded.provider,model=excluded.model,secret_enc=excluded.secret_enc,key_hint=excluded.key_hint,updated_by=p_actor,updated_at=now();
    if not found then raise exception 'business not found'; end if;
    insert into public.platform_config_events(business_id,actor,action) values(p_business_id,p_actor,'ai_key_saved');
  end if;
end; $$;

create function public.platform_save_evolution(p_actor uuid,p_endpoint text,p_secret text,p_hint text) returns void language plpgsql set search_path='' as $$
begin
  if not exists(select 1 from public.platform_admins where user_id=p_actor) then raise exception 'forbidden'; end if;
  insert into public.platform_integrations(id,endpoint,secret_enc,key_hint,updated_by) values('evolution',p_endpoint,p_secret,p_hint,p_actor)
    on conflict(id) do update set endpoint=excluded.endpoint,secret_enc=excluded.secret_enc,key_hint=excluded.key_hint,updated_by=p_actor,updated_at=now();
  insert into public.platform_config_events(actor,action) values(p_actor,'evolution_saved');
end; $$;

create function public.platform_manual_billing(p_business_id uuid,p_actor uuid,p_action text,p_id uuid,p_value numeric default null,p_due date default null,p_method text default 'pix',p_note text default '',p_days integer default 30,p_paid_at timestamptz default null,p_renew boolean default false) returns jsonb language plpgsql set search_path='' as $$
declare inv public.platform_manual_invoices; acc public.platform_access;
begin
  if not exists(select 1 from public.platform_admins where user_id=p_actor) then raise exception 'forbidden'; end if;
  if not exists(select 1 from public.businesses where id=p_business_id) then raise exception 'business not found'; end if;
  perform pg_advisory_xact_lock(hashtextextended(p_business_id::text,41));
  if p_action='create' then
    insert into public.platform_manual_invoices(id,business_id,value,period_days,due_date,method,note,actor) values(p_id,p_business_id,p_value,p_days,p_due,p_method,p_note,p_actor) on conflict(id) do nothing;
    if found then insert into public.platform_config_events(business_id,actor,action) values(p_business_id,p_actor,'manual_invoice_created'); end if;
  elsif p_action='pay' then
    if p_paid_at is null or p_paid_at > now() then raise exception 'invalid payment date'; end if;
    update public.platform_manual_invoices set status='paid',paid_at=p_paid_at where id=p_id and business_id=p_business_id and status='pending' returning * into inv;
    if found then
      if p_renew then
        insert into public.platform_access(business_id) values(p_business_id) on conflict do nothing;
        select * into acc from public.platform_access where business_id=p_business_id for update;
        if not(acc.status='active' and acc.access_until is null) then
          update public.platform_access set status='active',access_until=greatest(coalesce(acc.access_until,now()),now())+make_interval(days=>inv.period_days),updated_by=p_actor where business_id=p_business_id returning * into acc;
        end if;
        insert into public.platform_access_events(business_id,action,days,access_until,actor) values(p_business_id,'paid',inv.period_days,acc.access_until,p_actor);
      end if;
      insert into public.platform_config_events(business_id,actor,action) values(p_business_id,p_actor,'manual_invoice_paid');
    end if;
  elsif p_action='cancel' then
    update public.platform_manual_invoices set status='cancelled' where id=p_id and business_id=p_business_id and status='pending';
    if found then insert into public.platform_config_events(business_id,actor,action) values(p_business_id,p_actor,'manual_invoice_cancelled'); end if;
  else raise exception 'invalid action'; end if;
  select * into inv from public.platform_manual_invoices where id=p_id and business_id=p_business_id;
  if not found then raise exception 'invoice not found'; end if;
  if (p_action='pay' and inv.status <> 'paid') or (p_action='cancel' and inv.status <> 'cancelled') then raise exception 'invalid invoice status'; end if;
  return to_jsonb(inv);
end; $$;
revoke all on function public.platform_save_ai_key(uuid,uuid,text,text,text,text),public.platform_save_evolution(uuid,text,text,text),public.platform_manual_billing(uuid,uuid,text,uuid,numeric,date,text,text,integer,timestamptz,boolean) from public,anon,authenticated;
grant execute on function public.platform_save_ai_key(uuid,uuid,text,text,text,text),public.platform_save_evolution(uuid,text,text,text),public.platform_manual_billing(uuid,uuid,text,uuid,numeric,date,text,text,integer,timestamptz,boolean) to service_role;

create function public.platform_save_assistant(p_business_id uuid,p_actor uuid,p_enabled boolean,p_name text,p_instructions text,p_limit integer) returns void language plpgsql set search_path='' as $$
begin
  if not exists(select 1 from public.platform_admins where user_id=p_actor) then raise exception 'forbidden'; end if;
  if p_enabled and not exists(select 1 from public.platform_access where business_id=p_business_id and (modules is null or 'recepcionista'=any(modules))) then raise exception 'module not enabled'; end if;
  if length(p_name) not between 2 and 40 or length(p_instructions)>1500 or p_limit not between 10 and 5000 then raise exception 'invalid settings'; end if;
  update public.business_settings set assistant_enabled=p_enabled,assistant_name=p_name,assistant_instructions=p_instructions,assistant_daily_limit=p_limit where business_id=p_business_id;
  if not found then raise exception 'business not found'; end if;
  insert into public.platform_config_events(business_id,actor,action) values(p_business_id,p_actor,'assistant_settings');
end; $$;
revoke all on function public.platform_save_assistant(uuid,uuid,boolean,text,text,integer) from public,anon,authenticated;
grant execute on function public.platform_save_assistant(uuid,uuid,boolean,text,text,integer) to service_role;
