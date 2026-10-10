-- Run only after the /api/cron/appointments deployment is Ready.
-- Free Supabase scheduler; does not buy a Vercel/Render paid plan.
-- Generate the credential inside the database; never return it to the client.
create extension if not exists pg_cron with schema pg_catalog;
create extension if not exists pg_net with schema extensions;
do $$
begin
  if not exists(select 1 from vault.secrets where name='studioflow_appointment_scheduler') then
    perform vault.create_secret(encode(extensions.gen_random_bytes(32),'hex'),'studioflow_appointment_scheduler','StudioFlow appointment reminder scheduler');
  end if;
  perform cron.schedule('studioflow-appointment-reminders','*/5 * * * *',
    $job$select net.http_post(
      url:='https://app.studioflowapp.tech/api/cron/appointments',
      headers:=jsonb_build_object('Content-Type','application/json','Authorization',
        'Bearer '||(select decrypted_secret from vault.decrypted_secrets where name='studioflow_appointment_scheduler')),
      body:='{}'::jsonb,timeout_milliseconds:=60000
    );$job$);
end $$;
