-- Chave do Resend salva no /admin → E-mails (cifrada). Ela vence a da Vercel.
alter table public.platform_email_settings add column resend_key_enc text;
