-- WhatsApp que cai fica caído: a Coliseu passou 7 dias desconectada com
-- aviso só por e-mail. Agora cada número guarda desde quando caiu (o
-- updated_at muda a cada evento da Evolution e reiniciava a espera) e quando
-- a StudioFlow tentou reconectar sozinha pela última vez.
alter table public.whatsapp_links
  add column down_since timestamptz,
  add column reconnect_tried_at timestamptz;
alter table public.professional_whatsapp_links
  add column down_since timestamptz,
  add column reconnect_tried_at timestamptz;

-- Quem já está fora conta a partir do último registro conhecido.
update public.whatsapp_links set down_since = updated_at where status <> 'open';
update public.professional_whatsapp_links set down_since = updated_at where status <> 'open';
