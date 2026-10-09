-- Operational setup for the existing FREE Evolution test service.
-- Requires the pg_cron / pg_net extensions already used by the reminder jobs.
-- Public health endpoint only: no API key, messages, bookings or customer data.
-- Re-running updates the named job, rather than adding duplicate schedules.
-- This reduces idle spin-down during testing, but cannot guarantee uptime on Free.
-- To stop: select cron.unschedule('studioflow-evolution-healthcheck');
select cron.schedule(
  'studioflow-evolution-healthcheck',
  '*/5 * * * *',
  $job$select net.http_get(
    url:='https://studioflow-evolution-test.onrender.com/',
    timeout_milliseconds:=120000
  );$job$
);
