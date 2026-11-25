# StudioFlow: relatório final da auditoria

**Data:** 25/11/2026
**Escopo:** código-fonte (`mh0097317-ai/studioflow`, `main`, commit `dc1ff6f`), banco de produção (Supabase, somente leitura, contagens agregadas), Vercel (só nomes de variáveis e deploys), histórico Git, documentação interna e testes executados em ambiente isolado.
**Restrições respeitadas:**
- nenhuma alteração em produção;
- nenhuma mensagem real enviada;
- nenhum serviço contratado;
- nenhuma publicação;
- nenhum segredo lido ou copiado.

**Pacote:** `STUDIOFLOW_HANDOFF_COMPLETO.zip`, com 9 relatórios, capturas e diagramas.

---

## 1. Resumo executivo
O StudioFlow é um SaaS brasileiro de **agenda online, gestão e recepcionista com IA no WhatsApp para barbearias**. Está publicado em **https://app.studioflowapp.tech** (Vercel, região São Paulo, com banco Supabase em São Paulo).

**Engenharia acima da média para o estágio do produto.**
- Isolamento multiempresa com RLS em 76 de 76 tabelas.
- Proteção de conflito de agenda no próprio banco.
- 388 testes automatizados passando.
- Identidade visual premium e coerente ("Cartaz").
- Uma recepcionista de IA (Claude Sonnet 5.5) que consulta a agenda real, agenda, cancela e remarca pelo WhatsApp. Ela revisa preços e horários antes de responder e se recupera sozinha de falhas.

**Comercialmente, ainda é um piloto.**
- Uma barbearia real em operação.
- 50 agendamentos no banco, sendo 33 já passados e não finalizados.
- Nenhuma cobrança recorrente automatizada configurada.
- O WhatsApp da piloto está **desconectado desde 17/11** e precisa de nova leitura do QR Code.
- O job diário de cobrança e renovação **não roda**: falta `CRON_SECRET` na Vercel.

**Recomendação.** Executar a **Onda 0** (1 a 3 dias, quase só configuração) e a **Onda 1** (2 a 4 semanas) do roadmap antes de vender em escala:
- cobrança recorrente;
- WhatsApp oficial da Meta;
- staging;
- monitoramento e backups;
- página de preços.

## 2. Onde paramos
- **Último commit (24/11):** faixa "Precisa de você" no Início, concluir com pagamento na agenda, WhatsApp com reconexão automática e aviso no celular do dono, nenhuma execução da IA travada, Next.js 16.4.6.
- **Pendências imediatas:**
  1. Ler o QR do WhatsApp da piloto e testar.
  2. Criar `CRON_SECRET`.
  3. Ligar a proteção de senhas vazadas.
  4. Rotacionar a chave da Zernio.
  5. Finalizar os atendimentos passados.
  6. Decidir sobre a agenda de demonstração e a remoção das lojas de teste.

## 3. Evidências coletadas

| Fonte | O que foi verificado |
| --- | --- |
| Código | 29 páginas, 86 rotas de API, ~78,7 mil linhas TS/TSX, ~33 mil linhas de CSS, 63 migrações |
| Banco (agregado) | 6 estabelecimentos (5 ativos), 11 profissionais, 11 serviços, 7 clientes, 50 agendamentos (33 passados sem finalizar), 15 pagamentos, 109 conversas, 6.813 mensagens, 294 turnos de IA (~541 mil tokens), 34 envios da IA, 7 falhas (6 por chave recusada), 75 avisos de WhatsApp (48 enviados, 27 falharam), 69 relatórios entregues, 22 posts publicados no Instagram da StudioFlow, 20 leads na Captação |
| Vercel | 10 variáveis, deploy `dc1ff6f` READY, cron diário sem segredo |
| Supabase advisor | 1 WARN (senhas vazadas), 47 INFO (RLS sem política, intencional) |
| Produção (GET público) | `/` e `/login`: HTTP 200 (capturas P0 e P1) |

## 4. Testes executados nesta auditoria

| Comando | Resultado |
| --- | --- |
| `rm -f .data/*.json; npm test` (`tsx --test tests/*.test.ts`) | **388 testes, 388 passaram, 0 falharam**, 71 s |
| `npx tsc --noEmit` | 0 erros |
| `npx eslint .` | 0 problemas |
| `npm audit --omit=dev` | 0 vulnerabilidades |
| `npm audit` (com desenvolvimento) | 7 moderadas (minimatch via typescript-eslint, só ferramenta de lint) |
| `rm -rf .next && npx next build --webpack` | Sucesso (compilação em 55 s; 1 min 56 s no total) |
| `node scripts/http-smoke.mjs` (dev local em modo demonstração) | **PASS**: onboarding isolado, projeção pública, isolamento entre empresas, reservas simultâneas, comprovante, desligar o agendamento online, reativação, edição de serviço, ações de atendimento, pagamentos parciais, rejeição de pagamento excedente, reagendamento, cancelamento, acesso da plataforma, módulos, canais do admin, métricas |
| Playwright (Chromium, demo local) | 94 capturas da demonstração (47 telas e estados × desktop e celular, incluindo as 9 visões do /admin e o fluxo completo de agendamento até o comprovante), sem rolagem horizontal; 4 telas refeitas após carregamento lento; 4 capturas de produção (site e login × 2) |

**Cobertura da suíte automatizada** (108 arquivos):
- cadeia de migrações em PostgreSQL real (PGlite);
- RLS por papel e revogação de RPCs;
- concorrência de reservas e trava do mesmo cliente;
- disponibilidade e datas;
- pagamentos (Asaas simulado), cobrança, módulos e acesso;
- recepcionista com modelo simulado: ferramentas, revisão, prazo e recuperação de travados;
- WhatsApp (Evolution simulada e assinatura da Meta), reconexão e alertas;
- inbox, relatórios e métricas.

**Não executado (e por quê):**
- `npm run eval:recepcionista`: chama a IA real e tem custo.
- Testes contra a produção: proibidos nesta missão.
- Envio real de WhatsApp ou e-mail.
- PWA e teclado virtual em aparelho físico.
- Teste de carga, pentest e DAST.
- Execução remota do CI no GitHub: não consultada.

## 5. Notas de 0 a 10

| Dimensão | Nota | Justificativa (evidência) |
| --- | --- | --- |
| Qualidade visual | **8,5** | Identidade "Cartaz" consistente em 94 capturas; página pública, agendamento e TV excelentes. Perde por estados vazios genéricos, menu lateral que corta itens a 900 px, placeholders sem foto e /admin denso |
| Experiência de uso | **7,5** | Agendamento em 5 etapas fluido; "Concluir e cobrar"; "Precisa de você". Perde por densidade do Início, configurações longas no celular, 3D pesado e agenda sem arrastar |
| Funcionalidades | **8** | Muito amplo: agenda, CRM, financeiro, produtos, clube, fidelidade, TV, check-in, IA, relatórios. Faltam recorrência, despesas/DRE, campanhas, aniversário, nota fiscal |
| Arquitetura | **8** | Monólito bem organizado (features/lib/services), regras puras testáveis, jobs no banco. Perde pelo Store inteiro carregado no cliente, ausência de fila dedicada e dependência de uma VPS para o WhatsApp |
| Segurança | **7,5** | RLS total, segredos cifrados, tokens com hash, webhooks assinados, sem vulnerabilidades em produção. Perde por falta de staging, senhas vazadas desligadas, rate limit em memória, falta de MFA e backup sem teste |
| Integrações | **6,5** | Evolution, Claude, Resend, Zernio e Serper em uso. Asaas (loja e plataforma), Meta Cloud, Instagram e transcrição implementados sem uso; cron de cobrança parado; WhatsApp da piloto caído |
| Inteligência artificial | **8** | v3 com ferramentas reais, revisão de preço e horário, recuperação, menus numerados, simulador, avaliação noturna. Perde pelo uso limitado em produção (34 respostas enviadas), dependência da chave da loja e custo em R$ não medido |
| Automações | **7** | Confirmação, lembretes 12h/2h/1h, aviso ao profissional, "atendeu?", alertas, relatórios e retorno funcionam com deduplicação. Faltam aniversário, campanhas, pedido de avaliação e recuperação de falta; cron diário parado; 36% de falha nos avisos por causa do número caído |
| Experiência mobile | **8** | Navegação inferior, agenda em lista, agendamento com gestos, PWA por loja, zero rolagem horizontal. Perde por páginas longas, `<select>` nas configurações e PWA não testado em aparelho |
| Escalabilidade | **6** | Serverless e banco gerenciado ajudam. Store inteiro por requisição, rate limit em memória, Evolution numa única VPS, sem staging e sem monitoramento |
| Preparação comercial | **5** | Cadastro self-service, planos e módulos, teste grátis, /admin completo. Faltam cobrança recorrente configurada, preços públicos, WhatsApp oficial, suporte estruturado, LGPD operacional e casos de sucesso |

**Média simples: 7,3.**

## 6. Os dez maiores problemas
1. **WhatsApp da barbearia piloto fora do ar desde 17/11.** A IA e os lembretes estão parados na única loja real.
2. **Cobrança recorrente não configurada.** As variáveis `STUDIOFLOW_ASAAS_*` não existem na Vercel, então não há receita automatizada.
3. **Job diário quebrado** (sem `CRON_SECRET`). Não rodam:
   - lembretes de mensalidade;
   - renovação dos tokens do Instagram;
   - e-mails de boas-vindas.
4. **Dados operacionais incompletos.** 33 de 50 agendamentos nunca foram finalizados, o que distorce financeiro, ocupação e comissões.
5. **Dependência do WhatsApp não oficial** (Evolution por QR). A sessão expira e há risco de bloqueio; 27 dos 75 avisos falharam.
6. **Sem homologação.** O preview usa o banco de produção.
7. **Sem backup testado nem monitoramento externo.** A VPS é ponto único de falha.
8. **Segurança de conta:**
   - proteção de senhas vazadas desligada;
   - sem MFA;
   - chave secreta do Supabase cadastrada como "encrypted" (legível) na Vercel;
   - chave da Zernio exposta em conversa.
9. **Lacunas competitivas:** não há agendamento recorrente, despesas/DRE, campanhas, aniversário nem pedido de avaliação.
10. **Escala do front:**
    - o painel carrega o workspace inteiro;
    - o Início com 3D é pesado;
    - o rate limit é em memória.

## 7. As dez maiores oportunidades
1. **"Recepcionista que agenda de verdade no WhatsApp" como argumento central.** Os concorrentes brasileiros vendem isso como adicional (Trinks com a Cloudia, Avec com IA). O StudioFlow já tem o motor com ferramentas e salvaguardas.
2. **Sem comissão por cliente.** É um contraste direto com Fresha (20%) e Booksy Boost (30%).
3. **Agendamento recorrente + lista de espera inteligente** para encher a agenda automaticamente.
4. **IA proativa:** encaixes em horário ocioso, recuperação de sumidos e confirmação de presença.
5. **Avaliações no Google** pedidas automaticamente após o atendimento, para gerar reputação local e trazer clientes.
6. **Descoberta por agentes de IA e Google.** A Fresha relatou em 2026 que 1 em 4 reservas veio de agentes de IA.
7. **Visual premium e Modo TV/Salão ao vivo** como experiência de demonstração e venda ("ver demonstração ao vivo").
8. **Financeiro completo com DRE e comissões com repasse**, que é o que segura o dono no sistema.
9. **Prospecção própria já pronta:** Captação no /admin, Harvey por e-mail e Marketing com IA no Instagram.
10. **Voz com IA** (credencial de ElevenLabs já existe) para atender ligações, igualando o GlossGenius Reception no mercado brasileiro.

## 8. Concorrência (pesquisa de 25/11/2026)

| Plataforma | Preço de entrada | Modelo | IA / WhatsApp | Fonte |
| --- | --- | --- | --- | --- |
| **Fresha** | US$ 19,95/mês (Independent); US$ 14,95 por membro (Team); Enterprise sob consulta; teste de 7 dias; cartão 2,79% + US$ 0,20 online | Marketplace com **20% de comissão sobre cliente novo** (mín. US$ 6); adicionais pagos | AI Concierge (preço divergente entre fontes); em 2026, 1 em 4 reservas via agentes de IA; preço dinâmico | [fresha.com/pricing](https://www.fresha.com/pricing), [blog Fresha IA](https://www.fresha.com/blog/fresha-ai-booking-growth), [agendamento com IA](https://www.fresha.com/blog/fresha-ai-powered-intelligent-scheduling-beauty-wellness), [PricingSaaS](https://pricingsaas.com/companies/fresha) |
| **Booksy** | US$ 29,99/mês + US$ 20 por membro (EUA); €44 + €5 (Europa); teste de 2 semanas | Boost: **30% da primeira visita** (máx. US$ 100) | Reserve with Google, lista de espera, proteção contra falta | [biz.booksy.com/pricing](https://biz.booksy.com/pricing), [Boost](https://support.booksy.com/hc/en-us/articles/16486248108946-How-does-Boost-pricing-work), [Software Advice](https://www.softwareadvice.com/barbershop/booksy-profile/) |
| **Trinks** (BR) | Por faixa de profissionais (valor não público nos resultados; agregador cita a partir de R$ 81); mensal, semestral ou anual com fidelidade e multa de 50% | Assinatura + adicionais | Atendente virtual **Cloudia**, Lembrete Premium, NFC-e/NFS-e e Clube como **adicionais** | [negocios.trinks.com/barbearias](https://negocios.trinks.com/negocios/barbearias/), [Meu Plano](https://ajuda.trinks.com/como-gerenciar-o-meu-plano-na-trinks), [Termos](https://sistema.trinks.com/termos-de-uso), [Capterra](https://www.capterra.com/p/252863/Trinks/) |
| **Avec** (BR) | **A partir de R$ 88,90/mês** (1–2 profissionais) | Assinatura + pagamentos (conta digital) | IA que agenda no WhatsApp 24h, marketing com IA, clube, multiunidades; diz ter +40 mil negócios | [Planos Avec](https://negocios.avec.app/avec-planos), [Avec](https://negocios.avec.app/), [Marketing com IA](https://negocios.avec.app/marketing-com-ia-para-beleza) |
| **AgendaPro** (LatAm) | Por país (ex.: Chile a partir de CLP 149.900 + IVA) | Planos Individual/Básico/Premium/Pro; WhatsApp em pacotes (US$ 7 por 50 mensagens no internacional) | IA pouco clara | [agendapro.com/br/planes](https://agendapro.com/br/planes), [planes internacional](https://agendapro.com/en/planes-int) |
| **GlossGenius** (EUA) | US$ 24 / 48 / 148 por mês; processamento de 2,6% | Assinatura | **Reception**: IA atende ligações e textos 24/7 e agenda (a partir de ~US$ 50/mês; fontes divergem) | [glossgenius.com/pricing](https://glossgenius.com/pricing), [Reception](https://glossgenius.com/reception), [blog](https://glossgenius.com/blog/ai-receptionist-booking) |
| **Boulevard** (EUA) | ~US$ 140–159/mês; contrato de 12 meses (terceiros) | Premium para salões e spas | Marketing automatizado | [Capterra](https://www.capterra.com/p/180087/Boulevard/), [Software Advice](https://www.softwareadvice.com/retail/boulevard-profile/), [Boulevard vs Vagaro](https://www.joinblvd.com/compare/boulevard-vs-vagaro) |

**Posição do StudioFlow (inferência):**
- **Experiência e IA no WhatsApp:** está no nível de Avec e Trinks + Cloudia.
- **Visual:** acima de Trinks, Avec e AgendaPro, próximo de GlossGenius e Boulevard.
- **Abaixo em:** financeiro (despesas, nota fiscal), pagamentos presenciais, marketplace e descoberta, base instalada e suporte.

**Diferenciação recomendada:**
- "a recepcionista que agenda no WhatsApp de verdade";
- "sem comissão por cliente";
- "design de barbearia premium";
- "o dono sabe na hora quando algo quebra".

*Observação:* os preços de terceiros mudam e alguns vêm de agregadores. Conferir na página oficial antes de usar em material comercial. Nenhum preço do StudioFlow foi inventado.

## 9. Riscos (resumo; detalhes em `STUDIOFLOW_SEGURANCA.md`)
- **Altos:**
  - senhas vazadas;
  - sem staging;
  - chave mestra legível na Vercel;
  - backups;
  - WhatsApp não oficial.
- **Médios:**
  - rate limit;
  - abuso do chat público;
  - MFA;
  - monitoramento;
  - VPS;
  - LGPD;
  - retenção de dados.
- **Nenhum risco crítico explorável** foi encontrado.

## 10. Limitações desta auditoria
- **Sem acesso:** à VPS Hostinger (Evolution e n8n), às contas Asaas, Meta, Resend e Zernio, e à fatura de custos.
- **Logs da Vercel:** a consulta de 72 h estourou o tempo, então o 401 do cron foi deduzido do código e da ausência de registros.
- **Interfaces de produção:** não capturadas após o login, para não acessar dados reais. As capturas internas são do modo demonstração.
- **Referências de design:** não foi encontrada evidência de "Paper Design" ou "ProfitizeBuild" no repositório.
- **Custos:** não há dados de custo atuais no repositório.

## 11. Arquivos entregues

| Arquivo | Conteúdo |
| --- | --- |
| `STUDIOFLOW_CONHECIMENTO_COMPLETO.md` | Produto, jornadas, histórico, auditoria de cada tela, agenda, IA, automações, financeiro, CRM, SaaS, concorrência |
| `STUDIOFLOW_RELATORIO_FINAL.md` | Este resumo |
| `STUDIOFLOW_INTEGRACOES.md` | Integrações, webhooks, provedores, autorizações |
| `STUDIOFLOW_ARQUITETURA.md` | Stack, diagramas, tabelas, relacionamentos, jobs, variáveis, infraestrutura |
| `STUDIOFLOW_GUIA_DO_USUARIO.md` | Guia para dono, profissional, cliente e equipe StudioFlow |
| `STUDIOFLOW_AUDITORIA_VISUAL.md` | Identidade, antes × depois, análise por tela, recomendações |
| `STUDIOFLOW_ROADMAP.md` | Ondas 0 a 3 com prioridades, dependências e autorizações |
| `STUDIOFLOW_SEGURANCA.md` | Riscos por criticidade, LGPD, backups |
| `STUDIOFLOW_MATRIZ_FUNCIONAL.md` | Inventário com classificação, evidência e prioridade |
| `capturas/` | 94 capturas reais da demonstração (desktop e celular) + 4 de produção + folhas de contato |
| `capturas-historicas/` | Capturas anteriores (02 e 03/10) para comparação |
| `diagramas/` | Diagramas Mermaid (arquitetura, ER, fluxo do WhatsApp) |
| `evidencias/` | Saídas dos testes (resumo), relatório das capturas |
