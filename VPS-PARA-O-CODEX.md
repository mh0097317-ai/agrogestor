# Tarefas na VPS (Hostinger) — StudioFlow

Contexto: o app roda na Vercel (https://app.studioflowapp.tech) com banco no Supabase.
A VPS roda Evolution API (WhatsApp), n8n, Postgres e Redis em Docker, com proxy na frente.
Regras: nunca rodar `docker compose down -v` (apaga os volumes/sessões do WhatsApp);
nunca colar chaves em chat ou log; fazer snapshot da VPS na Hostinger antes de mexer.

## 1. Fazer o n8n rodar (prioridade)
- `docker compose ps` e `docker compose logs --tail=200 n8n`: ver se o container sobe ou reinicia em loop.
- Conferir no `.env` do n8n: `N8N_HOST=n8n.studioflowapp.tech`, `N8N_PROTOCOL=https`,
  `WEBHOOK_URL=https://n8n.studioflowapp.tech/`, `N8N_ENCRYPTION_KEY` fixo (não trocar, senão perde as credenciais),
  `GENERIC_TIMEZONE=America/Sao_Paulo`, e a conexão com o Postgres.
- Hoje `https://n8n.studioflowapp.tech/healthz` responde 401 (senha do proxy). Liberar `/healthz` sem senha
  para o monitoramento, ou testar de dentro da VPS: `curl -s localhost:5678/healthz`.
- Os webhooks que o app chama precisam estar ATIVOS (produção, não "test URL"):
  `/webhook/studioflow-confirmacao` e `/webhook/studioflow-whatsapp`.
- O usuário/senha (basic auth) e o token desses webhooks precisam bater com as variáveis da Vercel:
  `N8N_BOOKING_EVENTS`, `N8N_WHATSAPP` e `N8N_INTEGRATIONS` (JSON com businessId, professionalId, token...).
  Os workflows chamam o app em `https://app.studioflowapp.tech/api/integrations/n8n/{consultar,candidatos,notificar}`
  com o header `x-studioflow-integration-token`. Trocar qualquer URL antiga `studioflow-three-tau.vercel.app`
  pelo domínio novo nos nós HTTP dos workflows.
- Teste ponta a ponta com número controlado: mensagem no WhatsApp → n8n → resposta; agendamento de teste → aviso de confirmação.

## 2. Evolution apontando para o domínio novo
- No `.env` da Evolution (pasta ops/evolution do repo): `STUDIOFLOW_ORIGIN=https://app.studioflowapp.tech`, depois
  `docker compose up -d` (sem `-v`).
- Os webhooks das instâncias foram gravados com o domínio antigo. Para cada instância, regravar o webhook com o
  domínio novo (`POST /webhook/set/{instancia}` mantendo o mesmo header `x-studioflow-webhook-token`), ou reconectar
  pelo painel do StudioFlow. O domínio antigo ainda funciona, então dá para fazer sem pressa, uma instância por vez,
  testando uma mensagem depois de cada uma.
- Manter a imagem fixa em `v2.3.7` até testar uma versão nova numa instância de teste.

## 3. Backup diário fora da VPS
- Script diário (cron do sistema, 03:00): `pg_dump` do Postgres da Evolution e do n8n, tar do volume
  `evolution_instances` e dos dados do n8n, mais os `.env` (criptografados, ex.: `age` ou `gpg`).
- Enviar para fora da VPS (rclone para Google Drive, Backblaze B2 ou S3). Guardar 7 diários e 4 semanais.
- Testar a restauração uma vez numa VPS ou container separado e anotar o passo a passo.
- Ligar o snapshot semanal automático da Hostinger como camada extra.

## 4. Monitoramento com alerta
- Subir Uptime Kuma (container leve) monitorando, a cada 1 minuto:
  `https://app.studioflowapp.tech`, n8n `/healthz`, a URL da Evolution e o disco/memória da VPS.
- Alerta no WhatsApp ou Telegram do dono quando algo cair.
- Alerta de disco acima de 80% (`df -h`), porque Postgres e logs enchem a VPS em silêncio.

## 5. Segurança básica
- Firewall (UFW e o da Hostinger): só 22, 80 e 443. Postgres, Redis, 5678 (n8n) e 8080 (Evolution) só na rede interna do Docker.
- SSH só com chave, sem login de root por senha; `fail2ban` ligado.
- `unattended-upgrades` para atualizações de segurança do Ubuntu.
- Rotação de logs do Docker (`max-size: 10m`, `max-file: 3` no daemon.json).
- Painel do n8n com senha forte e 2FA, se o n8n permitir.

## 6. Proteger o WhatsApp contra bloqueio
- Não fazer envio em massa. Limitar o envio por número (ex.: no máximo uma mensagem a cada poucos segundos) nos workflows de automação.
- As automações de retenção (cliente sumido, conversa abandonada) já têm trava no app para não repetir; manter essa trava
  e não criar envios por fora do app.

## 7. Limpeza
- Existe uma checagem no Supabase que chama a cada 5 minutos `https://studioflow-evolution-test.onrender.com/`
  (job `studioflow-evolution-healthcheck`). Se nada mais usa a Evolution do Render, confirmar com o Matheus e o
  Claude remove esse job e desliga o serviço no Render.

## 8. Depois (opcional)
- Serviço de vídeo na VPS (ffmpeg) para gerar Reels automaticamente a partir das artes do modo Marketing.
  O app já gera as imagens em `/api/marketing/image/{id}/{n}.jpg`; o serviço juntaria em MP4 e devolveria o link.
