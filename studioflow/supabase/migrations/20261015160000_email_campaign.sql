-- E-mails escritos com IA no /admin entram no mesmo histórico.
alter table public.platform_email_log drop constraint platform_email_log_kind_check;
alter table public.platform_email_log add constraint platform_email_log_kind_check
  check (kind in ('billing','welcome','setup','share','weekly','test','campaign'));
