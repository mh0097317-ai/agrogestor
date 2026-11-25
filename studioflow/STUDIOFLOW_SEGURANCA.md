# StudioFlow: auditoria de segurança, isolamento e preparação comercial

Auditoria de 25/11/2026. Ela foi feita por leitura de código, por consultas só de leitura no banco de produção (estrutura e contagens), pelo advisor de segurança do Supabase, pela lista de variáveis da Vercel (só nomes e tipos) e pelos testes automatizados em ambiente isolado. **Nenhum teste invasivo foi feito em produção.**

Escala de criticidade:
- 🔴 **Crítico:** risco imediato a dados ou dinheiro.
- 🟠 **Alto:** pode causar incidente ou falha de operação relevante.
- 🟡 **Médio:** deve ser corrigido antes de escalar.
- 🟢 **Baixo:** boa prática.

Não foi encontrado nenhum risco crítico explorável.

---

## 1. Pontos fortes (fatos)

### Isolamento entre estabelecimentos
- Tabelas de negócio com `business_id` (e `tenant_id`) e chaves estrangeiras compostas.
- RLS habilitada em **76 de 76 tabelas**.
- O servidor confere o vínculo do usuário (`requireMembership`) antes de qualquer acesso.
- `user_metadata` não dá privilégio.
- O smoke HTTP testa o isolamento entre empresas: **PASS**.
- Há testes de RLS com os papéis reais (`authenticated`, `anon`, `service_role`) em PGlite.

### Tabelas e funções restritas ao servidor
- **47 tabelas** têm RLS sem políticas: só o `service_role` acessa (segredos, auditoria, filas, plataforma).
- **RPCs críticas** (`book_appointment`, `stale_assistant_runs`, `platform_*`) fazem `revoke` de `anon` e `authenticated`. Os testes da cadeia de migrações conferem isso.

### Segredos de terceiros
- Ficam cifrados com AES-256-GCM: chaves de IA, Asaas, Meta, Instagram, Evolution e voz.
- O navegador nunca recebe a chave; só um "hint" com os últimos caracteres.

### Tokens públicos
- Comprovante, clube, convites e webhooks usam tokens de 256 bits; o banco guarda só o hash SHA-256.
- O link de atendimento do profissional é assinado e expira em 48 h.

### Webhooks
- **Meta:** assinatura `X-Hub-Signature-256`.
- **Asaas:** cabeçalho de token.
- **Evolution:** token por conexão.
- **Jobs:** segredo verificado no banco, com comparação em tempo constante.

### Agenda e dinheiro
- **Contra conflito de horário:** advisory lock, revalidação no servidor, exclusion constraint GiST e trava do mesmo cliente.
- **Pagamentos:** só de atendimento concluído e dentro do saldo (teste "overpayment rejection" PASS).

### APIs públicas
- Projeção explícita: sem CRM, financeiro, conta de pagamento ou assinaturas. O smoke garante isso.
- Teto de 4 reservas futuras por telefone.
- Rastreio da página limitado a 90 por minuto por IP.

### Cabeçalhos HTTP
- `X-Content-Type-Options: nosniff`
- `X-Frame-Options: SAMEORIGIN` e `frame-ancestors 'self'` (contra clickjacking)
- `Referrer-Policy` (o token do comprovante não vaza para outros sites)
- `Permissions-Policy`

### Acesso comercial e administração
- Sem acesso liberado, o servidor fecha o painel, as APIs, a agenda online e os canais (HTTP 423).
- O `/admin` é bloqueado no `proxy.ts` e na própria rota (`platform_admins`), com login separado.

### Dependências
- `npm audit --omit=dev`: **0 vulnerabilidades**.
- Next.js atualizado para 16.4.6 em 24/11 (corrige 7 avisos de segurança da 16.4.3).

### Privacidade
- O CPF do sinal vai só para o Asaas.
- `page_events` não guarda dados pessoais.
- O link de atendimento não mostra o telefone do cliente.
- Termos e Política de Privacidade publicados.
- Opt-out "PARAR" na mensagem de retorno.

## 2. Riscos encontrados

| # | Risco | Criticidade | Evidência | Recomendação |
| --- | --- | --- | --- | --- |
| S1 | **Proteção contra senhas vazadas desligada** no Supabase Auth | 🟠 Alto | Advisor do Supabase (WARN) | Ligar em Auth → Password security |
| S2 | **Sem ambiente de homologação**: o preview da Vercel usa as chaves do banco de produção (`SUPABASE_SECRET_KEY` vale para preview e production) | 🟠 Alto | Lista de variáveis da Vercel | Criar um projeto Supabase de staging e restringir as chaves de produção a "production" |
| S3 | **`SUPABASE_SECRET_KEY` cadastrada como "encrypted"**, e a Vercel a marca como `readable-secret`. Ela é a chave mestra do banco e, sem `PAYMENTS_ENCRYPTION_KEY`, também origina a cifra dos segredos de terceiros | 🟠 Alto | Vercel (`securityIssues: readable-secret`) | Recriar como "sensitive"; definir uma `PAYMENTS_ENCRYPTION_KEY` própria (hoje há 0 contas de pagamento, ótimo momento) e reconectar as credenciais cifradas |
| S4 | **Backups sem rotina própria e sem teste de restauração**: o banco depende do plano Supabase; a VPS (sessões do WhatsApp, n8n) não tem backup confirmado | 🟠 Alto | `VPS-PARA-O-CODEX.md` lista como pendente | Backup diário fora da VPS, PITR no Supabase e teste de restauração documentado |
| S5 | **WhatsApp não oficial (Evolution/QR)**: o número pode ser bloqueado pelo WhatsApp e a sessão expira | 🟠 Alto (negócio) | Loja piloto fora do ar desde 17/11 | Migrar lojas pagantes para a Cloud API da Meta; manter o QR só para teste |
| S6 | **Rate limit em memória** (`server-http.ts`): na Vercel cada instância tem o seu contador, então o limite é fraco contra abuso distribuído | 🟡 Médio | Código | Upstash/Redis ou tabela de contadores; Vercel Firewall/WAF nas rotas públicas (`/book`, `/chat`, `/waitlist`) |
| S7 | **Chat público com IA** (`/api/public/[slug]/chat`) pode gerar custo por abuso | 🟡 Médio | Código: rate limit em memória + teto diário por loja | Captcha ou desafio leve, limite por IP persistente, teto diário já existente |
| S8 | **Segredo exposto em conversa**: a chave da Zernio foi colada no chat | 🟡 Médio | Histórico | Rotacionar e atualizar na Vercel |
| S9 | **Sobra de variável**: `NARRATION_TOKEN` (rota removida) | 🟢 Baixo | Vercel | Apagar |
| S10 | **Job de cobrança sem `CRON_SECRET`**: não é falha de segurança (a rota recusa), mas é falha de operação | 🟡 Médio (operação) | Código + 0 avisos de cobrança | Criar `CRON_SECRET` |
| S11 | **Buckets públicos** (`images`, `marketing`, `shop-posts`): qualquer arquivo é legível por URL | 🟢 Baixo | `storage.buckets` | Aceitável para fotos de vitrine; não guardar documentos nesses buckets |
| S12 | **Sem CSP completa** (só `frame-ancestors`) e sem HSTS declarado no app | 🟢 Baixo | `next.config.ts` | Política CSP com nonces; HSTS (a Vercel já força HTTPS) |
| S13 | **Sem 2FA** para dono e admin da plataforma | 🟡 Médio | Auth só por e-mail e senha | MFA do Supabase (TOTP), obrigatório no `/admin` |
| S14 | **Monitoramento externo inexistente** (uptime, alertas de erro) | 🟡 Médio | Só `app_errors` interno | Uptime Kuma/Better Stack, alerta de erro (Sentry) |
| S15 | **Evolution e n8n**: firewall, SSH e fail2ban não verificados | 🟡 Médio | Sem acesso à VPS | Executar `VPS-PARA-O-CODEX.md` §5 |
| S16 | **Termos e Política sem revisão jurídica**; a caixa `contato@` não confirmada | 🟡 Médio (LGPD) | Código e notas | Revisão por advogado; DPO/encarregado nomeado; canal de titular funcionando |
| S17 | **Retenção de dados**: conversas (6.813 mensagens) e contatos do WhatsApp (523) sem prazo de retenção definido | 🟡 Médio (LGPD) | Banco | Definir retenção (ex.: 12 meses) e rotina de expurgo; exportação/exclusão a pedido do titular |
| S18 | **Logs de erro** (`app_errors.detail`) podem conter trechos de mensagens | 🟢 Baixo | 67 registros; poda após 30 dias | Manter a poda; mascarar telefones |
| S19 | **7 vulnerabilidades moderadas em dependências de desenvolvimento** (minimatch via typescript-eslint) | 🟢 Baixo | `npm audit` | Atualizar quando houver correção sem quebra |

## 3. Papéis e permissões

| Papel | Pode |
| --- | --- |
| `owner`, `admin`, `manager` | Tudo no estabelecimento: catálogo, equipe, configurações, pagamentos, operação |
| `reception` | Agenda, clientes, conversas; não altera catálogo, equipe, configurações nem pagamentos |
| `professional` | **Somente leitura**: vê as telas permitidas e recebe links de um toque |
| Equipe StudioFlow (`platform_admins`) | `/admin`: libera acesso, planos, cofre, cobranças, marketing |
| Cliente final | Sem conta; acesso ao próprio agendamento só pelo token |

A regra está em `src/lib/permissions.ts` e é espelhada em `workspace_mutation` no banco, com teste.

## 4. Sessões e autenticação
- **Painel:** Supabase Auth com cookies SSR e renovação pelo `proxy.ts`. O logout é `POST /auth/logout`.
- **Recuperação de senha:** `/login/nova-senha`.
- **`/admin`:** usa um cliente de autenticação próprio, separado do painel.
- **Não há:** 2FA, limite de tentativas próprio (fica o do Supabase Auth) nem alerta de login novo.

## 5. Dados pessoais (LGPD)
- **Dados tratados:**
  - nome, telefone, e-mail opcional, histórico de atendimentos, mensagens de WhatsApp e áudios (se transcritos) dos clientes finais;
  - nome, e-mail, CNPJ/CPF (para a fatura) e telefone dos donos;
  - fotos.
- **Bases legais esperadas:** execução de contrato (agendamento), legítimo interesse ou consentimento (lembretes; o consentimento é salvo), consentimento com opt-out (mensagem de retorno).
- **Papéis:** a StudioFlow é **operadora**; cada barbearia é **controladora** dos dados dos seus clientes. Os Termos tratam isso.
- **Faltam:**
  1. Fluxo de exportação e exclusão a pedido do titular.
  2. Prazo de retenção.
  3. Encarregado (DPO) nomeado publicamente.
  4. Registro das operações de tratamento.
  5. DPA com os suboperadores (Supabase, Vercel, Anthropic, Resend, Hostinger, Asaas, Meta).

## 6. Dados financeiros
- O StudioFlow **não guarda dados de cartão** e não movimenta dinheiro de clientes: o Asaas é da própria loja.
- O CPF do sinal não é salvo.
- Os pagamentos registrados são lançamentos internos (valor e forma).
- O webhook do Asaas é autenticado e a confirmação é idempotente.

## 7. Backups e recuperação
- **Banco:** depende do Supabase (diário no plano pago; PITR opcional). **Sem teste de restauração.**
- **Código:** GitHub, com histórico duplicado no repositório espelho.
- **VPS:** sessões do WhatsApp e n8n sem backup confirmado. Perder a VPS obriga a ler o QR Code de novo em todas as lojas e a reconstruir os workflows.
- **Recuperação de falhas da IA e do WhatsApp:** automática (seção 7 do Conhecimento Completo).

## 8. Preparação comercial do ponto de vista de segurança
**Pronto para um piloto pago com poucas lojas, desde que S1, S3, S4, S8 e S10 sejam resolvidos.** Para escalar (dezenas de lojas):
1. Staging separado (S2).
2. Rate limit persistente e WAF (S6, S7).
3. MFA (S13).
4. Monitoramento externo (S14).
5. WhatsApp oficial (S5).
6. LGPD operacional (S16, S17).

## 9. Testes de segurança executados (isolados)
- `npm test` (388/388):
  - RLS por papel (PGlite);
  - cadeia de 63 migrações aplicada do zero;
  - revogação de RPCs;
  - concorrência de reserva;
  - trava do mesmo cliente;
  - permissões do profissional;
  - webhooks assinados (Meta e Instagram);
  - tokens de comprovante;
  - limites do link público.
- `node scripts/http-smoke.mjs` (local, demo): isolamento entre empresas, reservas concorrentes, APIs protegidas com agendamento online desligado, acesso da plataforma e módulos do plano: **PASS**.
- `npm audit`: 0 vulnerabilidades em produção; 7 moderadas em desenvolvimento.
- Advisor de segurança do Supabase: 1 WARN (senhas vazadas) e 47 INFO (RLS sem política, intencional).
- **Não executado:** pentest, varredura DAST, teste de força bruta e testes contra a produção.
