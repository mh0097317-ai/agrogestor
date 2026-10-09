-- Additive attribution. Historical channels cannot be inferred reliably.
alter table public.appointments
  add column booking_channel text not null default 'legacy'
    check (booking_channel in ('legacy','manual','public_link','assistant_web','assistant_whatsapp','assistant_instagram')),
  add column conversation_id uuid,
  add constraint appointment_conversation_scope foreign key (business_id,conversation_id)
    references public.conversations(business_id,id);
-- Unknown callers keep legacy attribution during a rolling deploy.
create index appointments_business_created_idx on public.appointments(business_id,created_at);
-- payments_business_created_idx already exists in the initial migration.
create index messages_business_created_idx on public.conversation_messages(business_id,created_at) where role='customer';

-- Channel is chosen by trusted server adapters, never from a public request body.
-- Reservation + attribution commit together, preserving the existing booking engine.
create function public.book_tracked_appointment(
  p_business_id uuid,p_service_ids uuid[],p_professional_id uuid,p_start timestamptz,
  p_name text,p_phone text,p_email text default null,p_reminder boolean default false,
  p_channel text default 'public_link',p_conversation_id uuid default null
) returns jsonb language plpgsql set search_path='' as $$
declare result jsonb; enabled boolean; convo_channel text;
begin
  if p_channel is null or p_channel not in ('public_link','assistant_web','assistant_whatsapp','assistant_instagram') then
    raise exception 'invalid booking channel';
  end if;
  perform pg_advisory_xact_lock(hashtextextended(p_business_id::text,0));
  if p_channel <> 'public_link' then
    select assistant_enabled into enabled from public.business_settings where business_id=p_business_id for share;
    if enabled is distinct from true then raise exception 'assistant disabled'; end if;
    select channel into convo_channel from public.conversations
      where id=p_conversation_id and business_id=p_business_id and status='ai' for share;
    if convo_channel is distinct from substring(p_channel from 11) then raise exception 'invalid conversation scope'; end if;
  elsif p_conversation_id is not null then
    raise exception 'invalid conversation scope';
  end if;
  if p_channel in ('public_link','assistant_web') then
    result := public.book_public_appointment(p_business_id,p_service_ids,p_professional_id,p_start,p_name,p_phone,p_email,p_reminder);
  else
    result := public.book_appointment(p_business_id,p_service_ids,p_professional_id,p_start,p_name,p_phone,p_email,p_reminder);
  end if;
  update public.appointments set booking_channel=p_channel,conversation_id=p_conversation_id
    where id=(result->>'id')::uuid and business_id=p_business_id;
  return result || jsonb_build_object('booking_channel',p_channel,'conversation_id',p_conversation_id);
end; $$;
revoke all on function public.book_tracked_appointment(uuid,uuid[],uuid,timestamptz,text,text,text,boolean,text,uuid) from public,anon,authenticated;
grant execute on function public.book_tracked_appointment(uuid,uuid[],uuid,timestamptz,text,text,text,boolean,text,uuid) to service_role;

-- Platform-only control, audited atomically. No tenant impersonation or agenda editing.
create table public.platform_channel_events (
  id uuid primary key default gen_random_uuid(),business_id uuid not null references public.businesses(id),
  actor uuid not null references auth.users(id),channel text not null check(channel in ('public_link','receptionist')),
  enabled boolean not null,created_at timestamptz not null default now()
);
alter table public.platform_channel_events enable row level security;
revoke all on public.platform_channel_events from anon,authenticated;
grant all on public.platform_channel_events to service_role;
create index platform_channel_events_business_idx on public.platform_channel_events(business_id,created_at desc);
create function public.platform_set_channel(p_business_id uuid,p_actor uuid,p_channel text,p_enabled boolean)
returns void language plpgsql set search_path='' as $$
begin
  if not exists(select 1 from public.platform_admins where user_id=p_actor) then raise exception 'forbidden'; end if;
  if p_enabled is null then raise exception 'invalid enabled'; end if;
  if p_channel='public_link' then
    update public.business_settings set online_booking_enabled=p_enabled where business_id=p_business_id;
  elsif p_channel='receptionist' then
    update public.business_settings set assistant_enabled=p_enabled where business_id=p_business_id;
  else raise exception 'invalid channel'; end if;
  if not found then raise exception 'business not found'; end if;
  insert into public.platform_channel_events(business_id,actor,channel,enabled) values(p_business_id,p_actor,p_channel,p_enabled);
end; $$;
revoke all on function public.platform_set_channel(uuid,uuid,text,boolean) from public,anon,authenticated;
grant execute on function public.platform_set_channel(uuid,uuid,text,boolean) to service_role;

-- Aggregates only; client identities, conversations and booking tokens are not returned.
create function public.platform_activity(p_from date,p_to date)
returns setof jsonb language plpgsql stable set search_path='' as $$
declare first_at timestamptz := p_from::timestamp at time zone 'America/Sao_Paulo';
  last_at timestamptz := (p_to+1)::timestamp at time zone 'America/Sao_Paulo';
begin
  if p_from is null or p_to is null or p_to<p_from or p_to-p_from>365 then raise exception 'invalid period'; end if;
  return query select jsonb_build_object(
    'businessId',b.id,'appointments',a.total,'bookingCustomers',a.clients,
    'cancelled',a.cancelled,'publicBookings',a.public_count,'manualBookings',a.manual_count,
    'legacyBookings',a.legacy_count,'assistantBookings',a.assistant_count,'assistantCustomers',a.assistant_clients,'whatsappBookings',a.whatsapp_count,
    'bookedValue',a.booked_value,'completed',(select count(*) from public.appointments ap where ap.business_id=b.id and ap.status='completed' and ap."start">=first_at and ap."start"<last_at),
    'received',r.total+s.total,'assistantReceived',r.assistant_total,'productReceived',s.total,
    'conversations',(select count(distinct m.conversation_id) from public.conversation_messages m where m.business_id=b.id and m.role='customer' and m.created_at>=first_at and m.created_at<last_at),
    'waitingHuman',(select count(*) from public.conversations c where c.business_id=b.id and c.status='human'),
    'turns',u.turns,'inputTokens',u.input_tokens,'outputTokens',u.output_tokens
  ) from public.businesses b
  cross join lateral (
    select count(*) filter(where ap.status<>'cancelled') total,
      count(distinct ap.customer_id) filter(where ap.status<>'cancelled') clients,
      count(*) filter(where ap.status='cancelled') cancelled,
      count(*) filter(where ap.status<>'cancelled' and ap.booking_channel='public_link') public_count,
      count(*) filter(where ap.status<>'cancelled' and ap.booking_channel='manual') manual_count,
      count(*) filter(where ap.status<>'cancelled' and ap.booking_channel='legacy') legacy_count,
      count(*) filter(where ap.status<>'cancelled' and ap.booking_channel like 'assistant_%') assistant_count,
      count(distinct ap.customer_id) filter(where ap.status<>'cancelled' and ap.booking_channel like 'assistant_%') assistant_clients,
      count(*) filter(where ap.status<>'cancelled' and ap.booking_channel='assistant_whatsapp') whatsapp_count,
      coalesce(sum(ap.price) filter(where ap.status<>'cancelled'),0) booked_value
    from public.appointments ap where ap.business_id=b.id and ap.created_at>=first_at and ap.created_at<last_at
  ) a
  cross join lateral (
    select coalesce(sum(p.amount),0) total,coalesce(sum(p.amount) filter(where ap.booking_channel like 'assistant_%'),0) assistant_total
    from public.payments p join public.appointments ap on ap.id=p.appointment_id and ap.business_id=p.business_id
    where p.business_id=b.id and p.created_at>=first_at and p.created_at<last_at
  ) r
  cross join lateral (
    select coalesce(sum(ps.total),0) total from public.product_sales ps where ps.business_id=b.id and ps.status='paid' and ps.created_at>=first_at and ps.created_at<last_at
  ) s
  cross join lateral (
    select coalesce(sum(au.turns),0) turns,coalesce(sum(au.input_tokens),0) input_tokens,coalesce(sum(au.output_tokens),0) output_tokens
    from public.assistant_usage au where au.business_id=b.id and au.day between p_from and p_to
  ) u;
end; $$;
revoke all on function public.platform_activity(date,date) from public,anon,authenticated;
grant execute on function public.platform_activity(date,date) to service_role;

-- The staff record constructor must populate the new non-null column.
-- Preserve existing provenance on edits, and ignore caller-supplied attribution.
-- Preserve internal booking: rename the existing local array to avoid the
-- services table whole-row reference (42702). No permission or domain-rule changes.
create or replace function public.workspace_mutation(p_business_id uuid,p_user_id uuid,p_entity text,p_action text,p_data jsonb)
returns void language plpgsql set search_path='' as $$
declare tenant uuid;member_role text;record_id uuid;payload jsonb;previous jsonb;selected_service_ids uuid[];person uuid;customer uuid;duration_minutes integer;total numeric;buffer_minutes integer;target_business uuid;record_table text;same_services boolean;same_slot boolean;paid numeric;service_record public.services;person_record public.professionals;customer_record public.customers;appointment_record public.appointments;block_record public.blocked_times;payment_record public.payments;business_record public.businesses;settings_record public.business_settings;begin
 select role,tenant_id into member_role,tenant from public.business_members where business_id=p_business_id and user_id=p_user_id and active;
 if not found then raise exception 'forbidden';end if;
 if p_entity in('services','professionals','business','settings','payments')and member_role not in('owner','admin','manager')then raise exception 'forbidden';end if;
 if member_role='professional'then raise exception 'forbidden';end if;
 if p_action not in('create','update','delete')then raise exception 'invalid action';end if;
 perform pg_advisory_xact_lock(hashtextextended(p_business_id::text,0));
 record_id=coalesce((p_data->>'id')::uuid,gen_random_uuid());
 record_table=case p_entity when 'services'then 'services'when 'professionals'then 'professionals'when 'customers'then 'customers'when 'appointments'then 'appointments'when 'blockedTimes'then 'blocked_times'when 'payments'then 'payments'else null end;
 if record_table is not null then
  execute format('select business_id from public.%I where id=$1',record_table)into target_business using record_id;
  if target_business is not null and(target_business<>p_business_id or p_action='create')then raise exception 'identifier already exists or forbidden';end if;
 end if;
 payload=private.snake_json(p_data)-'business_id'-'tenant_id'-'id'-'created_at'-'updated_at'-'token_hash'-'occupied_end';
 if p_entity='services'then select to_jsonb(s)into previous from public.services s where business_id=p_business_id and id=record_id;
 elsif p_entity='professionals'then select to_jsonb(p)into previous from public.professionals p where business_id=p_business_id and id=record_id;
 elsif p_entity='customers'then select to_jsonb(c)into previous from public.customers c where business_id=p_business_id and id=record_id;
 elsif p_entity='appointments'then select private.appointment_json(record_id)into previous; if previous->>'business_id'<>p_business_id::text then raise exception 'forbidden';end if;
 elsif p_entity='blockedTimes'then select to_jsonb(b)into previous from public.blocked_times b where business_id=p_business_id and id=record_id;
 elsif p_entity='payments'then select to_jsonb(p)into previous from public.payments p where business_id=p_business_id and id=record_id;
 elsif p_entity='business'then select to_jsonb(b)into previous from public.businesses b where id=p_business_id;
 elsif p_entity='settings'then select to_jsonb(s)into previous from public.business_settings s where business_id=p_business_id;
 else raise exception 'invalid entity';end if;
 if p_action<>'create'and previous is null then raise exception 'record not found';end if;
 if p_action='delete'then
  if p_entity='services'then update public.services set active=false where business_id=p_business_id and id=record_id;
  elsif p_entity='professionals'then update public.professionals set active=false where business_id=p_business_id and id=record_id;
  elsif p_entity='appointments'then update public.appointments set status='cancelled'where business_id=p_business_id and id=record_id;
  elsif p_entity='customers'then delete from public.customers where business_id=p_business_id and id=record_id;
  elsif p_entity='blockedTimes'then delete from public.blocked_times where business_id=p_business_id and id=record_id;
  elsif p_entity='payments'then delete from public.payments where business_id=p_business_id and id=record_id;
  else raise exception 'invalid delete';end if;
  return;
 end if;
 payload=coalesce(previous,'{}')||payload||jsonb_build_object('id',record_id,'tenant_id',tenant,'business_id',p_business_id);
 if p_entity='services'then
  service_record=jsonb_populate_record(null::public.services,jsonb_build_object('description','','image','','active',true,'created_at',now(),'updated_at',now())||payload);
  insert into public.services values(service_record.*)on conflict(id)do update set name=excluded.name,category=excluded.category,description=excluded.description,duration=excluded.duration,price=excluded.price,image=excluded.image,active=excluded.active;
  if p_data?'professionalIds'then
   delete from public.professional_services where business_id=p_business_id and service_id=record_id;
   insert into public.professional_services(tenant_id,business_id,professional_id,service_id)select tenant,p_business_id,value::uuid,record_id from jsonb_array_elements_text(payload->'professional_ids');
  end if;
 elsif p_entity='professionals'then
  person_record=jsonb_populate_record(null::public.professionals,jsonb_build_object('photo','','phone','','specialties','[]'::jsonb,'commission',0,'active',true,'days','[1,2,3,4,5,6]'::jsonb,'start','09:00','end','18:00','created_at',now(),'updated_at',now())||payload||jsonb_build_object('break_start',nullif(payload->>'break_start',''),'break_end',nullif(payload->>'break_end','')));
  insert into public.professionals values(person_record.*)on conflict(id)do update set name=excluded.name,photo=excluded.photo,phone=excluded.phone,specialties=excluded.specialties,commission=excluded.commission,active=excluded.active,days=excluded.days,"start"=excluded."start","end"=excluded."end",break_start=excluded.break_start,break_end=excluded.break_end;
 elsif p_entity='customers'then
  customer_record=jsonb_populate_record(null::public.customers,jsonb_build_object('visits',0,'total_spent',0,'created_at',now(),'updated_at',now())||payload);
  insert into public.customers values(customer_record.*)on conflict(id)do update set name=excluded.name,phone=excluded.phone,email=excluded.email;
 elsif p_entity='appointments'then
  select array_agg(value::uuid)into selected_service_ids from jsonb_array_elements_text(payload->'service_ids');
  person=(payload->>'professional_id')::uuid;
  same_services=p_action='update'and selected_service_ids @> array(select jsonb_array_elements_text(previous->'service_ids')::uuid)and selected_service_ids <@ array(select jsonb_array_elements_text(previous->'service_ids')::uuid);
  if p_action='update'and not coalesce(same_services,false)and exists(select 1 from public.payments where business_id=p_business_id and appointment_id=record_id)then raise exception 'appointment has payments';end if;
  same_slot=same_services and(payload->>'start')::timestamptz=(previous->>'start')::timestamptz and person=(previous->>'professional_id')::uuid;
  if coalesce(payload->>'status','confirmed')not in('cancelled','no_show')and not coalesce(same_slot,false)and not private.slot_available(p_business_id,person,selected_service_ids,(payload->>'start')::timestamptz,case when p_action='update'then record_id else null end,true)then raise exception 'unavailable';end if;
  if same_services then select sum(duration)into duration_minutes from public.appointment_services where business_id=p_business_id and appointment_id=record_id;total=(previous->>'price')::numeric;
  else select sum(duration),sum(price)into duration_minutes,total from public.services where business_id=p_business_id and id=any(selected_service_ids)and active;end if;
  if duration_minutes is null then raise exception 'invalid services';end if;
  select buffer into buffer_minutes from public.business_settings where business_id=p_business_id;
  customer=(payload->>'customer_id')::uuid;
  if customer is null then
   insert into public.customers(tenant_id,business_id,name,phone)values(tenant,p_business_id,payload->>'customer_name',payload->>'customer_phone')on conflict(business_id,phone)do update set updated_at=now()returning id into customer;
  end if;
  appointment_record=jsonb_populate_record(null::public.appointments,jsonb_build_object('status','confirmed','reminder',false,'created_at',now(),'updated_at',now())||payload||jsonb_build_object('booking_channel',case when p_action='update' then coalesce(previous->>'booking_channel','legacy') else 'manual' end,'conversation_id',case when p_action='update' then previous->'conversation_id' else null end,'customer_id',customer,'price',total,'end',(payload->>'start')::timestamptz+make_interval(mins=>duration_minutes),'occupied_end',case when same_slot then (select occupied_end from public.appointments where business_id=p_business_id and id=record_id)else (payload->>'start')::timestamptz+make_interval(mins=>duration_minutes+buffer_minutes)end,'token_hash',case when p_action='update'then (select token_hash from public.appointments where business_id=p_business_id and id=record_id)else extensions.digest(extensions.gen_random_bytes(32),'sha256')end));
  insert into public.appointments values(appointment_record.*)on conflict(id)do update set customer_id=excluded.customer_id,professional_id=excluded.professional_id,customer_name=excluded.customer_name,customer_phone=excluded.customer_phone,"start"=excluded."start","end"=excluded."end",occupied_end=excluded.occupied_end,price=excluded.price,status=excluded.status,reminder=excluded.reminder;
  if not coalesce(same_services,false)then
   delete from public.appointment_services where business_id=p_business_id and appointment_id=record_id;
   insert into public.appointment_services(tenant_id,business_id,appointment_id,service_id,duration,price)select tenant,p_business_id,record_id,id,duration,price from public.services where business_id=p_business_id and id=any(selected_service_ids);
  end if;
 elsif p_entity='blockedTimes'then
  block_record=jsonb_populate_record(null::public.blocked_times,jsonb_build_object('created_at',now(),'updated_at',now())||payload);
  if exists(select 1 from public.appointments where business_id=p_business_id and professional_id=block_record.professional_id and status in('confirmed','pending','in_progress','completed')and tstzrange("start",occupied_end,'[)')&&tstzrange(block_record."start",block_record."end",'[)'))then raise exception 'unavailable';end if;
  insert into public.blocked_times values(block_record.*)on conflict(id)do update set professional_id=excluded.professional_id,"start"=excluded."start","end"=excluded."end",reason=excluded.reason;
 elsif p_entity='payments'then
  payment_record=jsonb_populate_record(null::public.payments,jsonb_build_object('created_at',now(),'updated_at',now())||payload);
  if p_action='update'and payment_record.appointment_id<>(previous->>'appointment_id')::uuid then raise exception 'payment appointment is immutable';end if;
  select * into appointment_record from public.appointments where business_id=p_business_id and id=payment_record.appointment_id for update;
  if not found or appointment_record.status<>'completed'then raise exception 'complete appointment before payment';end if;
  select coalesce(sum(amount),0)into paid from public.payments where business_id=p_business_id and appointment_id=payment_record.appointment_id and id<>record_id;
  if paid+payment_record.amount>appointment_record.price then raise exception 'payment exceeds remaining balance';end if;
  insert into public.payments values(payment_record.*)on conflict(id)do update set amount=excluded.amount,method=excluded.method;
 elsif p_entity='business'then
  business_record=jsonb_populate_record(null::public.businesses,payload||jsonb_build_object('id',p_business_id));
  update public.businesses set name=business_record.name,category=business_record.category,description=business_record.description,address=business_record.address,phone=business_record.phone,instagram=business_record.instagram,cover=business_record.cover,logo=business_record.logo,color=business_record.color,amenities=business_record.amenities,cnpj=business_record.cnpj,photos=business_record.photos where id=p_business_id;
 elsif p_entity='settings'then
  settings_record=jsonb_populate_record(null::public.business_settings,payload);
  update public.business_settings set min_notice=settings_record.min_notice,max_days=settings_record.max_days,buffer=settings_record.buffer,cancellation_hours=settings_record.cancellation_hours,open_days=settings_record.open_days,open_start=settings_record.open_start,open_end=settings_record.open_end,notifications=settings_record.notifications where business_id=p_business_id;
 end if;
 update public.customers c set visits=(select count(*)from public.appointments a where a.business_id=p_business_id and a.customer_id=c.id and a.status='completed'),last_visit=(select max(a."start")from public.appointments a where a.business_id=p_business_id and a.customer_id=c.id and a.status='completed'),total_spent=coalesce((select sum(p.amount)from public.payments p join public.appointments a on a.business_id=p.business_id and a.id=p.appointment_id where a.business_id=p_business_id and a.customer_id=c.id),0)where c.business_id=p_business_id;
 insert into public.commissions(tenant_id,business_id,appointment_id,professional_id,amount)select tenant,p_business_id,a.id,a.professional_id,a.price*p.commission/100 from public.appointments a join public.professionals p on p.business_id=a.business_id and p.id=a.professional_id where a.business_id=p_business_id and a.status='completed'on conflict(business_id,appointment_id,professional_id)do nothing;
end;$$;
