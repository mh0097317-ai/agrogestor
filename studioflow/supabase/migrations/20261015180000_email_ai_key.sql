-- Chave da IA própria dos e-mails (Escrever com IA), separada da do Marketing.
alter table public.platform_email_settings add column ai_key_enc text;
