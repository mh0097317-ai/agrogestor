# StudioFlow: autorizações pendentes

Situação conferida em 26/11/2026, só por leitura. Produção não foi alterada nesta evolução.

**Legenda de prioridade**
- **P0:** bloqueia receita ou atendimento hoje.
- **P1:** necessário antes de vender.
- **P2:** melhora a operação.
- **P3:** futuro.

**Regra de ouro.** Nenhuma chave, senha ou token vai para o chat, commits ou logs.
- Na Vercel, cole os valores direto como variável **Sensitive**.
- No Supabase, cole no painel do próprio Supabase.
- No StudioFlow, use o Cofre do `/admin`.

## Estado de produção (fatos)

| Item | Situação | Fonte |
|---|---|---|
| WhatsApp da loja (QR, Evolution) | `connecting`, sem conexão desde 17/11 | `whatsapp_links` |
| Atendimentos passados sem fechar | **33**, todos de dias anteriores | `appointments` |
| Execuções da IA travadas | 0 | `assistant_runs` |
| `CRON_SECRET` na Vercel | **ausente** | variáveis do projeto |
| `STUDIOFLOW_ASAAS_*` (Asaas da plataforma) | **ausente** | variáveis do projeto |
| `NEXT_PUBLIC_STUDIOFLOW_WHATSAPP` (suporte) | **ausente** | variáveis do projeto |
| `NARRATION_TOKEN` | presente; o comentário diz "Temporário… remover" | variáveis do projeto |
| `SUPABASE_SECRET_KEY` | tipo "encrypted" legível (alerta `readable-secret`), compartilhada com preview | variáveis do projeto |
| Plano Supabase | Free, com 2 projetos ativos (StudioFlow e OrçaPro) | organização |

---

## 1. Reconectar o WhatsApp da loja (P0)

- **O que fazer:** ler um novo QR Code no celular da loja.
- **Onde:** `app.studioflowapp.tech/dashboard/configuracoes?aba=whatsapp` → "Conectar com QR Code". No celular: WhatsApp → Aparelhos conectados → Conectar aparelho.
- **Permissões:** dono da loja, com o celular do número na mão.
- **Credenciais:** nenhuma nova.
- **Configuração segura:** usar o número da loja, nunca um número pessoal; não reiniciar a instância pela API sem o celular por perto.
- **Custo:** zero.
- **Dependência:** nenhuma.
- **Observação:** a reconexão automática só funciona quando a sessão ainda vale. Depois de 9 dias, o QR é necessário. Não alterei números nem sessões ativas.

## 2. Regularizar os 33 atendimentos passados (P0)

- **O que fazer:** dizer, em cada horário, o que aconteceu (atendido, falta ou cancelado).
- **Onde:** depois do deploy desta branch, em `Início → "Regularizar"` ou em `/dashboard/pendencias`.
- **Permissões:** dono ou gerência.
- **Configuração segura:**
  - nada é finalizado sozinho;
  - o lote só marca status e nunca cria pagamento;
  - pagamento só com a forma escolhida, item a item.
- **Custo:** zero.
- **Dependência:** item 13 (deploy).

## 3. `CRON_SECRET` na Vercel (P0)

- **O que fazer:** criar o segredo que protege `/api/cron/*`. Sem ele, os crons da Vercel são recusados: cobranças, lembretes e recuperação ficam parados ou dependem só do pg_cron.
- **Link oficial:** https://vercel.com/docs/cron-jobs/manage-cron-jobs#securing-cron-jobs
- **Passos:**
  1. Gere o valor no seu computador com `openssl rand -hex 32`.
  2. Na Vercel, abra Project → Settings → Environment Variables → Add.
  3. Preencha `CRON_SECRET`, tipo **Sensitive**, só **Production**.
  4. Faça um redeploy.
- **Permissões:** dono do time na Vercel.
- **Custo:** zero.
- **Dependência:** nenhuma.

## 4. Asaas da plataforma: mensalidade do StudioFlow (P1)

- **O que fazer:** ligar a cobrança dos lojistas (fatura avulsa e, agora, cartão recorrente).
- **Links oficiais:**
  - https://docs.asaas.com
  - sandbox: https://sandbox.asaas.com
  - webhooks: https://docs.asaas.com/docs/webhooks
- **Passos:**
  1. Crie a conta **no sandbox primeiro**.
  2. Em Integrações, gere a chave de API.
  3. Na Vercel, crie `STUDIOFLOW_ASAAS_API_KEY` (Sensitive), `STUDIOFLOW_ASAAS_ENV=sandbox` e `STUDIOFLOW_ASAAS_WEBHOOK_TOKEN` (gerado com `openssl rand -hex 32`).
  4. No Asaas, cadastre o webhook `https://app.studioflowapp.tech/api/billing/asaas` com o mesmo token no cabeçalho `asaas-access-token` e os eventos de cobrança.
  5. Teste uma assinatura no cartão de teste do sandbox.
  6. Só depois troque para a conta de produção e `STUDIOFLOW_ASAAS_ENV=production`.
- **Permissões:** titular do CNPJ da StudioFlow.
- **Custo:** taxas por cobrança, segundo a tabela vigente do Asaas (consultar no painel; não estimei valores).
- **Alternativa gratuita:** Pix manual, com liberação no `/admin` por dias.
- **Dependências:** preços definidos (item 15) e deploy (item 13).
- **Observação:** dinheiro da plataforma e dinheiro das lojas ficam separados. Cada loja usa a própria conta Asaas para sinal e clube; a plataforma usa só as variáveis `STUDIOFLOW_ASAAS_*`.

## 5. Número de suporte (P1)

- **O que fazer:** criar `NEXT_PUBLIC_STUDIOFLOW_WHATSAPP` com o número de suporte, só dígitos e com 55. É público: aparece nos botões "Falar com o StudioFlow".
- **Onde:** Vercel → Environment Variables (pode ser Plain).
- **Custo:** zero.
- **Recomendação:** um chip só para suporte, separado do número da plataforma que envia cobranças.

## 6. Proteger a chave secreta do Supabase e separar o preview (P1)

- **Problema:**
  - `SUPABASE_SECRET_KEY` aparece como legível (`readable-secret`);
  - ela vale também para **preview**: qualquer branch enviada ao repositório `studioflow` gera um preview ligado ao banco de produção.
  - Por isso, esta branch **não** foi enviada ao repositório `studioflow`.
- **Links oficiais:**
  - https://vercel.com/docs/environment-variables/sensitive-environment-variables
  - https://supabase.com/docs/guides/api/api-keys
- **Passos:**
  1. No Supabase, abra Settings → API Keys e crie uma nova secret key.
  2. Na Vercel, recrie `SUPABASE_SECRET_KEY` como **Sensitive** e **somente Production**.
  3. Faça o redeploy e confira o painel.
  4. Revogue a chave antiga no Supabase.
  5. Para previews: crie as variáveis de preview apontando para um projeto de staging (item 7) e `STUDIOFLOW_OUTBOUND_MODE=sandbox`.
- **Permissões:** dono do projeto Supabase e do time Vercel.
- **Custo:** zero.
- **Risco:** trocar a origem da chave de cifra altera `PAYMENTS_ENCRYPTION_KEY` derivada. Defina `PAYMENTS_ENCRYPTION_KEY` **antes**, com o valor atual derivado, ou as contas cifradas precisarão ser reconectadas. Ver `src/services/server-secrets.ts`.

## 7. Supabase de homologação (staging) (P1)

- **Situação:** o plano Free permite 2 projetos ativos e os dois estão em uso. Não criei projeto nem contratei plano.
- **Opções:**
  1. **Gratuita:** pausar o OrçaPro enquanto testa e criar `studioflow-staging` (região sa-east-1).
  2. **Paga:** plano Pro (preço em https://supabase.com/pricing), que também traz backups diários e permite branches.
  3. **Local:** `supabase start` (Docker) no computador.
- **Passos depois de existir:**
  1. Copie `.env.staging.example` para `.env.staging.local` e preencha.
  2. Rode `node scripts/staging/check-env.mjs .env.staging.local`. Ele recusa banco de produção, envio live, Asaas de produção e a instância `sf-studioflow`.
  3. Rode `STAGING_DB_URL=... scripts/staging/apply-migrations.sh`, que se recusa a rodar contra produção.
  4. Rode `psql "$STAGING_DB_URL" -f supabase/seed.sql`, só com dados fictícios.
- **Custo:** zero (opções 1 e 3) ou o valor do plano Pro (opção 2).
- **Decisão sua:** qual das três opções.

## 8. Senhas vazadas e backups no Supabase (P1)

- **Proteção de senhas vazadas:** Authentication → Policies/Password security → "Leaked password protection".
  - Link: https://supabase.com/docs/guides/auth/password-security
  - Em alguns planos, este recurso é só do Pro. Confira no painel.
- **Backups:**
  - O plano Free **não** oferece backup diário baixável nem PITR (https://supabase.com/docs/guides/platform/backups).
  - Alternativa gratuita: `pg_dump` semanal manual para um local seu, criptografado.
  - Comando: `pg_dump "$DB_URL" -Fc -f studioflow-AAAAMMDD.dump`, com a URL de conexão do painel.
  - Não automatizei nada na VPS.
- **Custo:** zero (manual) ou plano Pro.

## 9. Rotacionar a chave da Zernio e remover o `NARRATION_TOKEN` (P2)

- **Zernio:** gere uma chave nova no painel da Zernio, troque `ZERNIO_API_KEY` na Vercel (Sensitive) e revogue a antiga.
- **`NARRATION_TOKEN`:** marcado como temporário. Se a narração dos Reels já terminou, apague a variável e a rota `/api/internal/narration` numa próxima entrega.
- **Custo:** zero.

## 10. API oficial do WhatsApp (Meta) (P2)

- **Para que serve:** conexão estável, botões e modelos aprovados, sem depender de QR.
- **Links oficiais:**
  - https://developers.facebook.com/docs/whatsapp/cloud-api/get-started
  - preços: https://developers.facebook.com/docs/whatsapp/pricing
- **Passos:**
  1. Crie um app Business na Meta e o WhatsApp Business Account.
  2. Verifique o número (não pode estar ativo no app do WhatsApp comum).
  3. Gere um token permanente de usuário de sistema.
  4. Cole ID do número, token e chave do app em Configurações → Recepcionista.
  5. Cadastre o webhook mostrado no painel.
- **Custo:** cobrança por conversa ou mensagem de modelo, segundo a tabela da Meta. Respostas dentro da janela de 24 h costumam ter regras próprias; confira a tabela vigente.
- **Decisão sua:** migrar a Coliseu (o número sai do app comum).

## 11. Anthropic (IA) (P2)

- **Situação:** a recepcionista v3 usa a chave do Cofre da plataforma.
- **Novidade desta entrega:** custo em R$ por casa e teto mensal (`/admin` → Central de controle → "Custo da IA").
- **O que fazer:**
  - defina o câmbio usado e o teto de cada casa no próprio card;
  - no console da Anthropic, ponha um limite de gasto mensal na organização: https://console.anthropic.com/settings/limits.
  - Preços oficiais: https://www.anthropic.com/pricing.
- **Não executei** nenhuma avaliação paga de IA nesta entrega.

## 12. E-mail (Resend) e domínio (P2)

- **Situação:** `RESEND_API_KEY` existe.
- **O que conferir:** o domínio `studioflowapp.tech` verificado (SPF/DKIM) em https://resend.com/docs/dashboard/domains/introduction, e a caixa `contato@studioflowapp.tech` criada (usada em Termos e Privacidade).
- **Custo:** plano gratuito do Resend tem limite mensal; ver o site.

## 13. Publicar esta evolução (P1, decisão sua)

- **Branch:** `feature/studioflow-commercial-evolution`. Está espelhada em `agrogestor/studioflow`.
- **Ordem segura:**
  1. Faça um backup manual (`pg_dump`).
  2. Aplique as **7 migrações novas**, todas aditivas, sem apagar nada:
     - `20261126100000_persistent_rate_limit`
     - `20261126110000_platform_plans_subscriptions`
     - `20261126120000_platform_card_subscription`
     - `20261126130000_assistant_cost_budget`
     - `20261126140000_assistant_tool_events`
     - `20261126150000_business_expenses`
     - `20261126160000_customer_crm_consent`
  3. Defina `STUDIOFLOW_OUTBOUND_MODE=live` em **Production**, explícito, por clareza.
  4. Mescle na `main` do repositório `studioflow` e acompanhe o deploy.
  5. Confira `/precos`, `/dashboard/pendencias`, `/admin` (prontidão, custo da IA, planos) e o Financeiro.
- **Rollback:** em `STUDIOFLOW_COMMERCIAL_EVOLUTION_RELATORIO.md`, seção 7.
- **Permissões:** sua aprovação explícita. Não mexi na `main` nem publiquei.

## 14. Hostinger / VPS da Evolution (P3)

- **Não alterei a VPS.**
- **Monitoramento gratuito:**
  - UptimeRobot (https://uptimerobot.com) checando a URL da Evolution e `app.studioflowapp.tech`;
  - alertas por e-mail ou Telegram.
- **Erros da aplicação:** Sentry tem plano gratuito (https://sentry.io/pricing/). Exige criar conta e uma variável `SENTRY_DSN`; a integração no código ainda não foi feita.

## 15. Preços dos planos (P1, decisão comercial)

- **Situação:** os valores **não foram inventados**. Os planos nascem "Sob consulta".
- **Onde definir:** em `/admin` → Cobranças → Planos.
- **Apoio:** `STUDIOFLOW_PROPOSTA_COMERCIAL.md` sugere faixas para você decidir.

## 16. Itens antigos que continuam aguardando você

- Aplicar a agenda de demonstração e os serviços/produtos da Coliseu no banco.
- Apagar as 4 barbearias de teste. Nada foi apagado.
