-- Mensalidade do StudioFlow no cartão, todo mês (assinatura no Asaas da
-- plataforma). Cada cobrança gerada pela assinatura vira uma fatura em
-- platform_invoices e, paga, soma os dias pelo mesmo platform_invoice_paid.
-- Idempotente: o mesmo aviso do Asaas pode chegar várias vezes.
alter table public.businesses add column platform_subscription_id text
  check (platform_subscription_id is null or length(platform_subscription_id) between 3 and 80);
alter table public.platform_invoices add column asaas_subscription_id text
  check (asaas_subscription_id is null or length(asaas_subscription_id) between 3 and 80);

create or replace function public.platform_subscription_charge(
  p_business_id uuid,
  p_charge_id text,
  p_subscription_id text,
  p_value numeric,
  p_due_date date,
  p_invoice_url text,
  p_paid boolean
) returns jsonb
language plpgsql set search_path = '' as $$
declare v_owner uuid;
begin
  -- A assinatura tem que ser a desta casa (nunca confiar só no aviso).
  select id into v_owner from public.businesses
    where id = p_business_id and platform_subscription_id = p_subscription_id;
  if not found then raise exception 'subscription mismatch'; end if;
  if not exists (select 1 from public.platform_invoices where asaas_charge_id = p_charge_id) then
    -- A fatura avulsa em aberto perde o sentido: a assinatura passa a cobrar.
    update public.platform_invoices set status = 'cancelled'
      where business_id = p_business_id and status = 'pending';
    insert into public.platform_invoices
      (business_id, asaas_charge_id, asaas_subscription_id, value, period_days, due_date, invoice_url)
      values (p_business_id, p_charge_id, p_subscription_id, p_value, 30, p_due_date, left(coalesce(p_invoice_url, ''), 500));
  end if;
  if p_paid then
    return coalesce(public.platform_invoice_paid(p_charge_id), jsonb_build_object('already_paid', true));
  end if;
  return jsonb_build_object('registered', true);
end; $$;
revoke all on function public.platform_subscription_charge(uuid, text, text, numeric, date, text, boolean) from public, anon, authenticated;
grant execute on function public.platform_subscription_charge(uuid, text, text, numeric, date, text, boolean) to service_role;
