# StudioFlow: matriz funcional

Auditoria de 25/11/2026.

## Como ler

**Classificações**

| Classificação | Significado |
| --- | --- |
| ✅ **Validada** | Implementada e validada: teste automatizado e/ou smoke e/ou uso em produção comprovado no banco |
| 🔵 **Sem validação** | Implementada, sem validação nesta auditoria (código existe, sem teste dedicado e sem uso em produção) |
| 🟡 **Parcial** | Parcialmente implementada |
| 🧪 **Simulada** | Só no modo demonstração |
| 🔑 **Credencial** | Depende de credenciais ou autorização externa |
| 📋 **Planejada** | Citada em documento, sem código |
| ⛔ **Inexistente** | Não há código |
| ⚠️ **Com problema** | Existe, mas falha ou está parada hoje |

**Prioridade:** P0 (bloqueia operação ou venda), P1 (necessária para competir), P2 (diferencial), P3 (depois).

**Evidência (fontes abreviadas)**
- **T:** teste automatizado (`tests/*.test.ts`, 388 testes passando).
- **S:** smoke HTTP local (PASS).
- **PW:** Playwright nesta auditoria.
- **DB:** registros em produção (contagens agregadas).
- **C:** código.

---

## 1. Página pública e agendamento

| Funcionalidade | Situação | Evidência | Dependências | Prioridade |
| --- | --- | --- | --- | --- |
| Página pública personalizável | ✅ Validada | S, PW, DB (5 lojas ativas) | — | — |
| Agendamento em 5 etapas | ✅ Validada | S, PW (fluxo completo), DB (50 agendamentos) | — | — |
| Vários serviços no mesmo horário | ✅ Validada | T (`two services` soma duração e preço) | — | — |
| "Qualquer profissional" e próximo horário livre | ✅ Validada | T, PW | — | — |
| Lista de espera (cliente se inscreve) | ✅ Validada | T (`waitlist-db`), DB = 0 em uso | — | P2: oferta automática |
| Comprovante, remarcar, cancelar | ✅ Validada | S | — | — |
| Exportar .ics | 🔵 Sem validação | C | — | — |
| Sinal via Pix | 🔑 Credencial | T (`payments-db`), DB = 0 contas Asaas | Conta Asaas da loja | P1 |
| Clube de assinatura | 🔑 Credencial | T, DB = 0 assinaturas | Asaas da loja | P2 |
| Check-in por QR | ✅ Validada | T (`checkin-db`) | — | — |
| Avaliação pós-atendimento | ✅ Validada | T, DB (1 avaliação) | — | P1: pedir ativamente |
| App da casa (PWA) | 🔵 Sem validação | C; pendente teste em aparelho físico | HTTPS | P2 |
| Chat da recepcionista na página | ✅ Validada | T, DB (1 conversa web) | Chave de IA | — |
| Feed do Instagram na página | 🔑 Credencial | T (`photos-instagram`), DB = 0 feeds | Token IG; cron diário ⚠️ | P3 |
| Agendamento recorrente | ⛔ Inexistente | — | — | P1 |
| Reserve with Google | ⛔ Inexistente | — | Parceria Google | P2 |

## 2. Agenda e operação

| Funcionalidade | Situação | Evidência | Dependências | Prioridade |
| --- | --- | --- | --- | --- |
| Agenda dia/semana/mês por profissional | ✅ Validada | PW, T | — | — |
| Criar/editar/reagendar no painel | ✅ Validada | S | — | — |
| Bloqueio de horário | ✅ Validada | T | — | — |
| Expediente, pausas e folgas por profissional | ✅ Validada | T (disponibilidade) | — | — |
| Proteção contra conflito (lock + GiST) | ✅ Validada | S (concorrência), T | — | — |
| Trava do mesmo cliente | ✅ Validada | T (`customer-lock-db`) | — | — |
| Teto de 4 reservas futuras por telefone | ✅ Validada | T | — | — |
| Iniciar, concluir, falta, cancelar | ✅ Validada | S | — | — |
| Concluir já registrando o pagamento (agenda e Salão) | ✅ Validada | PW (24/11), T | — | — |
| "Atendeu?" para o profissional (15 min) | ✅ Validada | DB (27 avisos) | WhatsApp conectado | — |
| Salão ao vivo em 3D | ✅ Validada | PW | WebGL no aparelho | P3: modo leve |
| Modo TV | ✅ Validada | PW | — | — |
| Arrastar e soltar | ⛔ Inexistente | — | — | P2 |
| Agenda finalizada pelos donos | ⚠️ Com problema | DB: 33 de 50 agendamentos passados seguem "confirmados" | Hábito do usuário | **P0** (a faixa "Precisa de você" já ajuda) |

## 3. Recepcionista IA e conversas

| Funcionalidade | Situação | Evidência | Dependências | Prioridade |
| --- | --- | --- | --- | --- |
| Motor v3 (Claude Sonnet 5.5) com ferramentas | ✅ Validada | T (modelo simulado), DB (34 SENT) | Chave de IA no cofre | — |
| Menus numerados ("caixinhas") e resposta por número | ✅ Validada | T | — | — |
| Agendar, cancelar e remarcar pela conversa | ✅ Validada | T | — | — |
| Revisão antes de enviar (preço, horário, "já marquei") | ✅ Validada | T | — | — |
| Passar para humano | ✅ Validada | T | — | — |
| Prazo por turno, recuperação e fechamento de travados | ✅ Validada | T, DB (5 travados fechados) | pg_cron | — |
| Conversas (inbox, assumir, devolver) | ✅ Validada | PW, DB (109 conversas) | — | P2: mídia e respostas rápidas |
| Simulador no painel | ✅ Validada | PW | Chave de IA | — |
| Avaliação noturna (39 conversas) | ✅ Validada | C; erros antigos corrigidos em 12/11 | Chave de IA | — |
| Transcrição de áudio | 🔑 Credencial | T, DB = 0 credenciais | Chave de transcrição | P1 |
| Instagram Direct | 🔑 Credencial | T, DB = 0 contas | App Meta | P2 |
| Atendimento hoje na loja piloto | ⚠️ Com problema | WhatsApp desconectado desde 17/11 | Ler o QR de novo | **P0** |
| Chave de IA da plataforma (reserva para todas as lojas) | 🔑 Credencial | `ANTHROPIC_API_KEY` ausente | Decisão comercial | P1 |
| Voz (ElevenLabs) | 🟡 Parcial | C, 1 credencial | — | P3 |
| Motor v2 e n8n (legado) | 🟡 Parcial | C, DB (44 recibos n8n) | — | P3: desativar |

## 4. WhatsApp e avisos

| Funcionalidade | Situação | Evidência | Dependências | Prioridade |
| --- | --- | --- | --- | --- |
| Conexão por QR (Evolution) | ✅ Validada | DB (1 loja + 2 profissionais) | VPS | — |
| Reconexão automática + aviso no WhatsApp do dono | ✅ Validada | T; em produção tentou em 24/11 | Número da plataforma conectado | — |
| WhatsApp oficial (Meta Cloud) | 🔑 Credencial | T, DB = 0 | Meta Business e templates | P1 |
| Listas nativas | ⛔ Inexistente na prática (desligadas) | Evolution 2.3.7 retornou 400 | — | P3 |
| Confirmação ao cliente | ✅ Validada | DB (6), entrega real confirmada em 10/10 | WhatsApp | — |
| Lembretes 12h/2h/1h | ✅ Validada | DB (24 lembretes, 53 etapas) | WhatsApp | — |
| Aviso ao profissional | ✅ Validada | DB (18) | WhatsApp | — |
| Taxa de falha de avisos | ⚠️ Com problema | DB: 27 de 75 avisos `failed` (o número caiu) | WhatsApp estável | P0 |
| E-mail ao cliente (confirmação/véspera) | 🔑 Credencial | T, DB = 0 enviados | E-mail do cliente + Resend | P2 |
| Mensagem de retorno (clientes sumidos) | ✅ Validada | T, DB (1); desligada por padrão | WhatsApp | — |
| Aniversários | ⛔ Inexistente | — | — | P2 |
| Campanhas segmentadas | ⛔ Inexistente | — | — | P1 |
| Pedido ativo de avaliação | ⛔ Inexistente | — | — | P1 |
| Recuperação de no-show | ⛔ Inexistente | — | — | P2 |
| Alertas ao dono (IA falhou, WhatsApp caiu, sem baixa) | ✅ Validada | DB (12 WhatsApp, 23 e-mail) | — | — |
| Relatórios diário/semanal (PDF) | ✅ Validada | DB (69 envios) | — | — |

## 5. Gestão

| Funcionalidade | Situação | Evidência | Dependências | Prioridade |
| --- | --- | --- | --- | --- |
| Clientes (CRM básico, histórico, abas) | ✅ Validada | PW, T | — | P1: tags e aniversário |
| Serviços (até 3 fotos, combinações) | ✅ Validada | S, PW | — | — |
| Equipe (expediente, comissão %, convite, WhatsApp próprio) | ✅ Validada | PW, T | — | — |
| Produtos com estoque e venda | ✅ Validada | T (`products-db`), DB (3 produtos) | — | — |
| Financeiro (recebido, a receber, ticket, formas de pagamento) | ✅ Validada | S, T | — | — |
| Comissões | 🟡 Parcial (estimativa, sem repasse nem histórico de %) | C | — | P1 |
| Despesas, fluxo de caixa de saída, DRE | ⛔ Inexistente | — | — | P1 |
| Nota fiscal (NFS-e) | ⛔ Inexistente | — | Provedor fiscal | P2 |
| Relatórios e CSV | ✅ Validada | T | — | — |
| Fidelidade (carimbos) | ✅ Validada | T | — | — |
| Cupons e indicação | ⛔ Inexistente | — | — | P2 |
| Divulgar (link, QR, cartaz, story, post) | ✅ Validada | PW | IG para postar | — |
| Saúde da operação | ✅ Validada | PW | — | — |
| Ativação (checklist) | ✅ Validada | PW | — | — |
| Faixa "Precisa de você" | ✅ Validada | T, PW (24/11) | — | — |
| Pagamento simulado | 🧪 Simulada | C (bloqueado fora da demo) | — | — |
| Conexão de WhatsApp simulada | 🧪 Simulada | C | — | — |

## 6. Plataforma SaaS

| Funcionalidade | Situação | Evidência | Dependências | Prioridade |
| --- | --- | --- | --- | --- |
| Cadastro self-service + onboarding (6 etapas) | ✅ Validada | S, PW | — | — |
| Liberação de acesso, prazo e suspensão | ✅ Validada | S, T (`platform-db`), DB (5 ativos, 1 suspenso) | — | — |
| Planos e módulos | ✅ Validada | S, T (`modules`) | — | — |
| Teste grátis configurável | ✅ Validada | C, T | — | — |
| Mensalidade automática (Asaas da plataforma) | 🔑 Credencial | T (`billing`), DB = 0 faturas | `STUDIOFLOW_ASAAS_*` | **P0 para vender** |
| Cobrança manual | ✅ Validada | DB (1 fatura manual) | — | — |
| Lembretes de mensalidade, renovação de token IG, boas-vindas | ⚠️ Com problema | `CRON_SECRET` ausente | Variável | **P0** |
| Cofre de chaves (IA, Evolution, voz) | ✅ Validada | DB | — | — |
| Chave geral da IA | ✅ Validada | T | — | — |
| Modo da IA por cliente | 🟡 Parcial (o v3 ignora o modelo escolhido) | C | — | P2 |
| Auditoria e funil por loja | ✅ Validada | DB (170 eventos, 598 atividades) | — | — |
| Captação (Google Maps → nota → mensagem IA) | ✅ Validada | DB (20 leads) | Serper | — |
| Marketing da StudioFlow (IA + Zernio) | ✅ Validada | DB (22 posts publicados) | Zernio | — |
| E-mails aos donos (Resend + IA) | ✅ Validada | DB (32) | Resend | — |
| Seletor de empresa (um usuário, várias lojas) | ⛔ Inexistente | Pendência registrada | — | P2 |
| Autoatendimento de cancelamento da assinatura | ⛔ Inexistente | — | — | P2 |
| Suporte (botão WhatsApp) | ⚠️ Com problema | `NEXT_PUBLIC_STUDIOFLOW_WHATSAPP` ausente | Variável | P1 |
| Multiunidades/franquia | ⛔ Inexistente | — | — | P3 |
| App nativo (lojas iOS/Android) | ⛔ Inexistente (há PWA) | — | — | P3 |

## 7. Qualidade e infraestrutura

| Item | Situação | Evidência |
| --- | --- | --- |
| Testes automatizados | ✅ 388/388 | `npm test` |
| Tipos e lint | ✅ 0 erros | `tsc`, `eslint` |
| Build de produção | ✅ | `next build` |
| Smoke HTTP | ✅ PASS | `scripts/http-smoke.mjs` |
| CI no GitHub | 🔵 Sem validação | `.github/workflows/ci.yml` (execução remota não consultada) |
| Homologação | ⛔ Inexistente | — |
| Monitoramento externo | ⛔ Inexistente | — |
| Backup testado | ⛔ Inexistente | — |
