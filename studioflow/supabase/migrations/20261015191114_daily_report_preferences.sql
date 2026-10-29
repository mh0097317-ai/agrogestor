alter table public.weekly_report_preferences
  add column daily_enabled boolean not null default false,
  add constraint daily_report_requires_phone check (not daily_enabled or owner_phone <> '');
-- Existing service-role-only grants and RLS stay in place. No subscriptions are activated.
