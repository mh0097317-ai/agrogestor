-- Recepcionista com IA: conversas da página (chat) e do WhatsApp oficial.
-- A IA só age pelas mesmas rotinas do servidor que o agendamento público.

alter table public.business_settings
  add column assistant_enabled boolean not null default false,
  add column assistant_name text not null default 'Recepção' check (length(trim(assistant_name)) between 2 and 40),
  add column assistant_instructions text not null default '' check (length(assistant_instructions) <= 1500),
  add column assistant_daily_limit integer not null default 300 check (assistant_daily_limit between 10 and 5000);

-- Conexão com o WhatsApp Cloud API do próprio estabelecimento. Só o servidor.
create table public.whatsapp_accounts (
  business_id uuid primary key,
  tenant_id uuid not null,
  phone_number_id text not null unique check (phone_number_id ~ '^[0-9]{5,30}$'),
  display_phone text not null default '',
  access_token_enc text not null,
  app_secret_enc text not null,
  verify_token_hash bytea not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (tenant_id, business_id) references public.businesses(tenant_id, id) on delete cascade
);
alter table public.whatsapp_accounts enable row level security;
create trigger updated_at before update on public.whatsapp_accounts for each row execute function private.touch_updated_at();
create trigger immutable_scope before update on public.whatsapp_accounts for each row execute function private.preserve_scope();
revoke all on public.whatsapp_accounts from anon, authenticated;
grant all on public.whatsapp_accounts to service_role;

-- Uma conversa por pessoa e canal. `history` guarda a conversa no formato
-- da API (incluindo blocos de raciocínio), só acrescentada, nunca editada.
create table public.conversations (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null,
  business_id uuid not null,
  channel text not null check (channel in ('web', 'whatsapp')),
  contact_phone text not null default '',
  contact_name text not null default '' check (length(contact_name) <= 100),
  token_hash bytea unique,
  status text not null default 'ai' check (status in ('ai', 'human', 'closed')),
  unread integer not null default 0 check (unread >= 0),
  history jsonb not null default '[]'::jsonb,
  -- Mensagens até este instante já foram tratadas pela IA.
  ai_cursor timestamptz not null default now(),
  -- Uma resposta por vez: quem está respondendo segura a conversa até aqui.
  processing_until timestamptz,
  last_message_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (tenant_id, business_id) references public.businesses(tenant_id, id),
  unique (business_id, id)
);
create unique index conversations_whatsapp_contact_idx on public.conversations(business_id, contact_phone) where channel = 'whatsapp';
create index conversations_business_recent_idx on public.conversations(business_id, last_message_at desc);

create table public.conversation_messages (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null,
  business_id uuid not null,
  conversation_id uuid not null,
  role text not null check (role in ('customer', 'assistant', 'staff', 'event')),
  body text not null check (length(body) between 1 and 4000),
  provider_message_id text,
  created_at timestamptz not null default now(),
  foreign key (tenant_id, business_id) references public.businesses(tenant_id, id),
  foreign key (business_id, conversation_id) references public.conversations(business_id, id) on delete cascade
);
create index conversation_messages_conversation_idx on public.conversation_messages(conversation_id, created_at);
-- WhatsApp entrega pelo menos uma vez: a mesma mensagem não entra duas vezes.
create unique index conversation_messages_provider_idx on public.conversation_messages(business_id, provider_message_id) where provider_message_id is not null;

-- Turnos da IA por dia: teto de custo por estabelecimento.
create table public.assistant_usage (
  business_id uuid not null,
  day date not null,
  turns integer not null default 0,
  input_tokens bigint not null default 0,
  output_tokens bigint not null default 0,
  primary key (business_id, day)
);

do $$ declare table_name text; begin
  foreach table_name in array array['conversations', 'conversation_messages', 'assistant_usage'] loop
    execute format('alter table public.%I enable row level security', table_name);
    execute format('grant select on public.%I to authenticated', table_name);
    execute format('grant all on public.%I to service_role', table_name);
    execute format('create policy member_read on public.%I for select to authenticated using (private.member_role(business_id) is not null)', table_name);
    execute format('revoke all on public.%I from anon', table_name);
  end loop;
end; $$;
create trigger updated_at before update on public.conversations for each row execute function private.touch_updated_at();
create trigger immutable_scope before update on public.conversations for each row execute function private.preserve_scope();

-- Reserva um turno da IA hoje (dia de São Paulo). Falso quando o teto do
-- dia acabou: o cliente recebe um aviso e o dono assume.
create function public.assistant_take_turn(p_business_id uuid)
returns boolean language plpgsql set search_path = '' as $$
declare cap integer; used integer; today date := (now() at time zone 'America/Sao_Paulo')::date; begin
  select assistant_daily_limit into cap from public.business_settings where business_id = p_business_id;
  if cap is null then return false; end if;
  insert into public.assistant_usage (business_id, day, turns) values (p_business_id, today, 1)
  on conflict (business_id, day) do update set turns = public.assistant_usage.turns + 1
  returning turns into used;
  if used > cap then
    update public.assistant_usage set turns = turns - 1 where business_id = p_business_id and day = today;
    return false;
  end if;
  return true;
end; $$;
revoke all on function public.assistant_take_turn(uuid) from public, anon, authenticated;
grant execute on function public.assistant_take_turn(uuid) to service_role;

create function public.assistant_add_tokens(p_business_id uuid, p_input bigint, p_output bigint)
returns void language sql set search_path = '' as $$
  update public.assistant_usage set input_tokens = input_tokens + greatest(p_input, 0), output_tokens = output_tokens + greatest(p_output, 0)
  where business_id = p_business_id and day = (now() at time zone 'America/Sao_Paulo')::date;
$$;
revoke all on function public.assistant_add_tokens(uuid, bigint, bigint) from public, anon, authenticated;
grant execute on function public.assistant_add_tokens(uuid, bigint, bigint) to service_role;

-- Segura a conversa para uma resposta da IA (ou devolve falso se outra
-- resposta está em andamento). A trava expira sozinha.
create function public.conversation_lease(p_conversation_id uuid, p_seconds integer default 90)
returns boolean language sql set search_path = '' as $$
  with taken as (
    update public.conversations set processing_until = now() + make_interval(secs => p_seconds)
    where id = p_conversation_id and (processing_until is null or processing_until < now())
    returning 1
  ) select exists(select 1 from taken);
$$;
revoke all on function public.conversation_lease(uuid, integer) from public, anon, authenticated;
grant execute on function public.conversation_lease(uuid, integer) to service_role;
