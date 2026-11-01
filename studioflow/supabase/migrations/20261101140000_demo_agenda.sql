-- Agenda de demonstração: a casa usada nas apresentações fica com a agenda
-- cheia como numa barbearia de verdade, sem mandar mensagem para ninguém.
-- Tudo o que ela cria leva demo = true e sai de uma vez ao desligar.

-- Sem "not null": as funções de agendamento montam a linha inteira com
-- jsonb_populate_record, e um campo ausente chega nulo. Nulo = não é exemplo.
alter table public.appointments add column demo boolean default false;
alter table public.business_settings add column demo_agenda boolean default false;
create index appointments_demo_idx on public.appointments(business_id) where demo;

-- Clientes de exemplo: telefones 62 9 0000-00xx, uma faixa sem dono.
create function private.demo_customer_names() returns text[] language sql immutable as $$
  select array['Bruno Costa','Carlos Henrique','Diego Martins','Eduardo Lima','Felipe Araújo',
    'Gabriel Souza','Henrique Alves','Igor Ribeiro','João Vitor','Lucas Fernandes','Marcos Paulo',
    'Matheus Rocha','Nicolas Prado','Otávio Mendes','Pedro Lucas','Rafael Duarte','Renan Carvalho',
    'Samuel Teixeira','Thiago Moreira','Vinícius Castro','Wesley Santos','Arthur Gomes',
    'Caio Nogueira','Davi Monteiro'];
$$;

create function public.seed_demo_agenda(p_business_id uuid, p_days_back integer, p_days_ahead integer)
returns integer language plpgsql security definer set search_path = '' as $$
declare
  biz record;
  st record;
  pro record;
  svc record;
  names text[] := private.demo_customer_names();
  tz text := 'America/Sao_Paulo';
  today date := (now() at time zone 'America/Sao_Paulo')::date;
  d date;
  t time;
  s timestamptz;
  e timestamptz;
  cust uuid;
  pick text;
  appt uuid;
  status text;
  channel text;
  r double precision;
  created integer := 0;
begin
  select id, tenant_id into biz from public.businesses where id = p_business_id;
  if not found then raise exception 'business not found'; end if;
  select * into st from public.business_settings where business_id = p_business_id;

  for i in 1..array_length(names, 1) loop
    insert into public.customers (tenant_id, business_id, name, phone)
    values (biz.tenant_id, biz.id, names[i], '6290000' || lpad(i::text, 4, '0'))
    on conflict (business_id, phone) do nothing;
  end loop;

  for d in select generate_series(today - p_days_back, today + p_days_ahead, interval '1 day')::date loop
    if not (extract(dow from d)::int = any(st.open_days)) then continue; end if;
    for pro in
      select p.* from public.professionals p
      where p.business_id = biz.id and p.active and extract(dow from d)::int = any(p.days)
    loop
      -- Um dia por profissional uma vez só: rodar de novo não duplica.
      if exists (
        select 1 from public.appointments a
        where a.business_id = biz.id and a.professional_id = pro.id and a.demo
          and (a.start at time zone tz)::date = d
      ) then continue; end if;
      t := greatest(pro.start, st.open_start);
      while t < least(pro."end", st.open_end) loop
        if pro.break_start is not null and pro.break_end is not null
          and t >= pro.break_start and t < pro.break_end then
          t := pro.break_end;
          continue;
        end if;
        select sv.* into svc from public.services sv
          join public.professional_services ps on ps.service_id = sv.id and ps.professional_id = pro.id
          where sv.business_id = biz.id and sv.active
          order by random() limit 1;
        exit when not found;
        s := (d + t) at time zone tz;
        e := s + make_interval(mins => svc.duration);
        if (d + t + make_interval(mins => svc.duration))::time > least(pro."end", st.open_end)
          or (d + t + make_interval(mins => svc.duration))::date > d then exit; end if;
        if random() < 0.64 and not exists (
          select 1 from public.appointments a
          where a.business_id = biz.id and a.professional_id = pro.id
            and a.status in ('confirmed', 'pending', 'in_progress', 'completed')
            and tstzrange(a.start, a.occupied_end, '[)') && tstzrange(s, e + make_interval(mins => st.buffer), '[)')
        ) then
          r := random();
          status := case
            when e <= now() then case when r < 0.9 then 'completed' when r < 0.96 then 'no_show' else 'cancelled' end
            when s <= now() then 'in_progress'
            else case when r < 0.92 then 'confirmed' else 'pending' end
          end;
          r := random();
          channel := case when r < 0.5 then 'public_link' when r < 0.78 then 'assistant_whatsapp' else 'manual' end;
          -- Sorteia antes: random() no where mudaria a cada linha comparada.
          pick := '6290000' || lpad((1 + floor(random() * array_length(names, 1)))::int::text, 4, '0');
          select id into cust from public.customers
            where business_id = biz.id and phone = pick;
          insert into public.appointments (
            tenant_id, business_id, customer_id, professional_id, customer_name, customer_phone,
            start, "end", occupied_end, price, status, reminder, booking_channel, demo, created_at
          )
          select biz.tenant_id, biz.id, c.id, pro.id, c.name, c.phone, s, e,
            e + make_interval(mins => st.buffer), svc.price, status, false, channel, true,
            -- Marcado dias antes: nenhum aviso de "agendamento novo" sai.
            least(now(), s) - make_interval(days => 2 + floor(random() * 6)::int)
          from public.customers c where c.id = cust
          returning id into appt;
          insert into public.appointment_services (tenant_id, business_id, appointment_id, service_id, duration, price)
          values (biz.tenant_id, biz.id, appt, svc.id, svc.duration, svc.price);
          -- Avisos já dados por encerrados: lembrete, aviso ao barbeiro e conferência de presença.
          insert into public.appointment_whatsapp_notices (appointment_id, business_id, tenant_id, kind, appointment_start, status)
          select appt, biz.id, biz.tenant_id, k, s, 'failed'
          from unnest(array['customer_reminder', 'professional_new', 'customer_booking', 'professional_checkup']) k;
          created := created + 1;
          t := t + make_interval(mins => svc.duration + st.buffer);
        else
          t := t + interval '30 minutes';
        end if;
      end loop;
    end loop;
  end loop;

  perform public.refresh_demo_customers(p_business_id);
  return created;
end; $$;

-- Quem já passou vira atendido, quem está na cadeira vira "atendendo".
create function public.refresh_demo_agendas() returns integer
language plpgsql security definer set search_path = '' as $$
declare
  b record;
  n integer := 0;
begin
  update public.appointments set status = 'completed'
    where demo and status in ('confirmed', 'pending', 'in_progress') and "end" <= now();
  update public.appointments set status = 'in_progress'
    where demo and status = 'confirmed' and start <= now() and "end" > now();
  for b in select business_id from public.business_settings where demo_agenda loop
    n := n + public.seed_demo_agenda(b.business_id, 0, 7);
  end loop;
  return n;
end; $$;

-- Atendido paga (Pix, cartão ou dinheiro) e o cliente acumula visitas e gasto,
-- para Financeiro, Relatórios e Clientes ficarem como numa casa de verdade.
create function public.refresh_demo_customers(p_business_id uuid) returns void
language plpgsql security definer set search_path = '' as $$
begin
  insert into public.payments (tenant_id, business_id, appointment_id, amount, method, created_at)
  select a.tenant_id, a.business_id, a.id, a.price,
    (array['pix', 'pix', 'pix', 'pix', 'pix', 'credit', 'credit', 'debit', 'debit', 'cash'])[1 + floor(random() * 10)::int],
    a."end"
  from public.appointments a
  where a.business_id = p_business_id and a.demo and a.status = 'completed' and a.price > 0
    and not exists (select 1 from public.payments p where p.business_id = a.business_id and p.appointment_id = a.id);
  update public.customers c set
    visits = coalesce(x.visits, 0),
    total_spent = coalesce(x.spent, 0),
    last_visit = x.last
  from (
    select a.customer_id, count(*) filter (where a.status = 'completed') visits,
      sum(a.price) filter (where a.status = 'completed') spent,
      max(a.start) filter (where a.status = 'completed') last
    from public.appointments a where a.business_id = p_business_id and a.demo
    group by a.customer_id
  ) x
  where c.id = x.customer_id and c.business_id = p_business_id and c.phone like '6290000%';
end; $$;

-- Desligar: some tudo o que a demonstração criou.
create function public.clear_demo_agenda(p_business_id uuid) returns integer
language plpgsql security definer set search_path = '' as $$
declare removed integer;
begin
  update public.business_settings set demo_agenda = false where business_id = p_business_id;
  delete from public.appointment_whatsapp_notices n using public.appointments a
    where n.appointment_id = a.id and a.business_id = p_business_id and a.demo;
  delete from public.appointment_reminder_steps r using public.appointments a
    where r.appointment_id = a.id and a.business_id = p_business_id and a.demo;
  delete from public.appointment_services x using public.appointments a
    where x.appointment_id = a.id and a.business_id = p_business_id and a.demo;
  delete from public.payments x using public.appointments a
    where x.appointment_id = a.id and x.business_id = a.business_id and a.business_id = p_business_id and a.demo;
  delete from public.commissions x using public.appointments a
    where x.appointment_id = a.id and x.business_id = a.business_id and a.business_id = p_business_id and a.demo;
  delete from public.appointments where business_id = p_business_id and demo;
  get diagnostics removed = row_count;
  delete from public.customers c where c.business_id = p_business_id and c.phone like '6290000%'
    and not exists (select 1 from public.appointments a where a.customer_id = c.id);
  return removed;
end; $$;

revoke all on function public.seed_demo_agenda(uuid, integer, integer) from public, anon, authenticated;
revoke all on function public.refresh_demo_agendas() from public, anon, authenticated;
revoke all on function public.refresh_demo_customers(uuid) from public, anon, authenticated;
revoke all on function public.clear_demo_agenda(uuid) from public, anon, authenticated;
revoke all on function private.demo_customer_names() from public, anon, authenticated;
grant execute on function public.seed_demo_agenda(uuid, integer, integer) to service_role;
grant execute on function public.refresh_demo_agendas() to service_role;
grant execute on function public.refresh_demo_customers(uuid) to service_role;
grant execute on function public.clear_demo_agenda(uuid) to service_role;
