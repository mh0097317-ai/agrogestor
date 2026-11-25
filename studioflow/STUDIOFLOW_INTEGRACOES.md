# StudioFlow: integrações, APIs, provedores e autorizações

Auditoria de 25/11/2026. **"Real"** quer dizer que há código de produção chamando o serviço e evidência de uso no banco. **"Implementada sem uso"** quer dizer que o código existe mas não há configuração ou registro em produção. **Simulações** só existem no modo demonstração e são identificadas como tal; nenhuma aparece aqui como integração real.

Legenda de estado:
- ✅ em uso real
- 🟡 implementada, sem configuração ou uso em produção
- 🔴 configurada mas quebrada ou parada
- ⚪ planejada ou inexistente

---

## Resumo

| Integração | Estado | Onde no código | Evidência em produção (25/11) |
| --- | --- | --- | --- |
| Supabase (banco, Auth, Storage, pg_cron) | ✅ | `src/lib/supabase/*`, `src/services/server-store.ts` | 76 tabelas, 63 migrações, 3 jobs ativos |
| Vercel (hospedagem, deploy, cron) | ✅ / 🔴 cron diário | `vercel.json` | Deploy READY `dc1ff6f`; cron de cobrança sem `CRON_SECRET` |
| Evolution API (WhatsApp por QR) | ✅ / 🔴 sessão caída | `src/services/whatsapp/evolution.ts`, `link.ts` | 1 número de loja + 2 de profissionais; o da loja piloto está fora do ar desde 17/11 |
| WhatsApp Business Platform (Meta Cloud API) | 🟡 | `src/services/assistant/whatsapp.ts`, `/api/whatsapp/[businessId]` | 0 contas conectadas |
| Instagram (Direct e feed da loja) | 🟡 | `assistant/instagram.ts`, `instagram-feed.ts`, `shop-instagram.ts` | 0 contas, 0 feeds |
| Anthropic Claude (recepcionista, marketing, e-mails, captação) | ✅ | `assistant/provider.ts`, `admin-vault.ts`, `marketing/ai.ts` | 1 chave no cofre; 294 turnos, cerca de 541 mil tokens |
| OpenAI / "mwapi" (provedor alternativo no cofre) | 🟡 | `assistant/provider.ts` | Nenhuma chave |
| Transcrição de áudio (OpenAI/Groq compatível) | 🟡 | `assistant/transcribe.ts` | 0 credenciais |
| ElevenLabs (voz) | 🟡 parcial | `/api/admin/elevenlabs`, `assistant/speech.ts` | 1 credencial na plataforma |
| Google Gemini / Veo (vídeos do Marketing) | 🟡 | `services/marketing/*` | Sem evidência de uso |
| n8n (VPS) | ✅ legado | `assistant/n8n-*.ts`, `/api/integrations/n8n/*` | 44 recibos de aviso enviados; variáveis `N8N_*` na Vercel |
| Resend (e-mail) | ✅ / 🟡 | `services/email/*` | 32 e-mails da plataforma; 0 e-mails de agendamento |
| Asaas da loja (sinal Pix, clube) | 🟡 | `services/payments/asaas.ts`, `server-payments.ts` | 0 contas conectadas, 0 assinaturas |
| Asaas da plataforma (mensalidade) | 🟡 | `services/billing.ts` | Variáveis ausentes, 0 faturas Asaas; 1 fatura manual |
| Zernio (Instagram da StudioFlow) | ✅ | `services/marketing/*` | 22 posts publicados, 5 falhas |
| Serper (Google Maps na Captação) | ✅ provável | `services/leads/*` | 20 leads; chave guardada no admin ou ambiente |
| BrasilAPI / Minha Receita (CNPJ) | ✅ | `/api/workspace/company-lookup` | Pública, sem chave |
| Google Calendar | ⚪ | — | Inexistente (só arquivo .ics para o cliente) |
| Google Maps (link e embed) | ✅ simples | `businesses.maps_url`, página pública | Só links e embed, sem API paga |
| Reserve with Google / agentes externos | ⚪ | — | Inexistente |
| Nota fiscal (NFS-e/NFC-e) | ⚪ | — | Inexistente |
| Maquininha / POS | ⚪ | — | Inexistente |
| Harvey (e-mail frio, fora do app) | 🟡 | `agrogestor/harvey-studioflow/` (Python) | Roda no computador do dono; não integrado ao app |

---

## 1. Supabase
- **Arquitetura:**
  - Postgres 17 gerenciado (sa-east-1);
  - Auth por e-mail e senha (fluxo SSR com cookies);
  - Storage com 3 buckets públicos de leitura (`images`, `marketing`, `shop-posts`);
  - `pg_cron` com 3 jobs.
- **Autenticação no app:**
  - `NEXT_PUBLIC_SUPABASE_URL` e `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` no navegador e no servidor;
  - `SUPABASE_SECRET_KEY` só no servidor.
- **Segurança:**
  - RLS em 76 de 76 tabelas;
  - RPCs críticas só para `service_role`;
  - o job do pg_cron se autentica no app com um segredo de 64 hex verificado pela RPC `verify_appointment_scheduler`.
- **Limitações:**
  - não há projeto de homologação; o preview da Vercel usa o banco de produção;
  - a proteção contra senhas vazadas está desligada;
  - o painel carrega o "workspace" inteiro de uma vez.
- **Custos:** plano do Supabase não informado no repositório.
- **Pendências:**
  1. Ligar a proteção contra senhas vazadas.
  2. Criar um projeto de staging.
  3. Fazer e testar uma restauração de backup.

## 2. Vercel
- **Configuração:** projeto `studioflow`, região `gru1`, deploy automático a cada push na `main`, domínio `app.studioflowapp.tech`.
- **Cron:** `/api/cron/billing` diário às 12:00 UTC. **Hoje responde 401** porque `CRON_SECRET` não existe nas variáveis.
- **Variáveis:**
  - 10 definidas;
  - `SUPABASE_SECRET_KEY` está como tipo "encrypted" e a Vercel a marca como `readable-secret`. Recomendado: recriar como "sensitive";
  - `NARRATION_TOKEN` é sobra de uma rota removida. Recomendado: apagar.
- **Pendências:**
  1. Criar `CRON_SECRET`.
  2. Corrigir os tipos das variáveis.
  3. Remover as sobras.
  4. Avaliar o plano: a retenção de logs pareceu curta (a consulta de 72 h estourou o tempo).

## 3. WhatsApp pela Evolution API (QR Code)
- **Arquitetura:**
  - servidor Evolution v2.3.7 (Docker) numa VPS Hostinger, com Postgres, Redis e proxy Caddy (`ops/evolution/`);
  - **uma instância por loja** (`sf-<businessId>`), uma por profissional quando ele conecta o próprio número, e uma da plataforma (`sf-studioflow`) para avisos aos donos;
  - URL e chave ficam no cofre `platform_integrations` (cifrado), configuradas no `/admin`.
- **Fluxo:**
  1. QR Code em Configurações → WhatsApp, com checagem a cada 3 s.
  2. Webhook para `/api/evolution/[businessId]?token=<token>`. O token é novo a cada conexão e só o hash fica guardado.
  3. Envio por `sendText`, `sendBookingMenu` (menu numerado em texto) e `sendPdf`.
  4. Espelho do histórico real (`findMessages`) em Conversas.
  5. Sincronização de contatos (523 contatos).
- **Recuperação (24/11):**
  - caído há 5 min ou mais: tenta reconectar no máximo a cada 30 min;
  - caído há 10 min ou mais: avisa o dono por WhatsApp e e-mail, repetindo a cada 12 h.
- **Limitações:**
  - não é API oficial: há risco de bloqueio do número por uso fora da política do WhatsApp;
  - a sessão expira e exige ler o QR de novo;
  - as listas nativas foram recusadas (HTTP 400) e estão desligadas (`STUDIOFLOW_WHATSAPP_NATIVE_LISTS`);
  - um único servidor é ponto único de falha.
- **Situação:** o número da loja piloto está **desconectado desde 17/11**. A reconexão automática de 24/11 ficou em "connecting", ou seja, **precisa ler o QR Code**.
- **Segurança da VPS** (pendências listadas em `VPS-PARA-O-CODEX.md`):
  - backup diário fora da VPS;
  - Uptime Kuma;
  - firewall só com 22/80/443;
  - SSH só por chave e fail2ban;
  - rotação de logs.
  - **Não verificado nesta auditoria** (sem acesso à VPS).
- **Custo:** VPS Hostinger. O valor não está no repositório.

## 4. WhatsApp Business Platform (Meta Cloud API)
- **Implementado:**
  - o dono cola o ID do número, o token permanente e a chave secreta do app, que ficam cifrados em `whatsapp_accounts`;
  - webhook `/api/whatsapp/[businessId]` com verificação `X-Hub-Signature-256` e hash do token de verificação;
  - listas interativas nativas;
  - dedupe por `provider_message_id`.
- **Estado:** nenhuma loja conectada.
- **Autorizações necessárias:**
  - conta Meta Business verificada;
  - número dedicado;
  - app na Meta com WhatsApp;
  - modelos (templates) aprovados para mensagens fora da janela de 24 h (lembretes, retorno);
  - cobrança por conversa da Meta.
- **Recomendação:** é a rota para estabilidade e escala. Exige templates para lembretes; **o código atual envia lembretes como texto livre, o que fora da janela de 24 h só funciona pela Evolution.**

## 5. Instagram
- **Direct (recepcionista):**
  - token da conta profissional e chave do app, cifrados;
  - webhook assinado;
  - a IA responde e pede o WhatsApp para agendar.
- **Feed na página:** últimos 12 posts com cache de 15 min; o token é renovado no cron diário, **que está parado**.
- **Post da loja** (Divulgar): `shop_instagram_posts`.
- **Estado:** 0 contas.
- **Autorizações:** app Meta com Instagram API (login do Instagram, token `IG…`), permissões `instagram_business_basic`, `instagram_business_manage_messages` e `instagram_business_content_publish`, revisão do app pela Meta.

## 6. Provedores de IA
- **Anthropic** (`@anthropic-ai/sdk`):

  | Uso | Modelo |
  | --- | --- |
  | Recepcionista v3 (produção) | `claude-sonnet-5-5` fixo |
  | Interpretador v2 | `claude-haiku-4-5` |
  | Modos de IA (admin) | Haiku 4.5, Sonnet 4.6 e Opus 4.8 |
  | Marketing | Haiku, Sonnet ou Opus 5.5 (padrão Opus 5.5) |

- **Chaves:**
  - por loja, no cofre (`business_ai_credentials`, AES-256-GCM, com chave reserva opcional);
  - da plataforma: `ANTHROPIC_API_KEY`, **ausente** (só quem tem chave própria é atendido);
  - do Marketing: separada (`STUDIOFLOW_MARKETING_ANTHROPIC_KEY` ou cofre).
- **Controle de custo:**
  - `assistant_usage` registra turnos e tokens por dia;
  - teto diário por loja, com alerta em 80%;
  - chave geral da IA no admin.
  - **Não há conversão para R$ nem repasse do custo ao cliente.**
- **Limitações e riscos:**
  - chave recusada (`provider-auth`) derrubou o atendimento em 6 execuções;
  - o modelo fixo ignora o modelo escolhido no cofre;
  - custo por conversa do Sonnet 5.5 é mais alto que o do Haiku (inferência; medir).
- **Outros:**
  - OpenAI e "mwapi" aceitos no cofre (sem uso);
  - transcrição compatível com `/audio/transcriptions` (sem credencial);
  - ElevenLabs (voz, 1 credencial, uso administrativo);
  - Gemini/Veo para vídeos (sem evidência de uso).

## 7. n8n
- **Arquitetura:** n8n na VPS. O app expõe três ferramentas de leitura e notificação:
  - `/api/integrations/n8n/consultar` (catálogo e disponibilidade);
  - `/candidatos`;
  - `/notificar`.
  - Todas usam o cabeçalho `x-studioflow-integration-token`, cujo hash fica em `N8N_INTEGRATIONS`, com escopo por loja e profissional.
- **Outras rotas:** o app envia eventos de reserva para o n8n (`N8N_BOOKING_EVENTS`) e pode delegar o atendimento do WhatsApp a um workflow (`N8N_WHATSAPP`, com basic auth e token).
- **Estado:**
  - 44 recibos de notificação "sent";
  - o atendimento principal migrou para a recepcionista v3 no app;
  - o n8n continua configurado.
- **Pendências:** decidir se o n8n é desligado (menos superfície de ataque) ou mantido só para automações auxiliares. O `healthz` estava atrás de basic auth.

## 8. E-mail: Resend
- **Plataforma → donos:** boas-vindas, relatórios em PDF e e-mails escritos com IA no `/admin`. 32 enviados (`platform_email_log`).
- **Loja → cliente:** confirmação e véspera. Implementado; **0 enviados**, porque só 2 clientes têm e-mail.
- **Remetente:** `EMAIL_FROM`, com padrão `avisos@studioflowapp.tech`. Exige o domínio verificado no Resend (SPF/DKIM). **Não verificado nesta auditoria.**
- **Chave:** `RESEND_API_KEY` na Vercel ou cofre do admin.

## 9. Webhooks (entrada)

| Rota | Origem | Autenticação | Proteções |
| --- | --- | --- | --- |
| `/api/evolution/[businessId]?token=` | Evolution | Token por conexão (hash no banco) | Dedupe, lease, resposta depois do 200 |
| `/api/whatsapp/[businessId]` | Meta | `X-Hub-Signature-256` + verify token (hash) | Dedupe |
| `/api/instagram/[businessId]` | Meta | `X-Hub-Signature-256` | — |
| `/api/payments/asaas/[businessId]` | Asaas da loja | Cabeçalho `asaas-access-token` (hash) | Confirmação idempotente (`confirm_deposit`) |
| `/api/billing/asaas` | Asaas da plataforma | `asaas-access-token` = `STUDIOFLOW_ASAAS_WEBHOOK_TOKEN` | `platform_invoice_paid` idempotente |
| `/api/cron/*` | pg_cron / Vercel | Segredo de 64 hex verificado no banco / `CRON_SECRET` | Comparação em tempo constante |
| `/api/integrations/n8n/*` | n8n | Token com hash | Escopo por loja |

## 10. APIs externas de saída
- Anthropic, Evolution, Meta Graph, Asaas, Resend, Zernio, Serper, ElevenLabs, BrasilAPI/Minha Receita, Google (embed do Maps).
- Todas com `AbortSignal.timeout` nos clientes principais, conforme as amostras lidas (Evolution 15 s, IA com prazo do turno).

## 11. Sistemas de pagamento: Asaas
- **Loja (sinal Pix e clube):**
  - cada barbearia conecta a própria conta Asaas (chave cifrada) e o dinheiro cai direto para ela;
  - webhook criado automaticamente na conexão;
  - pago depois do prazo → confirma se houver vaga, senão aviso de devolução (manual);
  - **0 contas conectadas em produção.**
- **Plataforma (mensalidade):**
  - fatura Asaas (Pix, boleto ou cartão), uma em aberto por loja;
  - "Já paguei, conferir";
  - +30 dias de acesso no pagamento.
  - **Variáveis não configuradas**: a cobrança é manual (1 fatura manual).
- **Faltam:**
  - cartão recorrente automático;
  - devolução de sinal pelo painel;
  - split de pagamento;
  - maquininha;
  - nota fiscal.

## 12. Hospedagem

| Componente | Onde | Observação |
| --- | --- | --- |
| App | Vercel (gru1) | Serverless; `maxDuration` 300 s em webhooks e jobs da IA |
| Banco | Supabase (sa-east-1) | — |
| WhatsApp / n8n | VPS Hostinger (Docker) | Sem monitoramento externo; backups pendentes |
| Domínio | `studioflowapp.tech` | `app.` em produção; raiz com DNS pendente |

## 13. Autorizações necessárias (checklist para quem assumir)
1. **Vercel:** criar `CRON_SECRET`; decidir `ANTHROPIC_API_KEY` da plataforma; `NEXT_PUBLIC_STUDIOFLOW_WHATSAPP` (botão de suporte); `STUDIOFLOW_ASAAS_*` (cobrança automática); `PAYMENTS_ENCRYPTION_KEY` própria (exige reconectar as contas de pagamento, que hoje são zero, então é o melhor momento).
2. **Supabase:** ligar a proteção de senhas vazadas; criar staging; política de backup.
3. **Meta:** verificar o negócio, número e templates, se migrar para a Cloud API.
4. **Asaas:** conta da plataforma e webhook.
5. **Resend:** verificar o domínio e criar a caixa `contato@`.
6. **VPS:** acesso SSH autorizado para executar `VPS-PARA-O-CODEX.md`.
7. **Credenciais expostas:** rotacionar a chave da Zernio, que foi colada em conversa.
8. **Jurídico:** revisão dos Termos e da Política de Privacidade.

## 14. Testes realizados nesta auditoria sobre integrações
- **Suíte automatizada (388 testes, todos passaram).** Cobre: cliente Evolution simulado, assinatura Meta, Instagram, Asaas (pagamentos e cobrança), e-mail, n8n (contratos), recepcionista com modelo simulado, recuperação, reconexão do WhatsApp e alertas.
- **Smoke HTTP local:** PASS, incluindo os canais do admin.
- **Produção:** só leituras agregadas no banco e GET das páginas públicas (`/` e `/login`, status 200).
- **Não executado:**
  - **nenhuma mensagem real enviada**;
  - nenhuma cobrança criada;
  - nenhum webhook disparado;
  - nenhuma chamada paga de IA.
