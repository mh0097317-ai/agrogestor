-- Mensalidade do StudioFlow: cobrança pelo Asaas da plataforma.
-- Pagou → o acesso ganha os dias da fatura sozinho. Só o servidor lê.

create table public.platform_invoices (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  asaas_charge_id text not null unique check (length(asaas_charge_id) between 3 and 80),
  value numeric(12,2) not null check (value > 0 and value <= 100000),
  period_days integer not null default 30 check (period_days between 1 and 366),
  due_date date not null,
  invoice_url text not null default '' check (length(invoice_url) <= 500),
  status text not null default 'pending' check (status in ('pending', 'paid', 'cancelled')),
  paid_at timestamptz,
  created_at timestamptz not null default now()
);
create index platform_invoices_business_idx on public.platform_invoices(business_id, created_at desc);
-- No máximo uma fatura em aberto por estabelecimento.
create unique index platform_invoices_open_idx on public.platform_invoices(business_id) where status = 'pending';
alter table public.platform_invoices enable row level security;
revoke all on public.platform_invoices from anon, authenticated;
grant all on public.platform_invoices to service_role;

-- Avisos de vencimento já enviados (um por etapa e por vencimento).
create table public.platform_billing_notices (
  business_id uuid not null references public.businesses(id) on delete cascade,
  stage text not null check (stage in ('soon', 'today', 'late')),
  period_until timestamptz not null,
  sent_at timestamptz not null default now(),
  primary key (business_id, stage, period_until)
);
alter table public.platform_billing_notices enable row level security;
revoke all on public.platform_billing_notices from anon, authenticated;
grant all on public.platform_billing_notices to service_role;

alter table public.platform_access_events drop constraint if exists platform_access_events_action_check;
alter table public.platform_access_events add constraint platform_access_events_action_check
  check (action in ('created', 'granted', 'unlimited', 'until', 'suspended', 'pending', 'note', 'plan', 'paid'));

-- Pagamento confirmado: marca a fatura e soma os dias ao acesso, uma vez só.
create function public.platform_invoice_paid(p_charge_id text) returns jsonb
language plpgsql set search_path = '' as $$
declare inv public.platform_invoices; acc public.platform_access; base timestamptz;
begin
  update public.platform_invoices set status = 'paid', paid_at = now()
    where asaas_charge_id = p_charge_id and status = 'pending' returning * into inv;
  if not found then return null; end if;
  select * into acc from public.platform_access where business_id = inv.business_id for update;
  if not found then
    insert into public.platform_access (business_id) values (inv.business_id) returning * into acc;
  end if;
  -- Sem prazo continua sem prazo: só registra o pagamento.
  if acc.status = 'active' and acc.access_until is null then
    insert into public.platform_access_events (business_id, action, days, access_until, actor)
      values (inv.business_id, 'paid', inv.period_days, null, null);
    return jsonb_build_object('business_id', inv.business_id, 'access_until', null);
  end if;
  base := case when acc.access_until is not null and acc.access_until > now() then acc.access_until else now() end;
  update public.platform_access
    set status = 'active', access_until = base + make_interval(days => inv.period_days), updated_by = null
    where business_id = inv.business_id returning * into acc;
  insert into public.platform_access_events (business_id, action, days, access_until, actor)
    values (inv.business_id, 'paid', inv.period_days, acc.access_until, null);
  return jsonb_build_object('business_id', inv.business_id, 'access_until', acc.access_until);
end; $$;
revoke all on function public.platform_invoice_paid(text) from public, anon, authenticated;
grant execute on function public.platform_invoice_paid(text) to service_role;
