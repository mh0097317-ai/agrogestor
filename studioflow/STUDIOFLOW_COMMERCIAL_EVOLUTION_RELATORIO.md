# StudioFlow: relatório da evolução comercial

**Status:** pronto para revisão. Nada foi publicado em produção.

- **Branch:** `feature/studioflow-commercial-evolution`, a partir da `main`.
- **Período:** 25 e 26/11/2026.
- **Repositório:** espelhado em `agrogestor/studioflow`, branch `claude/barbershop-scheduling-platform-0jnoui`. A branch não foi enviada ao repositório `studioflow`, porque o preview da Vercel usa o banco de produção (ver autorizações, item 6).

## 1. Resumo

O StudioFlow foi evoluído sobre o código existente, sem reconstrução, em 6 entregas:

| Commit | Entrega |
|---|---|
| `045e350` | Segurança operacional: trava de envio em homologação, tela Pendências, prontidão da plataforma, limite de requisições persistente |
| `80c07c8` | Comercial: planos configuráveis sem preço inventado, página `/precos`, pedidos de troca/cancelamento, assinatura recorrente no cartão |
| `f7eacbd` | IA: custo em R$ por casa, teto mensal, rastro do que a recepcionista fez em cada conversa |
| `6015b35` | Agenda recorrente, "Agendar o próximo", férias, despesas, contas a pagar, DRE simplificada |
| `2beb216` | CRM: aniversário, consentimento LGPD com histórico, "SAIR", exportação de dados, pedido de avaliação neutro, ajustes visuais |
| `e579b8b` | Homologação segura (scripts), capturas, ajustes de leitura |

**Escopo:**
- 110 arquivos alterados;
- 7 migrações novas, todas aditivas;
- 416 testes automatizados passando (eram 388 na auditoria).

## 2. O que foi entregue, por área

### 2.1 Recuperação operacional
- **Pendências** (`/dashboard/pendencias`): os atendimentos passados não fechados aparecem por dia.
  - Por item: Atendido (com forma de pagamento ou "Sem registrar pagamento"), Faltou ou Cancelado, sempre com confirmação.
  - Lote: marca só status, com modal "Nenhum pagamento será criado".
  - Nada é finalizado automaticamente.
- **Alerta no Início:** "N horários passados sem finalizar", que leva a Pendências.
- **Prontidão da plataforma** (`/admin` → Central de controle): lê só a *presença* das variáveis, nunca os valores. Itens:
  - CRON_SECRET, Asaas da plataforma, suporte, chave da IA, Evolution, e-mail, chave de cifra, modo de envio, token temporário;
  - itens manuais (senhas vazadas, backups).
- **Trava de envio** (`src/services/outbound-guard.ts`):
  - em preview da Vercel ou com `STUDIOFLOW_STAGING=1`, WhatsApp, Instagram, e-mail e Zernio só saem para a lista de teste;
  - cobrança real no Asaas de produção é bloqueada.
  - Modos: `live` / `sandbox` / `off`.

### 2.2 Billing / SaaS
- **Planos configuráveis** (tabela `platform_plans`):
  - Essencial, Profissional e Premium com módulos;
  - preços nulos ("Sob consulta") até você definir em `/admin` → Cobranças.
- **Página pública `/precos`:** lê os planos ativos; sem banco, mostra os padrões sem preço.
- **Pedidos do dono** (Configurações → Plano):
  - trocar de plano ou cancelar, um pedido aberto por casa;
  - a equipe aprova ou recusa em `/admin`;
  - aprovar troca aplica módulos e preço do plano;
  - aprovar cancelamento encerra a assinatura no Asaas.
- **Cartão recorrente:**
  - "Assinar no cartão (todo mês)" cria assinatura `CREDIT_CARD MONTHLY` no Asaas da plataforma;
  - o webhook registra cada cobrança uma vez (`platform_subscription_charge`, idempotente) e soma 30 dias uma vez por pagamento.
- **Separação do dinheiro:**
  - a plataforma usa só `STUDIOFLOW_ASAAS_*`;
  - as lojas usam a própria conta Asaas (sinal e clube) e o dinheiro delas nunca passa pela plataforma.
- **Não feito:**
  - upgrade/downgrade com cobrança proporcional (pro-rata): hoje a troca vale a partir da próxima fatura;
  - régua de inadimplência além dos lembretes existentes (3 dias antes, no dia e até 7 dias depois);
  - MRR e inadimplência no admin além da "receita mensal combinada" que já existia.

### 2.3 Recepcionista com IA
- **Custo em R$ por casa e por modelo:** tokens por dia × preço oficial por modelo × câmbio configurável em `/admin`.
- **Teto mensal por casa:**
  - a partir de 80%, aparece "perto";
  - ao atingir, a IA passa a conversa para a equipe (`budget-limit`) e o dono é avisado no Início.
- **"O que a recepcionista fez"** em cada conversa: consultas de horário, reservas e passagens para a equipe, com sucesso ou falha (`assistant_tool_events`, só servidor).
- O motor v3 e as validações existentes foram preservados.

### 2.4 Agenda inteligente
- **Recorrência:** toda semana ou a cada 2/3/4 semanas, até 12 vezes.
  - Cada repetição passa pela mesma RPC com trava do banco (advisory lock + exclusion constraint).
  - Datas ocupadas são listadas, não sobrescritas.
- **"Agendar o próximo"** em atendimento concluído:
  - mesmo cliente, serviço e profissional;
  - data sugerida pela mediana dos intervalos de visita do cliente (7 a 90 dias; padrão 21).
- **Férias:** bloqueio com "Até o dia" (vários dias em um bloqueio).
- **Não feito:** arrastar e soltar, visão por cadeira, lista de espera inteligente com encaixe automático, histórico de alterações por agendamento além do log de atividade.

### 2.5 Financeiro profissional
- **Despesas** com 10 categorias, a pagar ou pagas, forma de pagamento e repetição mensal (os meses seguintes nascem a pagar).
  - Lançamento errado é **estornado com motivo, nunca apagado**.
- **Contas a pagar:** em aberto de qualquer data, vencidas primeiro, "Pagar hoje…" com a forma.
- **DRE simplificada por regime de caixa:**
  - serviços recebidos + produtos − comissões estimadas − despesas pagas por categoria;
  - resultado e margem;
  - comparação com o período anterior de mesmo tamanho;
  - exportação CSV.
- **Dinheiro em centavos inteiros:** atendimento não fechado não entra como recebido.
- **Não feito:** repasse de comissões com fechamento, fechamento de caixa diário, histórico de percentuais de comissão, custo de produto vendido (as vendas antigas não guardam custo; isso está avisado na tela).

### 2.6 CRM, LGPD e avaliações
- **Aniversário** no perfil e filtro "Aniversariantes" (próximos 7 dias).
  - "Mandar parabéns" aparece **só para quem consentiu**, com a linha "responda SAIR".
- **Consentimento de marketing:** nasce desligado e só muda por ação explícita.
  - Cada mudança vira evento (quem, quando, por onde) em `customer_consent_events`, só servidor.
  - "SAIR", "PARAR", "STOP" ou "DESCADASTRAR" no WhatsApp tiram o cliente do marketing automaticamente.
  - Lembretes de horário continuam.
- **Exportar dados do cliente** (gerência): JSON com cadastro, agendamentos, pagamentos, compras, avaliações, consentimentos e conversas.
- **Pedido de avaliação neutro:**
  - o mesmo texto para todo atendimento concluído ("seja ela qual for");
  - sem perguntar antes se gostou e sem filtrar quem recebe o link público.
- **Sem disparo em massa:** cada mensagem é montada pelo painel e enviada por alguém da equipe.
- **Não feito:** cupons, indicação, campanhas segmentadas, NPS, central de automações e anonimização/exclusão a pedido do titular (exige decisão jurídica sobre retenção fiscal).
- Nenhuma conformidade jurídica é declarada: os recursos são técnicos e a revisão por advogado continua recomendada.

### 2.7 Visual (Cartaz preservado)
- **Menu lateral:** compacto em telas baixas (1366×768, 1440×900); não esconde mais itens atrás do cartão da loja e esmaece embaixo quando continua.
- **Produto sem foto:** monograma em tinta e papel no lugar do ícone genérico.
- **Fotos de pessoas sem imagem:** fallback sem degradê.
- **Salão ao vivo:** abre em 2D em celular, aparelho fraco, economia de dados ou "reduzir movimento"; o 3D fica a um toque.
- **Clientes:** estados vazios específicos por filtro.
- **Pendências:** datas em português correto ("Quarta-feira, 25 de novembro").

### 2.8 Performance e escala
- **Limite de requisições persistente** no banco (`rate_limit_hit`), compartilhado entre instâncias e com falha aberta se o banco cair.
  - Aplicado no agendamento público (30/10 min), no chat (60) e na lista de espera (15).
- **`/precos`** estático com revalidação a cada 5 min.
- **Despesas:** consulta limitada (500 por período) e indexada por `(business_id, due_date)` e `(business_id, paid_at)`.
- **3D fora em aparelhos fracos**, o que evita baixar three.js nesses casos.
- **Sem medição numérica:** os ganhos de tempo não foram medidos (sem ambiente de staging nem RUM). São melhorias estruturais, não métricas.

## 3. Testes

| Verificação | Resultado |
|---|---|
| `npm test` (node:test + PGlite com todas as migrações) | **416/416** |
| `npx tsc --noEmit` | sem erros |
| `npx eslint .` | sem erros |
| `npx next build --webpack` | compilou; `/precos` estático com revalidação de 5 min |
| `npm audit --omit=dev` | 0 vulnerabilidades |
| Smoke HTTP (`scripts/http-smoke.mjs`) | PASS, incluindo isolamento entre lojas e reserva concorrente |
| Navegador (Playwright, demonstração) | DRE, despesas recorrentes, perfil com consentimento, exportação e aniversário conferidos; capturas em `docs/capturas-evolucao/` (desktop 1440×900 e iPhone 13) |

**Testes novos:**
- `outbound-guard`, `platform-readiness`, `platform-plans`, `platform-subscription`;
- `ai-cost`, `recurrence`, `expenses`, `crm`;
- `commercial-db`: no PGlite, limite persistente, vitrine de planos, cobrança idempotente que soma 30 dias uma vez, tokens por modelo, despesas e consentimento só para o servidor.

**Mock × real:**
- Asaas, Evolution, Meta, Resend, Zernio e Anthropic foram testados com **clientes simulados**.
- Nenhuma chamada paga de IA, nenhuma cobrança e nenhum envio real foi feito.
- O banco foi testado em PGlite (PostgreSQL real em memória), não no Supabase remoto.

**Observação de captura:** no servidor de desenvolvimento, a sequência rápida de páginas no celular gerou "Invalid or unexpected token". A causa é o HTML em streaming cortado pela navegação do teste: o servidor registrou "destination stream errored". O erro não se repetiu ao abrir cada página isoladamente (3 tentativas). Vale conferir em produção após o deploy.

## 4. Segurança

- **Tabelas novas:**
  - `rate_limits`, `assistant_tool_events`, `business_expenses` e `customer_consent_events` só para `service_role`, com RLS ligada e sem políticas para `anon`/`authenticated`;
  - `platform_plans` tem leitura pública de colunas escolhidas.
  - Conferido no PGlite tentando ler como `anon` e `authenticated`.
- **Papéis checados no servidor antes de toda escrita:**
  - despesas: dono, admin ou gerência;
  - CRM: + recepção;
  - exportação: gerência;
  - troca de plano: dono ou admin.
- **Entradas validadas com Zod:** valores em centavos inteiros e positivos; datas por expressão regular antes de entrar no filtro do PostgREST.
- **Prontidão sem segredos:** lê só se cada variável existe; nenhum valor sai em resposta, log ou commit.
- **Pendências de infraestrutura** (autorizações, itens 3 e 6): `CRON_SECRET` ausente e chave secreta legível e compartilhada com preview.
- RLS não foi tratada como prova isolada: as rotas também filtram por `business_id` vindo da sessão no servidor.

## 5. Backups e monitoramento (plano, nada executado)

- **Supabase Free:** sem backup baixável nem PITR. Recomendação: `pg_dump` semanal manual agora; plano Pro quando houver clientes pagantes.
- **Monitoramento gratuito:** UptimeRobot no app e na Evolution; Sentry (plano gratuito) para erros. As duas opções dependem de conta sua.
- A VPS não foi alterada.

## 6. Preparação para o futuro

- A trava de envio e o arquivo de staging permitem previews seguros quando o banco de staging existir.
- Planos e módulos em tabela permitem preço anual e novos planos sem código.
- Os eventos de ferramenta da IA servem de base para métricas de conversão por canal.

## 7. Plano de publicação e rollback

**Publicar** (depois da sua aprovação):
1. Faça `pg_dump` de produção.
2. Aplique as 7 migrações em ordem (autorizações, item 13). São aditivas: só criam tabelas, colunas com padrão e funções; não apagam nem reescrevem dados.
3. Mescle a branch na `main` e acompanhe o build na Vercel.
4. Smoke manual: `/precos`, Início (alerta de pendências), `/dashboard/pendencias`, Financeiro (DRE), perfil de cliente, `/admin` (prontidão, custo da IA, planos, pedidos).

**Rollback:**
- **Código:** "Promote" do deploy anterior na Vercel (instantâneo) ou `git revert` do merge.
- **Banco:** as migrações podem ficar, porque o código antigo ignora tabelas e colunas novas. Se for preciso removê-las, faça na ordem inversa:
  1. `drop table customer_consent_events`;
  2. em `customers`, apague as colunas `birth_date`, `marketing_consent` e `consent_updated_at`;
  3. `drop table business_expenses`;
  4. `drop table assistant_tool_events`;
  5. `drop function assistant_add_model_tokens`;
  6. `drop table assistant_model_usage`;
  7. em `business_ai_plan`, apague `monthly_budget_cents`;
  8. em `platform_settings`, apague `usd_brl`;
  9. `drop function platform_subscription_charge`;
  10. em `platform_invoices`, apague `asaas_subscription_id`;
  11. em `businesses`, apague `platform_subscription_id`;
  12. `drop table platform_subscription_requests`;
  13. `drop table platform_plans`;
  14. `drop function rate_limit_hit` e `prune_rate_limits`;
  15. `drop table rate_limits`.
  - Só depois de exportar os dados que interessarem (despesas e consentimentos).
- **Assinaturas no cartão já criadas no Asaas:** cancelar pelo painel do Asaas antes de remover as colunas.

## 8. Onde está cada coisa

| Área | Arquivos principais |
|---|---|
| Trava de envio | `src/services/outbound-guard.ts` |
| Pendências | `src/features/management/pending-review.tsx`, `src/lib/owner-alerts.ts` |
| Prontidão | `src/lib/platform-readiness.ts`, `src/features/platform/readiness-card.tsx` |
| Planos e assinatura | `src/lib/platform-plans.ts`, `src/services/platform-plans.ts`, `src/services/billing.ts`, `src/app/precos/` |
| Custo da IA | `src/lib/ai-cost.ts`, `src/services/assistant/cost.ts`, `src/features/platform/ai-costs-card.tsx` |
| Recorrência | `src/lib/recurrence.ts`, `src/features/agenda/appointment-form.tsx` |
| Despesas e DRE | `src/lib/expenses.ts`, `src/services/expenses.ts`, `src/features/management/expenses-panel.tsx` |
| CRM e LGPD | `src/lib/crm.ts`, `src/services/customer-crm.ts`, `src/features/management/customer-privacy.tsx` |
| Homologação | `.env.staging.example`, `scripts/staging/` |

Documentos relacionados:
- `STUDIOFLOW_AUTORIZACOES_PENDENTES.md`
- `STUDIOFLOW_PROPOSTA_COMERCIAL.md`
- `STUDIOFLOW_CONHECIMENTO_COMPLETO_V2.md`
- `CONTINUE-AQUI.md`
