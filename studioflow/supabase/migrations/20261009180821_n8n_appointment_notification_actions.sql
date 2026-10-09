alter table public.n8n_notification_receipts drop constraint n8n_notification_receipts_kind_check;
alter table public.n8n_notification_receipts add constraint n8n_notification_receipts_kind_check
check (kind in ('inactive_customer','abandoned_conversation','reminder_24h','reminder_2h','no_show_followup','post_appointment','daily_summary'));
