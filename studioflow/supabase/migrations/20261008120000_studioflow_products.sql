-- Venda de produtos: pomadas, óleos e afins, com estoque.
-- Venda no atendimento ou no balcão; a baixa do estoque e o registro da
-- venda acontecem juntos, numa rotina só do servidor.

create table public.products (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null,
  business_id uuid not null,
  name text not null check (length(trim(name)) between 2 and 80),
  description text not null default '' check (length(description) <= 300),
  price numeric(12,2) not null check (price >= 0 and price <= 100000),
  cost numeric(12,2) check (cost >= 0 and cost <= 100000),
  stock integer not null default 0 check (stock >= 0 and stock <= 100000),
  min_stock integer not null default 0 check (min_stock >= 0 and min_stock <= 100000),
  image text not null default '',
  show_public boolean not null default true,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (tenant_id, business_id) references public.businesses(tenant_id, id),
  unique (business_id, id)
);
create index products_business_idx on public.products(business_id) where active;

create table public.product_sales (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null,
  business_id uuid not null,
  appointment_id uuid,
  customer_id uuid,
  customer_name text not null default '' check (length(customer_name) <= 100),
  -- Retrato da venda: [{productId, name, quantity, price}]
  items jsonb not null check (jsonb_typeof(items) = 'array' and jsonb_array_length(items) between 1 and 30),
  total numeric(12,2) not null check (total >= 0),
  method text not null check (method in ('pix', 'cash', 'credit', 'debit', 'other')),
  status text not null default 'paid' check (status in ('paid', 'cancelled')),
  sold_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (tenant_id, business_id) references public.businesses(tenant_id, id),
  foreign key (business_id, appointment_id) references public.appointments(business_id, id),
  foreign key (business_id, customer_id) references public.customers(business_id, id),
  unique (business_id, id)
);
create index product_sales_business_created_idx on public.product_sales(business_id, created_at);

do $$ declare table_name text; begin
  foreach table_name in array array['products', 'product_sales'] loop
    execute format('alter table public.%I enable row level security', table_name);
    execute format('create trigger updated_at before update on public.%I for each row execute function private.touch_updated_at()', table_name);
    execute format('create trigger immutable_scope before update on public.%I for each row execute function private.preserve_scope()', table_name);
    execute format('grant select on public.%I to authenticated', table_name);
    execute format('grant all on public.%I to service_role', table_name);
    execute format('create policy member_read on public.%I for select to authenticated using (private.member_role(business_id) is not null)', table_name);
    execute format('revoke all on public.%I from anon', table_name);
  end loop;
end; $$;

-- Venda: confere o papel de quem vende, trava os produtos, confere o
-- estoque, dá baixa e registra. Tudo ou nada.
create function public.sell_products(p_business_id uuid, p_user_id uuid, p_input jsonb)
returns jsonb language plpgsql set search_path = '' as $$
declare
  role text; item jsonb; product public.products; quantity integer;
  lines jsonb := '[]'::jsonb; amount numeric(12,2) := 0; sale public.product_sales;
  appointment public.appointments; appointment_ref uuid; customer uuid; customer_label text;
begin
  select m.role into role from public.business_members m
  where m.business_id = p_business_id and m.user_id = p_user_id and m.active;
  if role is null or role = 'professional' then raise exception 'forbidden'; end if;
  if jsonb_typeof(p_input->'items') <> 'array' or jsonb_array_length(p_input->'items') not between 1 and 30 then
    raise exception 'invalid items';
  end if;
  if coalesce(p_input->>'method', '') not in ('pix', 'cash', 'credit', 'debit', 'other') then
    raise exception 'invalid method';
  end if;
  if nullif(p_input->>'appointmentId', '') is not null then
    select * into appointment from public.appointments
    where business_id = p_business_id and id = (p_input->>'appointmentId')::uuid;
    if not found then raise exception 'appointment not found'; end if;
    appointment_ref := appointment.id; customer := appointment.customer_id; customer_label := appointment.customer_name;
  elsif nullif(p_input->>'customerId', '') is not null then
    select id, name into customer, customer_label from public.customers
    where business_id = p_business_id and id = (p_input->>'customerId')::uuid;
    if customer is null then raise exception 'customer not found'; end if;
  else
    customer_label := left(coalesce(p_input->>'customerName', ''), 100);
  end if;
  -- Locks in a stable order so two sales of the same items never deadlock.
  for item in select value from jsonb_array_elements(p_input->'items') order by value->>'productId' loop
    quantity := (item->>'quantity')::integer;
    if quantity is null or quantity not between 1 and 999 then raise exception 'invalid quantity'; end if;
    select * into product from public.products
    where business_id = p_business_id and id = (item->>'productId')::uuid and active for update;
    if not found then raise exception 'product not found'; end if;
    if product.stock < quantity then raise exception 'insufficient stock: %', product.name; end if;
    update public.products set stock = stock - quantity where id = product.id;
    lines := lines || jsonb_build_object('productId', product.id, 'name', product.name, 'quantity', quantity, 'price', product.price);
    amount := amount + product.price * quantity;
  end loop;
  insert into public.product_sales (tenant_id, business_id, appointment_id, customer_id, customer_name, items, total, method, sold_by)
  values (
    (select tenant_id from public.businesses where id = p_business_id), p_business_id,
    appointment_ref, customer, coalesce(customer_label, ''), lines, amount, p_input->>'method', p_user_id
  ) returning * into sale;
  return to_jsonb(sale);
end; $$;
revoke all on function public.sell_products(uuid, uuid, jsonb) from public, anon, authenticated;
grant execute on function public.sell_products(uuid, uuid, jsonb) to service_role;

-- Cancelar devolve as quantidades ao estoque, uma vez.
create function public.cancel_product_sale(p_business_id uuid, p_user_id uuid, p_sale_id uuid)
returns jsonb language plpgsql set search_path = '' as $$
declare role text; sale public.product_sales; item jsonb;
begin
  select m.role into role from public.business_members m
  where m.business_id = p_business_id and m.user_id = p_user_id and m.active;
  if role is null or role not in ('owner', 'admin', 'manager') then raise exception 'forbidden'; end if;
  select * into sale from public.product_sales where business_id = p_business_id and id = p_sale_id for update;
  if not found then raise exception 'sale not found'; end if;
  if sale.status = 'cancelled' then return to_jsonb(sale); end if;
  for item in select value from jsonb_array_elements(sale.items) loop
    update public.products set stock = stock + (item->>'quantity')::integer
    where business_id = p_business_id and id = (item->>'productId')::uuid;
  end loop;
  update public.product_sales set status = 'cancelled' where id = sale.id returning * into sale;
  return to_jsonb(sale);
end; $$;
revoke all on function public.cancel_product_sale(uuid, uuid, uuid) from public, anon, authenticated;
grant execute on function public.cancel_product_sale(uuid, uuid, uuid) to service_role;
