# StudioFlow: roadmap estratégico e técnico

Proposta de 25/11/2026, baseada na auditoria. O roadmap é organizado em **4 ondas consolidadas** para execução autônoma, sem dezenas de missões que dependam de aprovação individual. Cada onda tem:
- critério de pronto;
- dependências;
- riscos;
- uma **lista única de autorizações**, pedida uma vez no início da onda.

Esforço: **P** = até 2 dias, **M** = 3 a 7 dias, **G** = 2 semanas ou mais.

---

## Princípios de execução autônoma
1. **Pedir todas as autorizações da onda de uma vez:** variáveis, contas e decisões de preço. Depois executar sem novas paradas.
2. **Validar tudo antes de cada publicação:**
   - `npm run verify` (lint, tipos, testes, build);
   - smoke HTTP;
   - Playwright no modo demonstração;
   - advisor do Supabase após cada migração.
3. **Migrações só aditivas** (colunas e tabelas novas). Destrutivas só com aprovação explícita.
4. **Não enviar mensagens reais**, exceto para números autorizados pelo dono, em teste controlado.
5. **Uma publicação por bloco funcional**, com nota no `CONTINUE-AQUI.md`.
6. **Criar o staging primeiro.** A partir da Onda 1, toda mudança passa por staging antes da produção.

---

## Onda 0: destravar a operação (1 a 3 dias, P)
**Objetivo:** a barbearia piloto atendendo de novo e nenhuma automação parada.

| # | Item | Impacto | Esforço | Dependência |
| --- | --- | --- | --- | --- |
| 0.1 | Ler o QR Code do WhatsApp da piloto e testar com outro número (`SENT`) | Crítico | P | Dono |
| 0.2 | Criar `CRON_SECRET` na Vercel (cobrança, renovação do Instagram, boas-vindas) | Alto | P | Acesso à Vercel |
| 0.3 | Ligar a proteção de senhas vazadas (Supabase) | Alto | P | Acesso ao Supabase |
| 0.4 | Rotacionar a chave da Zernio; apagar `NARRATION_TOKEN`; recriar `SUPABASE_SECRET_KEY` como "sensitive" | Médio | P | Vercel |
| 0.5 | `NEXT_PUBLIC_STUDIOFLOW_WHATSAPP` (botões de suporte) | Médio | P | Número de suporte |
| 0.6 | Finalizar os 33 atendimentos passados da piloto (dono, pela faixa "Finalizar") | Alto (dados) | P | Dono |
| 0.7 | Decidir sobre as pendências do Supabase: migração da agenda de demonstração e remoção das 4 lojas de teste | Médio | P | Dono |

**Pronto quando:**
- a piloto responde no WhatsApp;
- o cron de cobrança devolve 200;
- o advisor fica sem WARN;
- a faixa "Precisa de você" da piloto está vazia.

---

## Onda 1: pronto para vender (2 a 4 semanas)
**Objetivo:** cobrar sozinho, rodar estável e dar suporte. Sem isso não se escala a venda.

| # | Item | Impacto comercial | Esforço | Dependências | Risco |
| --- | --- | --- | --- | --- | --- |
| 1.1 | **Staging:** projeto Supabase separado; chaves de preview na Vercel; dados de demonstração | Alto (segurança de mudança) | M | Contas | Baixo |
| 1.2 | **Cobrança recorrente automática:** configurar `STUDIOFLOW_ASAAS_*`; assinatura com cartão recorrente além da fatura; régua de cobrança pelo WhatsApp e e-mail; suspensão automática após X dias | Muito alto | M | Conta Asaas da plataforma, política de inadimplência | Médio |
| 1.3 | **Página de preços e checkout:** planos com preço no site; teste grátis automático ao cadastrar (decisão pendente desde 10/10) | Muito alto | M | **Definição de preços pelo dono** | Baixo |
| 1.4 | **WhatsApp oficial (Meta Cloud API) como padrão para lojas pagantes:** onboarding guiado; templates para lembrete, confirmação e retorno; QR só para teste | Muito alto (estabilidade) | G | Meta Business verificado, templates aprovados | Médio (prazo da Meta) |
| 1.5 | **Monitoramento:** uptime externo (app, Evolution, n8n); Sentry ou equivalente; alerta para a equipe StudioFlow | Alto | P | Conta no serviço | Baixo |
| 1.6 | **Backups:** PITR no Supabase; backup diário da VPS fora dela; teste de restauração documentado | Alto | P | Acesso à VPS | Baixo |
| 1.7 | **Segurança de escala:** rate limit persistente (Redis ou tabela); WAF nas rotas públicas; MFA no `/admin` | Médio | M | — | Baixo |
| 1.8 | **Suporte:** central de ajuda (`Central de ajuda` já existe no menu) com artigos; canal de WhatsApp de suporte; status da plataforma | Médio | P | — | Baixo |
| 1.9 | **Custo da IA em R$** por loja no `/admin` e limite por plano | Alto (margem) | P | Tabela de preço do provedor | Baixo |
| 1.10 | **Chave de IA da plataforma** (`ANTHROPIC_API_KEY`) como reserva, com teto por loja | Alto | P | Decisão de custo | Médio |
| 1.11 | **LGPD operacional:** revisão jurídica; encarregado; exportação e exclusão de dados do titular; retenção de conversas (ex.: 12 meses) | Médio | M | Advogado | Baixo |

**Autorizações da Onda 1 (pedir de uma vez):**
- preços e planos;
- conta Asaas da plataforma;
- Meta Business e número;
- serviço de monitoramento;
- acesso à VPS;
- advogado;
- orçamento de IA.

**Pronto quando:** uma barbearia nova se cadastra, testa, paga com cartão recorrente, conecta o WhatsApp oficial e é atendida, sem ninguém da StudioFlow intervir.

---

## Onda 2: competir de igual (1 a 2 meses)
**Objetivo:** fechar as lacunas que fazem o dono escolher Trinks, Avec ou Booksy.

| # | Item | Por quê | Esforço |
| --- | --- | --- | --- |
| 2.1 | **Agendamento recorrente** ("toda sexta 18h", "a cada 3 semanas") + "agendar o próximo" ao concluir | Barbearia vive de recorrência | M |
| 2.2 | **Lista de espera inteligente:** vaga aberta → oferta automática pelo WhatsApp ao primeiro da fila, com prazo para aceitar | Recupera receita perdida | M |
| 2.3 | **Proteção contra falta:** taxa por cancelamento tardio ou falta (sinal/cartão); bloqueio de reincidente; recuperação de falta ("vamos remarcar?") | Dor nº 2 do dono | M |
| 2.4 | **Financeiro completo:** despesas e categorias; fluxo de caixa; DRE simples; comissões com histórico de percentuais e fechamento de repasse | Concorrentes têm | G |
| 2.5 | **CRM e campanhas:** aniversário; tags e segmentos; campanhas pelo WhatsApp com limite, opt-out e template; cupons; "indique um amigo" | Retenção e receita | G |
| 2.6 | **Avaliações:** pedido automático pós-atendimento; nota alta → link de avaliação no Google; nota baixa → alerta ao dono | Reputação local | P |
| 2.7 | **Agenda:** arrastar e soltar; redimensionar; visão por cadeira | Produtividade da recepção | M |
| 2.8 | **Conversas:** enviar foto e áudio; respostas rápidas; etiquetas | Atendimento humano | M |
| 2.9 | **Desempenho:** paginar o "workspace" (hoje o Store inteiro vai para o navegador); Início em "modo leve" sem 3D em aparelho fraco | Escala | M |
| 2.10 | **Seletor de empresa** (um dono, várias lojas) | Redes pequenas | M |

**Dependências:**
- 2.3 depende do 1.2 (cartão);
- 2.5 depende do 1.4 (templates da Meta para campanhas);
- 2.6 é independente.

---

## Onda 3: diferenciar e escalar (2 a 4 meses)

| # | Item | Diferencial | Esforço |
| --- | --- | --- | --- |
| 3.1 | **IA proativa:** além de responder, confirmar presença, oferecer encaixes em horário ocioso e recuperar clientes sumidos com mensagem personalizada (com teto e opt-out) | "Recepcionista que vende" | G |
| 3.2 | **Voz:** atender ligação com IA (a credencial de ElevenLabs já existe; falta telefonia, ex.: Twilio) | Igualar o GlossGenius Reception | G |
| 3.3 | **Descoberta:** Reserve with Google; Perfil da Empresa; endpoints para agentes de IA (a Fresha relata 25% das reservas por agentes) | Novo canal de clientes | G |
| 3.4 | **Preço dinâmico e encaixes:** desconto em horário ocioso | Ocupação | M |
| 3.5 | **Nota fiscal (NFS-e)** por integração | Exigência de lojas formais | M |
| 3.6 | **Multiunidade/franquia:** painel consolidado | Contas maiores | G |
| 3.7 | **App do profissional** (PWA dedicado): agenda do dia, comissão do mês, "atendi" | Engajamento da equipe | M |
| 3.8 | **Design system documentado** (`DESIGN.md`, tokens, componentes) e revisão dos estados vazios e placeholders | Consistência | P |

---

## Matriz de priorização (resumo)

| Prioridade | Itens | Impacto comercial | Complexidade | Risco principal |
| --- | --- | --- | --- | --- |
| P0 | Onda 0 inteira | Destrava a operação | Baixa | Depende do dono ler o QR |
| P1 | 1.2, 1.3, 1.4, 1.5, 1.6 | Habilita a venda | Média | Prazo da Meta e definição de preço |
| P1 | 2.1, 2.2, 2.3, 2.6 | Paridade e retenção | Média | Templates e cartão |
| P2 | 2.4, 2.5, 2.7–2.10, 1.7–1.11 | Competitividade | Média/alta | Escopo |
| P3 | Onda 3 | Liderança | Alta | Custo de IA e voz |

## Dependências críticas (caminho crítico)
1. **Definição de preços** → página de preços → checkout.
2. **Conta Asaas da plataforma** → cobrança recorrente → suspensão automática → proteção contra falta com cartão.
3. **Meta Business e templates** → WhatsApp oficial → campanhas, recorrência e lista de espera inteligente em escala.
4. **Staging** → todas as mudanças de banco das Ondas 1 a 3.

## Riscos do plano
- **Bloqueio do número pelo WhatsApp** (Evolution) antes da migração para a API oficial. Mitigação: migrar primeiro as lojas pagantes.
- **Custo de IA acima do preço do plano.** Mitigação: 1.9 e 1.10, com teto por plano.
- **Dependência de uma única VPS.** Mitigação: 1.5, 1.6 e saída gradual para a API oficial.
- **Escopo inflado** (o projeto cresceu rápido). Mitigação: só iniciar a Onda 2 depois do critério de pronto da Onda 1.

## Prompt sugerido para quem assumir
"Leia `STUDIOFLOW_RELATORIO_FINAL.md`, `STUDIOFLOW_CONHECIMENTO_COMPLETO.md`, `STUDIOFLOW_ARQUITETURA.md` e `CONTINUE-AQUI.md`. Execute a Onda 0 e depois a Onda 1 do `STUDIOFLOW_ROADMAP.md`. Peça de uma só vez a lista de autorizações da onda. Preserve a identidade visual Cartaz e as proteções de isolamento, concorrência e pagamentos. Rode `npm run verify`, o smoke e o Playwright antes de cada publicação. Não envie mensagens reais sem número autorizado e não apresente integração pendente como concluída."
