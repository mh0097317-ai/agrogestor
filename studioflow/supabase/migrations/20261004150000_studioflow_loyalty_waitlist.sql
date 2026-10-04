-- Loyalty card settings. Owners and managers update them through RLS
-- (business_settings already has the admin_update policy).
alter table public.business_settings
  add column loyalty_enabled boolean not null default false,
  add column loyalty_goal integer not null default 10 check (loyalty_goal between 2 and 50),
  add column loyalty_reward text not null default '' check (char_length(loyalty_reward) <= 80);

-- Waitlist for full days. Customers join through the server (service role)
-- after validation; members read and handle entries through RLS.
create table public.waitlist (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null,
  business_id uuid not null,
  service_id uuid not null,
  professional_id uuid,
  desired_date date not null,
  period text not null default 'any' check (period in ('any', 'morning', 'afternoon', 'evening')),
  customer_name text not null check (char_length(trim(customer_name)) between 2 and 100),
  customer_phone text not null check (customer_phone ~ '^[1-9][0-9](9[0-9]{8}|[2-5][0-9]{7})$'),
  status text not null default 'waiting' check (status in ('waiting', 'notified')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (tenant_id, business_id) references public.businesses (tenant_id, id),
  foreign key (business_id, service_id) references public.services (business_id, id) on delete cascade,
  foreign key (business_id, professional_id) references public.professionals (business_id, id) on delete cascade,
  unique (business_id, desired_date, customer_phone, service_id)
);
create index waitlist_business_date_idx on public.waitlist (business_id, desired_date);

alter table public.waitlist enable row level security;
create trigger updated_at before update on public.waitlist for each row execute function private.touch_updated_at();
create trigger immutable_scope before update on public.waitlist for each row execute function private.preserve_scope();
revoke all on public.waitlist from anon;
grant select, delete on public.waitlist to authenticated;
grant update (status) on public.waitlist to authenticated;
grant all on public.waitlist to service_role;
create policy member_read on public.waitlist for select to authenticated
  using (private.member_role(business_id) is not null);
create policy staff_update on public.waitlist for update to authenticated
  using (private.member_role(business_id) in ('owner', 'admin', 'manager', 'receptionist'))
  with check (private.member_role(business_id) in ('owner', 'admin', 'manager', 'receptionist'));
create policy staff_delete on public.waitlist for delete to authenticated
  using (private.member_role(business_id) in ('owner', 'admin', 'manager', 'receptionist'));

-- The receipt shows the loyalty card: completed visits of this customer.
create or replace function public.get_booking(p_token text) returns jsonb language plpgsql set search_path = '' as $$
declare appointment public.appointments; begin
 if p_token !~ '^[a-f0-9]{64}$' then return null; end if;
 select * into appointment from public.appointments where token_hash = extensions.digest(p_token, 'sha256');
 if not found then return null; end if;
 return jsonb_build_object('appointment', private.appointment_json(appointment.id) || jsonb_build_object('token', p_token),
 'business', (select to_jsonb(b) from public.businesses b where b.id = appointment.business_id),
 'services', (select jsonb_agg(to_jsonb(s)) from public.services s join public.appointment_services a on a.business_id = s.business_id and a.service_id = s.id where a.business_id = appointment.business_id and a.appointment_id = appointment.id),
 'professional', (select to_jsonb(p) - 'phone' - 'user_id' from public.professionals p where p.business_id = appointment.business_id and p.id = appointment.professional_id),
 'review', (select jsonb_build_object('rating', r.rating, 'comment', r.comment, 'created_at', r.created_at) from public.reviews r where r.business_id = appointment.business_id and r.appointment_id = appointment.id),
 'loyalty_visits', (select count(*) from public.appointments a where a.business_id = appointment.business_id and a.customer_id = appointment.customer_id and a.status = 'completed'));
end; $$;
revoke all on function public.get_booking(text) from public, anon, authenticated;
grant execute on function public.get_booking(text) to service_role;
