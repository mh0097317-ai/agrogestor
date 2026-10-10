-- Agendamentos do banco (pg_cron) que antes existiam só em produção.
-- Lembretes e retomada da recepcionista chamam o domínio oficial do app.
-- Sem pg_cron (ambiente local e testes) a migração não faz nada.
do $$
declare
  base text := 'https://app.studioflowapp.tech';
  auth text := $a$jsonb_build_object('Content-Type','application/json','Authorization','Bearer '||(select decrypted_secret from vault.decrypted_secrets where name='studioflow_appointment_scheduler' limit 1))$a$;
begin
  if not exists (select 1 from pg_extension where extname = 'pg_cron')
     or not exists (select 1 from pg_extension where extname = 'pg_net') then
    return;
  end if;
  if not exists (select 1 from vault.secrets where name = 'studioflow_appointment_scheduler') then
    perform vault.create_secret(encode(extensions.gen_random_bytes(32), 'hex'),
      'studioflow_appointment_scheduler', 'StudioFlow appointment reminder scheduler');
  end if;
  perform cron.schedule('studioflow-appointment-reminders', '*/5 * * * *',
    format('select net.http_post(url:=%L,headers:=%s,body:=''{}''::jsonb,timeout_milliseconds:=60000);',
      base || '/api/cron/appointments', auth));
  perform cron.schedule('studioflow-assistant-recovery', '* * * * *',
    format('select net.http_post(url:=%L,headers:=%s,body:=''{}''::jsonb,timeout_milliseconds:=60000);',
      base || '/api/cron/assistant', auth));
end $$;
