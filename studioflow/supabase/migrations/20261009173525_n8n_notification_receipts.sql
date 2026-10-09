-- Server-only delivery claims; never expose contacts or credentials to n8n.
create table public.n8n_notification_receipts (
  business_id uuid not null references public.businesses(id),
  professional_id uuid not null references public.professionals(id),
  kind text not null check (kind in ('inactive_customer','abandoned_conversation')),
  target_id uuid not null,
  episode timestamptz not null,
  status text not null default 'claimed' check (status in ('claimed','sent','failed')),
  created_at timestamptz not null default now(),
  sent_at timestamptz,
  primary key (business_id,professional_id,kind,target_id,episode),
  foreign key (business_id,professional_id) references public.professionals(business_id,id)
);
alter table public.n8n_notification_receipts enable row level security;
revoke all on public.n8n_notification_receipts from anon,authenticated;
grant select,insert,update on public.n8n_notification_receipts to service_role;
