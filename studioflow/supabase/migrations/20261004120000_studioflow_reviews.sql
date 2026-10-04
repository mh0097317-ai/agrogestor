-- Customer reviews. A customer rates a completed appointment once, through
-- the private booking link (token). Members read their business reviews;
-- the public page only receives averages computed on the server.
create table public.reviews (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null,
  business_id uuid not null,
  appointment_id uuid not null,
  professional_id uuid not null,
  customer_name text not null,
  rating smallint not null check (rating between 1 and 5),
  comment text not null default '' check (char_length(comment) <= 500),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (tenant_id, business_id) references public.businesses (tenant_id, id),
  foreign key (business_id, appointment_id) references public.appointments (business_id, id) on delete cascade,
  foreign key (business_id, professional_id) references public.professionals (business_id, id),
  unique (business_id, appointment_id)
);
create index reviews_business_created_idx on public.reviews (business_id, created_at desc);

alter table public.reviews enable row level security;
create trigger updated_at before update on public.reviews for each row execute function private.touch_updated_at();
create trigger immutable_scope before update on public.reviews for each row execute function private.preserve_scope();
grant select on public.reviews to authenticated;
grant all on public.reviews to service_role;
revoke all on public.reviews from anon;
create policy member_read on public.reviews for select to authenticated using (private.member_role(business_id) is not null);

create function public.submit_review(p_token text, p_rating integer, p_comment text default '')
returns jsonb language plpgsql set search_path = '' as $$
declare appointment public.appointments; saved public.reviews;
begin
  if p_token !~ '^[a-f0-9]{64}$' then raise exception 'booking_not_found'; end if;
  if p_rating is null or p_rating < 1 or p_rating > 5 then raise exception 'invalid_rating'; end if;
  select * into appointment from public.appointments where token_hash = extensions.digest(p_token, 'sha256') for update;
  if not found then raise exception 'booking_not_found'; end if;
  if appointment.status <> 'completed' then raise exception 'review_not_allowed'; end if;
  if exists (select 1 from public.reviews where business_id = appointment.business_id and appointment_id = appointment.id) then
    raise exception 'already_reviewed';
  end if;
  insert into public.reviews (tenant_id, business_id, appointment_id, professional_id, customer_name, rating, comment)
  values (appointment.tenant_id, appointment.business_id, appointment.id, appointment.professional_id,
          split_part(trim(appointment.customer_name), ' ', 1), p_rating, left(trim(coalesce(p_comment, '')), 500))
  returning * into saved;
  return jsonb_build_object('rating', saved.rating, 'comment', saved.comment, 'created_at', saved.created_at);
end; $$;
revoke all on function public.submit_review(text, integer, text) from public, anon, authenticated;
grant execute on function public.submit_review(text, integer, text) to service_role;

-- The booking projection now carries the customer's own review, if any.
create or replace function public.get_booking(p_token text) returns jsonb language plpgsql set search_path = '' as $$
declare appointment public.appointments; begin
 if p_token !~ '^[a-f0-9]{64}$' then return null; end if;
 select * into appointment from public.appointments where token_hash = extensions.digest(p_token, 'sha256');
 if not found then return null; end if;
 return jsonb_build_object('appointment', private.appointment_json(appointment.id) || jsonb_build_object('token', p_token),
 'business', (select to_jsonb(b) from public.businesses b where b.id = appointment.business_id),
 'services', (select jsonb_agg(to_jsonb(s)) from public.services s join public.appointment_services a on a.business_id = s.business_id and a.service_id = s.id where a.business_id = appointment.business_id and a.appointment_id = appointment.id),
 'professional', (select to_jsonb(p) - 'phone' - 'user_id' from public.professionals p where p.business_id = appointment.business_id and p.id = appointment.professional_id),
 'review', (select jsonb_build_object('rating', r.rating, 'comment', r.comment, 'created_at', r.created_at) from public.reviews r where r.business_id = appointment.business_id and r.appointment_id = appointment.id));
end; $$;
revoke all on function public.get_booking(text) from public, anon, authenticated;
grant execute on function public.get_booking(text) to service_role;
