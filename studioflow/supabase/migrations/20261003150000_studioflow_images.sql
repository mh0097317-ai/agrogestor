-- Public bucket for business photos (cover, logo, gallery, services, team).
-- Files are read through public URLs; uploads happen only on the server
-- (service role) after the API checks the member's role, so no storage
-- policies grant writes or listing to anon/authenticated users.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('images', 'images', true, 3145728, array['image/webp','image/jpeg','image/png'])
on conflict (id) do update set public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

-- New businesses start with an empty description instead of a placeholder.
create or replace function public.create_workspace(p_user_id uuid,p_slug text,p_input jsonb)returns text language plpgsql set search_path='' as $$
declare tenant uuid;business uuid;person uuid;service uuid;professional_name text;service_input jsonb;days integer[];begin
 select array_agg(value::integer)into days from jsonb_array_elements_text(p_input->'openDays');
 insert into public.tenants(name)values(p_input->>'name')returning id into tenant;
 insert into public.businesses(tenant_id,slug,name,category,description,cover)values(tenant,p_slug,p_input->>'name',p_input->>'category','',coalesce(p_input->>'cover',''))returning id into business;
 insert into public.business_members(tenant_id,business_id,user_id,role)values(tenant,business,p_user_id,'owner');
 insert into public.business_settings(tenant_id,business_id,open_days,open_start,open_end)values(tenant,business,days,(p_input->>'openStart')::time,(p_input->>'openEnd')::time);
 for professional_name in select jsonb_array_elements_text(p_input->'professionalNames')loop
  insert into public.professionals(tenant_id,business_id,name,days,"start","end")values(tenant,business,professional_name,days,(p_input->>'openStart')::time,(p_input->>'openEnd')::time)returning id into person;
 end loop;
 for service_input in select jsonb_array_elements(p_input->'services')loop
  insert into public.services(tenant_id,business_id,name,category,duration,price)values(tenant,business,service_input->>'name',p_input->>'category',(service_input->>'duration')::integer,(service_input->>'price')::numeric)returning id into service;
  insert into public.professional_services(tenant_id,business_id,professional_id,service_id)select tenant,business,id,service from public.professionals where business_id=business;
 end loop;
 return p_slug;end;$$;
revoke all on function public.create_workspace(uuid,text,jsonb)from public,anon,authenticated;
grant execute on function public.create_workspace(uuid,text,jsonb)to service_role;
