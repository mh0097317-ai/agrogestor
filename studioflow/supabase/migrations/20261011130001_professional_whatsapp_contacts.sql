-- Keep phone books separate from salon customers and from the AI work queue.
create table public.whatsapp_contacts (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null,
  business_id uuid not null,
  professional_id uuid,
  channel_key text not null,
  phone text not null check(phone ~ '^[0-9]{10,15}$'),
  name text not null default '' check(length(name)<=100),
  synced_at timestamptz not null default now(),
  foreign key(tenant_id,business_id) references public.businesses(tenant_id,id),
  foreign key(business_id,professional_id) references public.professionals(business_id,id),
  check(channel_key=coalesce(professional_id::text,'shop')),
  unique(business_id,channel_key,phone)
);
alter table public.whatsapp_contacts enable row level security;
revoke all on public.whatsapp_contacts from public,anon,authenticated;
grant select on public.whatsapp_contacts to authenticated;
grant select,insert,update on public.whatsapp_contacts to service_role;
create trigger immutable_scope before update on public.whatsapp_contacts for each row execute function private.preserve_scope();

-- The existing professional.user_id is the authenticated assignment, not metadata.
create unique index professionals_one_login_per_business on public.professionals(business_id,user_id) where user_id is not null;
create function private.can_access_professional(p_business uuid,p_professional uuid)
returns boolean language sql stable security invoker set search_path='' as $$
  select coalesce(private.member_role(p_business) in ('owner','admin','manager','receptionist') or
    (private.member_role(p_business)='professional' and exists(
      select 1 from public.professionals p where p.business_id=p_business and p.id=p_professional
      and p.user_id=(select auth.uid()) and p.active
    )),false);
$$;
revoke all on function private.can_access_professional(uuid,uuid) from public,anon;
grant execute on function private.can_access_professional(uuid,uuid) to authenticated,service_role;

drop policy member_read on public.conversations;
create policy member_read on public.conversations for select to authenticated
using(private.can_access_professional(business_id,whatsapp_professional_id));
drop policy member_read on public.conversation_messages;
create policy member_read on public.conversation_messages for select to authenticated
using(exists(select 1 from public.conversations c where c.business_id=conversation_messages.business_id and c.id=conversation_messages.conversation_id));
create policy member_read on public.whatsapp_contacts for select to authenticated
using(private.can_access_professional(business_id,professional_id));

-- A professional's workspace shows their appointments and associated customers.
drop policy member_read on public.appointments;
create policy member_read on public.appointments for select to authenticated
using(private.can_access_professional(business_id,professional_id));
drop policy member_read on public.blocked_times;
create policy member_read on public.blocked_times for select to authenticated
using(private.can_access_professional(business_id,professional_id));
drop policy member_read on public.appointment_services;
create policy member_read on public.appointment_services for select to authenticated
using(exists(select 1 from public.appointments a where a.business_id=appointment_services.business_id and a.id=appointment_services.appointment_id));
drop policy member_read on public.payments;
create policy member_read on public.payments for select to authenticated
using(exists(select 1 from public.appointments a where a.business_id=payments.business_id and a.id=payments.appointment_id));
drop policy member_read on public.commissions;
create policy member_read on public.commissions for select to authenticated
using(private.can_access_professional(business_id,professional_id));
drop policy member_read on public.customers;
create policy member_read on public.customers for select to authenticated using(
 private.member_role(business_id) in ('owner','admin','manager','receptionist') or
 (private.member_role(business_id)='professional' and exists(select 1 from public.appointments a where a.business_id=customers.business_id and a.customer_id=customers.id))
);

drop policy member_read on public.waitlist;
create policy member_read on public.waitlist for select to authenticated
using(private.can_access_professional(business_id,professional_id));
-- Central financial records remain available to salon staff, not individual logins.
drop policy member_read on public.memberships;
create policy member_read on public.memberships for select to authenticated
using(private.member_role(business_id) in ('owner','admin','manager','receptionist'));
drop policy member_read on public.product_sales;
create policy member_read on public.product_sales for select to authenticated
using(private.member_role(business_id) in ('owner','admin','manager','receptionist'));

create table public.professional_access_invites (
  business_id uuid not null,
  professional_id uuid not null,
  tenant_id uuid not null,
  token_hash bytea not null unique,
  email text not null check(length(email)<=254),
  expires_at timestamptz not null,
  accepted_by uuid references auth.users(id),
  accepted_at timestamptz,
  created_by uuid not null references auth.users(id),
  primary key(business_id,professional_id),
  foreign key(tenant_id,business_id) references public.businesses(tenant_id,id),
  foreign key(business_id,professional_id) references public.professionals(business_id,id)
);
alter table public.professional_access_invites enable row level security;
revoke all on public.professional_access_invites from public,anon,authenticated;
grant select,insert,update on public.professional_access_invites to service_role;

create function public.create_professional_invite(p_business uuid,p_professional uuid,p_actor uuid,p_email text,p_hash bytea)
returns void language plpgsql security invoker set search_path='' as $$
declare person public.professionals; begin
 if not exists(select 1 from public.business_members where business_id=p_business and user_id=p_actor and active and role in('owner','admin','manager')) then raise exception 'forbidden'; end if;
 select * into person from public.professionals where business_id=p_business and id=p_professional and active for update;
 if person.id is null then raise exception 'not-found'; end if;
 if person.user_id is not null then raise exception 'already-linked'; end if;
 if length(p_hash)<>32 or length(p_email)>254 or p_email !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$' then raise exception 'invalid-invite'; end if;
 insert into public.professional_access_invites(business_id,professional_id,tenant_id,token_hash,email,expires_at,created_by)
 values(p_business,p_professional,person.tenant_id,p_hash,lower(trim(p_email)),now()+interval '7 days',p_actor)
 on conflict(business_id,professional_id) do update set token_hash=excluded.token_hash,email=excluded.email,expires_at=excluded.expires_at,created_by=excluded.created_by,accepted_by=null,accepted_at=null;
end $$;

-- Email/confirmation come exclusively from server auth.getUser(), never request data.
-- Keep service_role-only execution without granting access to auth.users.
create function public.accept_professional_invite(p_hash bytea,p_user uuid,p_email text,p_confirmed boolean)
returns uuid language plpgsql security invoker set search_path='' as $$
declare invitation public.professional_access_invites; person public.professionals; existing_role text; begin
 select * into invitation from public.professional_access_invites where token_hash=p_hash for update;
 if invitation.business_id is null or invitation.expires_at<now() or invitation.accepted_at is not null then raise exception 'invalid-invite'; end if;
 if lower(p_email) is distinct from invitation.email or not coalesce(p_confirmed,false) then raise exception 'wrong-account'; end if;
 select * into person from public.professionals where business_id=invitation.business_id and id=invitation.professional_id and active for update;
 if person.id is null or person.user_id is not null then raise exception 'already-linked'; end if;
 select role into existing_role from public.business_members where business_id=invitation.business_id and user_id=p_user;
 if existing_role is not null and existing_role<>'professional' then raise exception 'existing-team-account'; end if;
 if exists(select 1 from public.professionals where business_id=invitation.business_id and user_id=p_user) then raise exception 'already-linked'; end if;
 insert into public.business_members(tenant_id,business_id,user_id,role,active) values(invitation.tenant_id,invitation.business_id,p_user,'professional',true)
 on conflict(business_id,user_id) do update set active=true;
 update public.professionals set user_id=p_user where id=person.id and business_id=person.business_id;
 update public.professional_access_invites set accepted_by=p_user,accepted_at=now() where business_id=invitation.business_id and professional_id=invitation.professional_id;
 return invitation.business_id;
end $$;
revoke all on function public.create_professional_invite(uuid,uuid,uuid,text,bytea),public.accept_professional_invite(bytea,uuid,text,boolean) from public,anon,authenticated;
grant execute on function public.create_professional_invite(uuid,uuid,uuid,text,bytea),public.accept_professional_invite(bytea,uuid,text,boolean) to service_role;
