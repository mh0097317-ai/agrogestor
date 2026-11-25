# StudioFlow: conhecimento completo do produto

> Auditoria de 25/11/2026. Base: código-fonte (`main`, commit `dc1ff6f`), banco de produção (somente leitura, só números agregados), Vercel (só nomes de variáveis), histórico Git (repositórios `studioflow` e `agrogestor`), documentação interna (`README.md`, `CONTINUE-AQUI.md`, `docs/`) e testes executados nesta auditoria.
>
> Convenção: **Fato** = conferido no código, no banco ou num teste. **Inferência** = conclusão do auditor, marcada como tal.

Documentos irmãos:
- `STUDIOFLOW_RELATORIO_FINAL.md`: resumo executivo.
- `STUDIOFLOW_ARQUITETURA.md`: stack, banco, diagramas.
- `STUDIOFLOW_INTEGRACOES.md`: integrações e provedores.
- `STUDIOFLOW_SEGURANCA.md`: segurança e riscos.
- `STUDIOFLOW_AUDITORIA_VISUAL.md`: capturas e análise visual.
- `STUDIOFLOW_MATRIZ_FUNCIONAL.md`: inventário do que funciona.
- `STUDIOFLOW_GUIA_DO_USUARIO.md`: como usar cada função.
- `STUDIOFLOW_ROADMAP.md`: próximos passos.

---

## 1. O produto

### 1.1 O que é
O StudioFlow é um SaaS brasileiro de **agenda online, gestão e atendimento por WhatsApp com IA** para barbearias, com suporte também a salões, estética, nail designers e profissionais autônomos (segmentos em `src/lib/segments.ts`). Cada estabelecimento recebe:
- uma **página pública própria** (`app.studioflowapp.tech/<slug>`) com cardápio de serviços, equipe, fotos, avaliações, mapa e Instagram;
- um **agendamento online** em cinco etapas, sem o cliente criar conta;
- um **painel de gestão**: agenda, clientes, serviços, equipe, financeiro, relatórios, produtos, clube de assinatura, divulgação e configurações;
- uma **recepcionista com IA** que atende no WhatsApp (e no chat da página e no Instagram Direct), consulta a agenda real e marca, cancela e remarca;
- **automações**: confirmação e lembretes por WhatsApp e e-mail, aviso ao profissional, checagem de atendimento sem baixa, mensagem de retorno a clientes sumidos, relatórios diários e semanais em PDF, alertas ao dono;
- extras de experiência: **Salão ao vivo em 3D**, **Modo TV da recepção**, **check-in por QR Code** e **app da casa (PWA)**.

A plataforma também tem um painel interno (`/admin`) para a equipe StudioFlow, com estas funções:
- liberar acesso e definir plano/módulos;
- cofre de chaves de IA;
- conexão da Evolution;
- monitoramento e cobranças;
- captação de barbearias (prospecção via Google Maps/Serper);
- marketing do Instagram da própria StudioFlow (IA + Zernio);
- e-mails aos donos (Resend);
- relatórios semanais.

### 1.2 Problema que resolve
Na landing page (`src/features/landing/landing.tsx`) o produto se posiciona contra quatro dores do dono de barbearia:
1. "Responde WhatsApp entre um corte e outro?": a recepcionista com IA responde por ele.
2. "Cliente marca e esquece?": lembrete automático e sinal por Pix.
3. "Dois clientes no mesmo horário?": a agenda trava sozinha (trava transacional no banco).
4. "Não sabe quanto entrou no mês?": financeiro e comissão sem planilha.

### 1.3 Público-alvo
- **Primário:** barbearias brasileiras de 1 a ~10 cadeiras que hoje agendam pelo WhatsApp pessoal. O foco geográfico da prospecção (Harvey e Captação) é Goiânia, Aparecida de Goiânia, Anápolis e Brasília.
- **Secundário** (suportado no código, sem foco comercial): salões, estética, nail, autônomos.

### 1.4 Proposta comercial (o que está no código)
- **Landing.** Promete "Sua barbearia agendando sozinha, 24 horas." Chamadas: "Testar grátis", "Ver demonstração ao vivo", "Sem app para o cliente baixar · Sem fidelidade · Pronto no mesmo dia".
- **Planos** (`src/lib/modules.ts`, landing): Essencial, Profissional e Premium. A landing não exibe preços (decisão registrada em 13/10: "site sem preços"). Ela traz a oferta de lançamento "as 10 primeiras barbearias pagam metade nos 3 primeiros meses; no plano anual, 2 meses grátis".
- **Mensalidade.** É definida por cliente no `/admin` (`businesses.monthly_price`). **Não há tabela de preços oficial no repositório; este relatório não inventa valores.**
- **Teste grátis.** O padrão é 30 dias (`DEFAULT_TRIAL_DAYS`, `platform-trial.ts`), configurável no `/admin`. O Harvey/LEIA-ME também fala em "30 dias para testar".
- **Pagamentos do cliente final.** Cada barbearia usa a **própria conta Asaas**; a StudioFlow não intermedeia dinheiro.

### 1.5 Diferenciais competitivos (reais, no código)
1. **Recepcionista de IA que realmente agenda no WhatsApp.** Usa ferramentas sobre a agenda real, revisa a resposta antes de enviar, passa para humano e se recupera de falhas. Os concorrentes brasileiros oferecem isso como adicional (Trinks/Cloudia, Avec IA).
2. **WhatsApp por QR Code (Evolution).** Liga em minutos, sem aprovação da Meta.
3. **Visual premium "Cartaz"** (papel, tinta e latão; Fraunces + Hanken Grotesk), com Salão ao vivo em 3D e Modo TV.
4. **Sem comissão por cliente novo.** Fresha e Booksy cobram comissão de marketplace.
5. **Honestidade operacional.** O dono é avisado no WhatsApp quando algo quebra: IA falhou, WhatsApp caiu, atendimento sem baixa. A faixa "Precisa de você" fica no Início.
6. **Página da barbearia com identidade própria**, PWA instalável por casa, check-in por QR e TV de vitrine.

### 1.6 Visão original e evolução
- **29/09/2026:** "AgendAI" (agenda online multi-negócio para barbearias e salões) nasce dentro do repositório `agrogestor`.
- **02/10/2026:** o projeto "StudioFlow" chega pronto do Codex, em pacote ZIP, com redesign "editorial" branco + navy e 24 testes. Escopo original registrado em `CONTINUE-AQUI.md`: "Não criar ERP, landing page institucional como foco, IA complexa, envio de WhatsApp simulado ou cobrança fictícia… Próxima fase: piloto de produção. Cobrança e WhatsApp automático ficam para uma etapa comercial posterior."
- **A partir de 03/10/2026:** a visão se expandiu muito. Entraram IA (recepcionista v1 → v2 → v3), WhatsApp automático, cobrança, painel de plataforma, marketing com IA e captação. O produto virou um "sistema operacional da barbearia" com a IA no centro.

### 1.7 Objetivos atuais (estado em 24–25/11/2026)
O último ciclo, feito a pedido do dono ("vamos focar no app para ele ser o melhor"), teve três partes, todas publicadas:
1. Nenhum atendimento da IA fica travado: prazo total por turno, varredura de travados, lease de 300 s.
2. O WhatsApp tenta se reconectar sozinho, e o aviso de queda chega no WhatsApp do dono.
3. O dono vê na tela inicial o que está quebrado ("Precisa de você"). O Salão mostra o status honesto da IA. A agenda conclui já perguntando a forma de pagamento.

**O objetivo de negócio** (inferido das conversas e do código) é estabilizar a barbearia piloto e então começar a vender: Captação no `/admin`, Harvey por e-mail e Marketing no Instagram.

### 1.8 Potencial de evolução
- **Curto prazo:** maturidade operacional (agenda sempre fechada, WhatsApp estável via API oficial da Meta, cobrança recorrente automática).
- **Médio prazo:** CRM com campanhas segmentadas, aniversários, NPS e avaliações no Google, recorrência de agendamentos, comissões com repasse, despesas e DRE simples, nota fiscal.
- **Longo prazo:** marketplace/descoberta, reserva via Google ("Reserve with Google") e agentes de IA de terceiros (a Fresha relata 1 em 4 reservas vindas do Gemini), multiunidades e franquias, voz (já existe credencial de ElevenLabs no cofre).

### 1.9 Modelo de negócio
- **Receita:** assinatura mensal por estabelecimento, com planos por módulos. O plano anual é citado na landing.
- **Custos variáveis relevantes:** tokens de IA (por loja via cofre ou chave da plataforma), servidor Evolution, e-mail, armazenamento.
- **Cobrança:**
  - automática via Asaas da plataforma: implementada, mas **não configurada** em produção (variáveis `STUDIOFLOW_ASAAS_*` ausentes);
  - manual (`platform_manual_invoices`): em uso, com 1 fatura registrada.
- **Situação real em 25/11/2026 (banco):**
  - 6 estabelecimentos cadastrados (5 ativos, 1 suspenso), sendo **1 barbearia real em operação (piloto)** e as demais de teste ou demonstração (inferência baseada no histórico);
  - 50 agendamentos;
  - 294 turnos de IA consumidos, cerca de 541 mil tokens.
  - **Ainda não há receita recorrente automatizada nem base de clientes pagantes comprovada no banco.**

---

## 2. Jornadas

### 2.1 Proprietário
1. **Descoberta:** site institucional (`/`) → "Testar grátis" ou "Ver demonstração ao vivo" (demo `barber-011`).
2. **Cadastro:** `/login?signup=1` → conta criada sem esperar e-mail (cadastro em 3 passos de 01/11) → `/onboarding` em 6 etapas:
   - Negócio;
   - Contato (WhatsApp e endereço obrigatórios);
   - Identidade (capa obrigatória, logo, cor, até 12 fotos, comodidades);
   - Serviços com foto;
   - Equipe com foto e WhatsApp;
   - Horários.
   A prévia mostra "Sua página está X% pronta".
3. **Liberação:** o cadastro novo entra como *aguardando*. A equipe libera no `/admin` (por dias, até uma data, sem prazo ou teste grátis). Enquanto isso o dono vê "Seu painel está quase pronto".
4. **Ativação:** `/dashboard/ativacao` confere catálogo, equipe, horários e canal antes da primeira reserva.
5. **Configuração:** Configurações → Empresa e aparência, Agendamento online, Fidelidade, Pagamentos (Asaas), WhatsApp e atendimento automático (QR Code + recepcionista), Notificações, Plano.
6. **Dia a dia:**
   - **Início** (Salão ao vivo, "Precisa de você", Conversas, Resultados, retrospectiva do mês);
   - **Agenda** (dia/semana/mês, criar, iniciar, concluir com pagamento, falta, cancelar, bloquear);
   - **Conversas** (assumir/devolver a conversa da IA);
   - **Financeiro**, **Relatórios** (PDF diário/semanal no WhatsApp/e-mail);
   - **Divulgar** (link, QR, cartaz, story de vagas, post no Instagram);
   - **Modo TV**.
7. **Alertas que chegam ao dono:** IA falhou, WhatsApp desconectado (WhatsApp + e-mail), atendimentos sem baixa, relatórios.
8. **Renovação:** aviso nos últimos 5 dias, "Pagar agora" (Asaas da plataforma, quando configurado) ou contato manual.

### 2.2 Profissional
1. Convite por link (`/equipe/convite/[token]`) cria o acesso com papel `professional`.
2. No painel vê Início, Agenda, Clientes, Relatórios, Recepcionista e Configurações, **somente leitura** (RLS + `permissions.ts`).
3. Recebe pelo WhatsApp da loja:
   - aviso de novo agendamento (nome, dia, hora, serviços, valor, primeira vez, sinal pendente, link);
   - 15 minutos após o horário sem início, um link de um toque (`/atendimento/[token]`): "atendi / estou atendendo / cliente faltou".
4. Pode ter **número de WhatsApp próprio** conectado (`professional_whatsapp_links`). Nesse caso a recepcionista atende pelo número dele, restrita à agenda dele.

### 2.3 Cliente final
1. Chega por:
   - link na bio, QR Code ou cartaz;
   - WhatsApp da barbearia;
   - Google Maps (link manual);
   - Instagram.
2. **Página pública** (`/<slug>`): capa, nome, "Aberto agora", nota média, ações (WhatsApp, Localização, Instagram), cardápio numerado, equipe, galeria, horários, clube, produtos, "Instalar app da casa".
3. **Agendamento** (`/<slug>/agendar`):
   - **Serviço**, com vários serviços combinados, até 8;
   - **Profissional**: "Qualquer profissional" ou um específico, com o próximo horário livre;
   - **Horário**: faixa de dias com contagem de vagas, calendário, Manhã/Tarde/Noite, "Primeiro horário livre", lista de espera em dia cheio;
   - **Dados**: nome e WhatsApp, lembrete opcional, CPF se houver sinal;
   - **Pronto**: carimbo "Horário confirmado", ticket, arquivo de calendário (.ics), compartilhar.
4. **Comprovante** (`/booking/[token]`):
   - remarcar e cancelar conforme a política (`cancellationHours`);
   - pagar o sinal Pix (QR + copia e cola);
   - "Cheguei" (check-in);
   - avaliação de 1 a 5 estrelas após a conclusão.
5. **WhatsApp com a recepcionista:**
   - qualquer mensagem escrita (ou áudio, se houver transcrição) recebe resposta;
   - a IA oferece menus numerados ("caixinhas") de serviços, dias e horários;
   - o cliente responde com o número, e a IA marca, cancela ou remarca;
   - o cliente pode pedir humano.
6. **Avisos que o cliente recebe:**
   - confirmação imediata pelo WhatsApp;
   - lembretes 12h, 2h e 1h antes;
   - e-mail de confirmação e de véspera, se informou e-mail e houver Resend;
   - mensagem de retorno após X dias sem voltar (desligada por padrão);
   - responder "PARAR" interrompe as mensagens de retorno.
7. **Clube de assinatura** (`/<slug>/clube`): assina pelo Asaas da barbearia e agenda com "Incluso no clube".

---

## 3. Histórico do desenvolvimento

### 3.1 Linha do tempo (Git)

| Data | Marco |
| --- | --- |
| 17/08/2026 | Repositório `agrogestor` criado (outro produto, ERP agro) |
| 29/09 | `agendai`: primeira agenda multi-negócio |
| 02–03/10 | Importação do StudioFlow do Codex; página pública e agendamento seguindo a referência `docs/reference/Foto-1.jpg`; painel no estilo da referência; clientes e permissões; fotos no Supabase Storage |
| 04/10 | Visual "Cartaz" em todo o app; sinal Pix e Clube via Asaas da loja; lembretes, divulgação com QR, fidelidade, lista de espera; avaliações reais; recepcionista com IA (chat e WhatsApp oficial); painel da plataforma; produtos com estoque; check-in QR; Modo TV; story de vagas; áudio e Instagram Direct |
| 05/10 | Planos e módulos por cliente; bloqueio do `/admin` no servidor; WhatsApp por QR Code (Evolution) e aviso ao profissional; mensalidade com liberação automática; cadastro completo da loja; fotos de serviço, mapa e Instagram |
| 09–10/10 | Trava do mesmo cliente; auditoria por estabelecimento; confirmação ao cliente corrigida; n8n; Marketing com IA; e-mail Resend; domínio oficial `app.studioflowapp.tech`; app da casa (PWA); TV de vitrine; Termos e Privacidade; CI |
| 13–14/10 | Retrospectiva do mês; site de vendas com movimento; Marketing com Reels e piloto automático; modo da IA por cliente (`business_ai_plan`); e-mails aos donos pelo Resend com IA |
| 29–30/10 | Recepcionista no WhatsApp: listas, cancelar e remarcar, rajadas de mensagens, contatos pessoais; Next 16.4.3 (segurança); fundação de design; **Salão ao vivo** e depois **em 3D (three.js)**; agenda premium; demo ao vivo no site |
| 31/10 | **Recepcionista v3**: motor único com Claude Sonnet 5.5; teste pelo `/admin` com a chave da loja; dono avisado na hora; memória do cliente; cancelar/remarcar na conversa; 39 conversas de teste e rodada da madrugada; filtro entende gíria; correções da auditoria de produção |
| 01/11 | Modo TV redesenhado; Divulgar enxuta; cadastro em 3 passos (conta sem esperar e-mail); teste grátis no admin; tesoura no nome da casa; agenda de demonstração. **Novo repositório `studioflow` (11 commits a partir daqui)** |
| 02/11 | **Captação** no `/admin` (Google Maps → nota → mensagem IA → WhatsApp); **Marketing pela Zernio**. Harvey adaptado para e-mail frio em pt-BR (`agrogestor/harvey-studioflow`, fora do app) |
| 12/11 | Avisos que falhavam calados corrigidos; teste da madrugada consertado; métricas do Marketing; link público mais seguro (teto de 4 horários futuros por telefone, cabeçalhos de segurança) |
| 13/11 | WhatsApp: listas em blocos (caixinhas), menu numerado e resposta por número; **recepcionista responde a qualquer mensagem escrita** |
| 24/11 | Nenhum atendimento travado; Next.js 16.4.6 (7 falhas de segurança corrigidas); WhatsApp com reconexão automática e aviso no celular; faixa "Precisa de você"; concluir com pagamento na agenda |

### 3.2 Decisões técnicas importantes
- **Next.js com Webpack** em vez de Turbopack (lentidão no Windows do autor original).
- **Supabase com RLS + RPCs `security definer`** restritas a `service_role` para tudo que é crítico; o servidor confere vínculo antes.
- **Concorrência de agenda no banco:** advisory lock, revalidação completa, exclusion constraint GiST e trava do mesmo cliente.
- **Tokens públicos de 256 bits, só o hash no banco.**
- **Segredos de terceiros cifrados** (AES-256-GCM) em tabelas sem políticas RLS.
- **Região `gru1`** na Vercel, para ficar perto do Supabase `sa-east-1`.
- **WhatsApp:**
  - a Evolution por QR Code é o padrão (sem aprovação da Meta);
  - a Cloud API da Meta é suportada;
  - as listas nativas estão desligadas, porque a Evolution 2.3.7 recusou com HTTP 400. Por isso foi adotado o menu numerado em texto.
- **Recepcionista v3** (`STUDIOFLOW_ASSISTANT_ENGINE=v3`): um único motor de conversa com ferramentas, substituindo o "interpretador + regras" (v2) e o fluxo n8n. O v2 segue no código como alternativa.
- **Cofre de IA por loja:** cada barbearia pode ter a própria chave (ou usar a da plataforma). Os "modos de IA" (econômico, equilibrado, máximo) valem para o motor v2.
- **Jobs no banco** (`pg_cron` chamando o app) em vez de fila dedicada.
- **Demo sem banco** (`.data/`), usada em testes e capturas.

### 3.3 Alterações visuais (sequência)
1. **Editorial branco + navy (Codex):** capturas em `docs/capturas-antes/`.
2. **Reaproximação da referência `Foto-1.jpg`** (03/10): capturas em `docs/capturas-depois/`.
3. **"Cartaz"** (04/10): escolhido entre três direções (Cartaz, Noir, Gráfico). Paleta papel/tinta/latão. Os efeitos chamativos foram removidos (luz que segue o mouse, ondulação, brilho).
4. **Animações de agendamento:** abertura com monograma, carimbo de confirmação, vídeo do barbeiro.
5. **Fundação de design e agenda premium** (30/10); **Salão ao vivo 3D** (30/10).
6. **Ícones de emoji nas listas do WhatsApp e caixinhas** (13/11).

### 3.4 Problemas encontrados e correções (amostra relevante)
- **Confirmação ao cliente não saía.** O n8n "respondia 200" sem enviar. Agora sai direto pelo app (09/10). Teste real autorizado confirmou a entrega (10/10).
- **Listas nativas recusadas pela Evolution 2.3.7:** substituídas pelo menu numerado em texto.
- **IA inventava data/hora no primeiro pedido:** o backend limpa esses campos e consulta a agenda.
- **Avisos falhando calados e teste noturno quebrado.** O teste noturno gerou 48 erros `ENOENT /var/task/.data` até 03/11. Corrigido em 12/11.
- **Recepcionista ficava em silêncio para mensagens fora do tema.** Agora responde a qualquer mensagem escrita (13/11).
- **Chave de IA recusada (`provider-auth`):** 6 execuções e 19 erros registrados. O dono trocou a chave no cofre em 24/11.
- **Atendimentos travados em "GENERATING":** 5 casos em 16–17/11, todos já fechados. Causa: função encerrada sem prazo e recuperação limitada. Corrigido com prazo de 200 s, varredura de travados e `maxDuration` de 300 s.
- **WhatsApp da piloto caído desde 17/11** com 23 avisos só por e-mail. Agora há reconexão automática e aviso por WhatsApp. A tentativa de 24/11 ficou em "connecting": **precisa ler o QR Code de novo**.
- **Next.js 16.4.3 com 7 vulnerabilidades:** atualizado para 16.4.6 (24/11).

### 3.5 Funcionalidades abandonadas ou paralisadas
- **Fluxo de atendimento no n8n** (Haiku 4.5, 3 iterações): substituído pela recepcionista v3 no app. As variáveis `N8N_*` continuam na Vercel e os avisos n8n foram enviados (44 recibos), mas o caminho principal é o app.
- **Evolution no Render gratuito:** trocada pela VPS Hostinger. O blueprint `render.yaml` permanece no repositório.
- **Rota temporária de narração dos Reels:** removida em 31/10. **A variável `NARRATION_TOKEN` ficou na Vercel.**
- **Listas nativas do WhatsApp:** desligadas até haver teste real.
- **Teste grátis automático no cadastro:** implementado, mas a decisão de publicar estava pendente (nota de 10/10). Hoje há configuração de dias de teste no `/admin` (`platform-trial.ts`).
- **Motor v2 da recepcionista:** mantido como reserva (`STUDIOFLOW_ASSISTANT_ENGINE=v2`).

### 3.6 Branches, commits e publicações
- `mh0097317-ai/studioflow`: **branch `main`**, 11 commits (01/11 a 24/11). Cada push publica na Vercel. O último deploy de produção (`dc1ff6f`) está READY.
- `mh0097317-ai/agrogestor`: branch `claude/barbershop-scheduling-platform-0jnoui`, espelho do StudioFlow em `studioflow/` (124 commits do StudioFlow) e também `harvey-studioflow/`, `divulgacao/`, `agendai/` e o ERP Agrogestor original.
- **Versão atual:** `package.json` 1.0.0 (o número nunca foi incrementado); na prática, o commit `dc1ff6f`.

### 3.7 Onde paramos exatamente
- **Último trabalho publicado (24/11):** "Início mostra o que precisa do dono e a agenda conclui já cobrando".
- **Pendente e verificado nesta auditoria:**
  1. WhatsApp da barbearia piloto desconectado desde 17/11. A reconexão automática foi tentada em 24/11 16:35 UTC e ficou em `connecting`. Ação: **o dono precisa ler o QR Code** em Configurações → WhatsApp.
  2. Depois disso, mandar uma mensagem de teste de outro número para confirmar `SENT`.
  3. **Job diário `/api/cron/billing` sem `CRON_SECRET`**: lembretes de mensalidade, renovação de token do Instagram e e-mails de boas-vindas não rodam.
  4. Pedidos aguardando aprovação do dono (Supabase): migração da agenda de demonstração com serviços/produtos da piloto; apagar 4 barbearias de teste.
  5. Ações do dono:
     - trocar a chave da Zernio, que foi colada no chat;
     - ligar a proteção de senhas vazadas no Supabase;
     - renovar o acesso da piloto, se o prazo venceu;
     - configurar o DNS do domínio raiz.
  6. **33 agendamentos passados continuam "confirmados"** (nenhum foi finalizado). Os relatórios ficam distorcidos até alguém usar "Finalizar".

---

## 4. Auditoria das interfaces

Capturas reais (desktop 1440×900 e iPhone 13) estão em `capturas/` no pacote, com o mesmo nome. Origem dos dados: **D** = `GET /api/workspace` (Store inteiro no cliente), **P** = APIs públicas por slug, **A** = `/api/admin/*`. Permissões: G = gestão (owner/admin/manager), R = recepção, Pr = profissional.

### 4.1 Site institucional, `/`
- **Finalidade:** vender (hero, dores, como funciona, planos sem preço, perguntas, oferta de lançamento).
- **Componentes:** `features/landing/landing.tsx`; mock de celular e do Salão 3D.
- **Botões:** Entrar, Testar grátis (→ `/login?signup=1`), Ver demonstração ao vivo.
- **Dados:** estáticos.
- **Problemas:**
  - aviso de hidratação no console em desenvolvimento;
  - sem preços públicos, o que pode reduzir conversão;
  - sem prova social real (depoimentos, logos).
- **Melhorias:** página de preços, vídeo curto de 30 s, depoimento da piloto, comparação com concorrentes.

### 4.2 Login e cadastro, `/login`, `/login/nova-senha`
- **Finalidade:** login, criar conta (`?signup=1`), recuperar senha. Layout em duas colunas com foto.
- **Backend:** Supabase Auth; `/api/signup`.
- **Problemas:** nenhum visível. O provedor de login social não existe.

### 4.3 Cadastro da loja, `/onboarding`
- **Finalidade:** 6 etapas com prévia "Sua página está X% pronta".
- **Backend:** `/api/onboarding` → `create_workspace` + `completeWorkspace`; consulta de CNPJ.
- **Problemas:** longo para quem quer "testar rápido". Mitigação já existe: conta sem e-mail e cadastro em 3 passos.

### 4.4 Termos e Privacidade, `/termos`, `/privacidade`
- **Finalidade:** textos LGPD.
- **Pendência:** revisão jurídica (recomendada no próprio código) e criação da caixa `contato@studioflowapp.tech`.

### 4.5 Página pública da casa, `/[slug]`
- **Finalidade:** vitrine e conversão para o agendamento.
- **Componentes:** capa, "Aberto agora", nota, ações, abas (Serviços, Profissionais, Nossos trabalhos, Combos), cartão fixo de agendamento no desktop, chat da recepcionista, clube, produtos, instalar app.
- **Dados:** P (`public-catalog.ts`, cache de 15 s), Instagram (`/instagram`, cache de 15 min).
- **Problemas:** lojas antigas sem contato preenchido escondem Localização/WhatsApp/Instagram.
- **Melhorias:** SEO local (schema.org `HairSalon`, metatags por loja), avaliações do Google, botão "Reservar com Google".

### 4.6 Agendamento, `/[slug]/agendar`
- **Finalidade:** cinco etapas (detalhes na seção 5).
- **Backend:** `/availability`, `/slots`, `/next-free`, `/book` (RPC `book_public_appointment` → `book_appointment`).
- **Responsividade:** boa, com barra inferior fixa e gestos.
- **Problemas:** na confirmação aparece uma faixa escura vazia acima do ticket (provável foto/mapa sem imagem na demo; verificar com loja real). No desktop a confirmação é uma coluna estreita.

### 4.7 Comprovante, `/booking/[token]`
- **Finalidade:** ticket, contagem regressiva, remarcar/cancelar, sinal Pix, check-in, avaliação, instalar app, .ics.
- **Backend:** `/api/booking/[token]` (`get_booking`, `manage_booking`), `/deposit`.

### 4.8 Clube público, `/[slug]/clube`
- Planos, assinatura e fatura Asaas. Sem planos, mostra "Clube em breve". Depende do módulo `clube` e da conta Asaas da loja (0 contas em produção).

### 4.9 Check-in, `/[slug]/checkin`
- O cliente avisa que chegou (token salvo ou telefone).
- A RPC `check_in_by_*` aceita de 3 h antes até o fim do atendimento.

### 4.10 Atendimento (profissional), `/atendimento/[token]`
- Link assinado de 48 h: "atendi / estou atendendo / faltou" (`settle_attendance`).
- Não mostra o telefone do cliente.

### 4.11 Convite de profissional, `/equipe/convite/[token]`
- Aceite do convite e criação do acesso do profissional.

### 4.12 Início, `/dashboard` (todos os papéis; blocos de gestão só para G)
- **Hoje:** "Salão ao vivo" em 3D com cadeiras, estado de cada profissional, feed do dia e caixa, ações na cadeira (iniciar, concluir e cobrar).
- **Outros dias:** "comando do dia".
- **Faixa "Precisa de você"** (G):
  - WhatsApp caído → Reconectar;
  - IA parada por chave → Avisar o StudioFlow ou Ver detalhes;
  - conversas esperando;
  - horários passados sem finalizar.
- **Cards:** Atendimento no WhatsApp (contagens), Resultados do StudioFlow, retrospectiva do mês (G), indicadores, ocupação, faturamento da semana, avaliações, atenção (pendentes e clientes sumidos), lembretes de amanhã (WhatsApp manual), lista de espera, checklist "Complete sua página".
- **Dados:** D + `/api/workspace/conversations` (60 s) + `/api/workspace/operation` (5 min, G).
- **Problemas:**
  - o 3D é pesado para celulares simples (three.js);
  - excesso de blocos (inferência: densidade alta).
- **Melhoria:** modo "lite" sem 3D em aparelho fraco.

### 4.13 Agenda, `/dashboard/agenda` (`view=day|week|month`, `date`, `professional`)
- **Finalidade:** grade por profissional com duração proporcional, expediente, pausas e bloqueios; janelas disponíveis por serviço; lista por períodos no celular.
- **Botões:** Novo agendamento, Bloquear horário, filtro de equipe, Dia/Semana/Mês.
- **Detalhe do horário:**
  - Confirmar / Iniciar / **Concluir e cobrar** (com forma de pagamento);
  - Editar ou reagendar, Marcar falta, Cancelar, Vender produto, Conversar no WhatsApp.
- **Backend:** `workspace_mutation`.
- **Permissões:** criar/editar G e R; Pr só lê.
- **Problemas:** sem arrastar e soltar; sem recorrência; sem lista de espera integrada à grade.

### 4.14 Clientes, `/dashboard/clientes`
- **Finalidade:** lista com busca, abas (Todos, Em atraso, Novos, Ativos, Inativos), indicadores, perfil com histórico, métricas, fidelidade, editar e "Novo cliente".
- **Faltam:** aniversário, tags, preferências estruturadas, importação, exportação, mesclar duplicados.

### 4.15 Conversas, `/dashboard/conversas` (módulo `recepcionista`)
- **Finalidade:** caixa de entrada com filas Precisam de você / Com a IA / Com a equipe / Todas, mais filtros e aba Contatos (sincronizados do WhatsApp).
- **Conversa:** espelho real do WhatsApp; assumir, responder, devolver à IA, encerrar; estado da execução com dica de erro.
- **Backend:** `/api/workspace/conversations[/id]`, envio pelo número da loja.
- **Problemas:** sem envio de mídia pela equipe; sem respostas rápidas salvas.

### 4.16 Recepcionista IA, `/dashboard/treinamento`
- **Finalidade:** status (atendimento pausado/ativo, números conectados), simulador "Converse com a sua recepcionista" (usa o motor real, `simulate`), treinamento (instruções da casa, coach), análise de conversas.
- **Backend:** `/api/workspace/assistant/{simulate,training}`.

### 4.17 Serviços, `/dashboard/servicos`
- CRUD com até 3 fotos, preço, duração, categoria, profissionais que fazem, "Mais pedido", arquivamento com histórico. Edição só para G.

### 4.18 Produtos, `/dashboard/produtos` (módulo `produtos`)
- Foto, preço, custo, estoque e mínimo.
- Venda no balcão ou no atendimento com baixa atômica; cancelamento devolve o estoque.
- Na demo os produtos estão sem foto.

### 4.19 Equipe, `/dashboard/equipe`
- Profissionais com foto, expediente, pausas, folgas, serviços, comissão (%), acesso ao painel (convite), WhatsApp próprio.

### 4.20 Financeiro, `/dashboard/financeiro`
- Período (Hoje/Semana/Mês/Personalizado), recebido, a receber, ticket, formas de pagamento, comissões (estimadas), produtos vendidos, "Registrar pagamento", valores a receber.
- Detalhes na seção 8.

### 4.21 Clube, `/dashboard/clube` (módulo `clube`)
- Planos, assinantes, receita mensal, "Enviar acesso", cancelar.
- Exige Asaas da loja: sem conta, mostra o aviso para conectar.

### 4.22 Relatórios, `/dashboard/relatorios`
- PDF do negócio (semanal/diário, enviado ao dono por WhatsApp/e-mail), resultados por canal/origem, CSV com proteção contra fórmulas.

### 4.23 Divulgar, `/dashboard/divulgar`
- Link, QR, compartilhar, textos prontos, cartaz A4, story das vagas (vagas reais), post no Instagram da loja (`shop_instagram_posts`), estúdio de fotos de trabalhos, kit de lançamento.

### 4.24 Saúde da operação, `/dashboard/operacao` (G; no menu desde 24/11)
- WhatsApp, Recepcionista e Avisos: últimas execuções, notificações, consumo diário com alerta de 80%, falhas.

### 4.25 Ativação, `/dashboard/ativacao`
- Checklist antes da primeira reserva.
- A confirmação do teste fica só no aparelho (localStorage).

### 4.26 Configurações, `/dashboard/configuracoes?aba=`

| Aba | Conteúdo |
| --- | --- |
| `business` | Empresa e aparência: dados, CNPJ (consulta), identidade, fotos, Instagram, Maps |
| `onlineBooking` | Agendamento online, horários e regras: dias e horário de funcionamento, antecedência mínima, dias máximos, intervalo, política de cancelamento, ligar/desligar agendamento online |
| `loyalty` | Cartão fidelidade |
| `payments` | Conta Asaas, sinal (fixo/percentual/prazo); na demo, "Ativar pagamento simulado" |
| `whatsapp` | QR Code, atendimento automático, avisos ao profissional, checagem de atendimento, horário da IA, mensagem de retorno, números por profissional |
| `notifications` | Avisos de agendamento (lembretes) |
| `plan` | Plano, prazo, módulos, mensalidade e faturas |

- **Problemas:** no celular, a seção é escolhida por um `<select>`, o que dá pouca descoberta.

### 4.27 Modo TV, `/tv`
- Relógio, cadeiras (atendendo/livre/próximo), fila, chegadas, QR de check-in e agendamento, vitrine rotativa. Atualiza a cada 20 s.

### 4.28 Painel da plataforma, `/admin` (equipe StudioFlow)

| Visão | Conteúdo |
| --- | --- |
| Central de controle | Chave geral da IA, status dos canais por cliente |
| Visão geral | Indicadores, receita mensal combinada, relatório semanal |
| Estabelecimentos | Lista, filtros, teste grátis, gerenciar cliente: acesso, plano/módulos, cofre de IA, modo da IA, cobrança, auditoria e funil, configuração da recepcionista |
| StudioFlow no WhatsApp | Recepcionistas e conexões, testar a recepcionista com a chave da loja |
| Cobranças | Mensalidades e faturas manuais |
| Captação | Busca de barbearias, nota, mensagem por IA, abrir conversa |
| Marketing | Conta Instagram via Zernio, chaves, piloto automático, posts, vídeos |
| E-mails | Resend, escrever com IA, prévias |
| Histórico | Ações administrativas |

- **Login:** `/admin/login`.
- **Problemas:**
  - tela muito densa;
  - no celular as visões são trocadas por `<select>`;
  - a visão "Recepcionistas" fica consultando sem parar (não estabiliza a rede; observado na captura).

---

## 5. Agenda e agendamento

### 5.1 Como funciona hoje (fatos)
- **Criação:**
  - página pública (`/book`): sem login, validação brasileira de telefone;
  - painel (`workspace_mutation`): pode marcar "por cima", sem a trava do cliente;
  - recepcionista (`assistant_manage_booking` / `book_tracked_appointment`);
  - n8n (legado).
- **Disponibilidade** (`src/lib/availability.ts` + RPC `slot_available`):
  - horário de funcionamento (`business_hours`, `openDays`, `openStart`/`openEnd`);
  - expediente por profissional (`professional_hours`), pausas (`professional_breaks`), bloqueios (`blocked_times`);
  - **duração** = soma dos serviços escolhidos, mais **buffer** (intervalo) entre atendimentos;
  - **antecedência mínima** (`minNotice`) e **horizonte** (`maxDays`);
  - profissional só oferece serviço vinculado (`professional_services`); combinação de serviços só se alguém faz todos.
- **Profissional automático:** "Qualquer profissional" (`chooseProfessional`) escolhe quem tem vaga.
- **Conflitos:**
  - checados no servidor sob advisory lock, com exclusion constraint GiST no banco;
  - mesmo telefone não pode ter dois horários sobrepostos (`customer_busy`);
  - teto de 4 horários futuros por telefone no link público (`MAX_OPEN_BOOKINGS`);
  - teste de reserva concorrente no smoke: **PASS**.
- **Bloqueios:** "Bloquear horário" no painel (`blocked_times`, com motivo).
- **Reagendamento e cancelamento:**
  - comprovante (`manage_booking`, respeita `cancellationHours`);
  - painel (sem limite);
  - recepcionista (ferramentas `remarcar_horario` e `cancelar_horario`).
  - Cancelamento libera a vaga e destaca a lista de espera.
- **Confirmação:**
  - o status nasce `confirmed`, ou `pending` quando há sinal ou aprovação pendente;
  - confirmação ao cliente pelo WhatsApp (1 por reserva, claim atômico) e por e-mail (se houver);
  - .ics no comprovante.
- **No-show:**
  - "Marcar falta" no painel;
  - link do profissional (15 min) e alerta ao dono (2 h sem resposta);
  - o status nunca muda sozinho.
- **Sinal Pix:** reserva `pending` com prazo (`deposit_hold`), expira e libera; Pix pago depois do prazo reconfirma se houver vaga.
- **Clube:** `apply_membership` zera o preço dentro do limite mensal.
- **Fuso:** fixo `America/Sao_Paulo`.

### 5.2 O que não existe (fatos)
- **Agendamentos recorrentes** ("toda sexta às 18h"): inexistente.
- **Arrastar e soltar** na agenda: inexistente.
- **Lista de espera automática:** existe a lista, mas o aviso é manual ("Chamar" abre o WhatsApp). Não há oferta automática da vaga aberta.
- **Política de no-show com cobrança:** só o sinal prévio; não há multa nem cartão em arquivo.
- **Pacotes de sessões, gift cards, serviços com recurso/sala:** inexistentes.
- **Agendamento em grupo** (vários clientes num horário): inexistente.
- **Sincronização com Google Calendar:** inexistente (só exportação .ics pelo cliente).
- **Reserve with Google / integração com agentes de IA externos:** inexistente.
- **Vários fusos horários:** não suportado.

### 5.3 O que falta para competir com plataformas profissionais
1. **Recorrência** e "agendar de novo em X semanas" com sugestão automática.
2. **Lista de espera inteligente:** cancelou → oferta automática pelo WhatsApp ao primeiro da fila.
3. **Drag & drop** e redimensionar na grade; visão por recurso/cadeira.
4. **No-show protection:** sinal por cartão, taxa de cancelamento tardio, bloqueio de reincidente.
5. **Google:** Reserve with Google, link de agendamento no Perfil da Empresa e sincronização de calendário do profissional.
6. **Pacotes e combos com preço próprio**, gift cards.
7. **Disponibilidade por demanda** (preço dinâmico em horário ocioso, como a Fresha anunciou em 2026).

---

## 6. Recepcionista IA

### 6.1 Arquitetura atual (fatos)
- **Motor em produção:** **v3** (`STUDIOFLOW_ASSISTANT_ENGINE=v3` na Vercel).
- **Código:** `src/services/assistant/receptionist.ts` sobre o laço genérico `engine/agent-loop.ts`.
- **Modelo:** **Claude Sonnet 5.5** (`claude-sonnet-5-5`, fixo em `STUDIOFLOW_RECEPTIONIST_MODEL`), usando **a chave Anthropic do cofre da loja** (`business_ai_credentials`) ou, sem ela, a chave da plataforma (`ANTHROPIC_API_KEY`, **ausente na Vercel**).
  - Em produção há **1 chave cadastrada** (a da barbearia piloto).
  - O cofre registra o modelo `claude-haiku-4-5`, mas o v3 ignora esse campo e usa o modelo fixado (`provider.ts`: `pinned || credential.model`).
- **Outros modelos no código:**
  - v2 (interpretador): `claude-haiku-4-5`;
  - modos de IA do admin: econômico = Haiku 4.5, equilibrado = Sonnet 4.6, máximo = Opus 4.8. Valem para o v2 e outras funções;
  - Marketing: Haiku/Sonnet/Opus 5.5.
  - O cofre aceita também `openai` e `mwapi` como provedores.
- **Canais:** WhatsApp (Evolution QR ou Meta Cloud), chat da página pública (prazo de 45 s), Instagram Direct (prazo de 45 s; pede o WhatsApp para marcar).

### 6.2 Fluxo de um turno
1. **Mensagem chega** (webhook) e é gravada com dedupe por `provider_message_id`. O áudio vira texto se houver credencial de transcrição; senão a IA pede texto.
2. **Lease da conversa** (`conversation_lease`, 300 s) garante uma resposta por vez. Mensagens em rajada são agrupadas.
3. **Execução** registrada em `assistant_runs`:
   - `RECEIVED` → `UNDERSTANDING` → `DECIDING` → `GENERATING` → `VALIDATING` → `SENDING` → `SENT`;
   - ou `SILENT`, `RETRY`, `FAILED`.
4. **Contexto enviado ao modelo:**
   - catálogo da loja (serviços, preços, duração, profissionais), horário de funcionamento, regras e instruções da casa (`assistantInstructions`);
   - histórico da conversa;
   - memória do cliente: nome e últimos agendamentos do mesmo telefone (`customerContext`). Não há dados de outros clientes.
5. **Ferramentas** (`receptionist.ts`):

   | Ferramenta | O que faz |
   | --- | --- |
   | `ver_horarios` | Consulta a disponibilidade real |
   | `mostrar_lista` | Gera menus de serviços, dias e horários a partir dos dados vivos, enviados como "caixinhas" numeradas |
   | `agendar` | Reserva atômica com as mesmas regras do link público, incluindo sinal e clube |
   | `cancelar_horario`, `remarcar_horario` | Só horários futuros do próprio telefone |
   | `chamar_humano` | Passa para a equipe, avisa o dono e coloca a conversa em "Precisam de você" |
   | `ficar_em_silencio` | Mensagens que não pedem resposta |
6. **Revisão antes de enviar** (`review`, até 6 passos; o modelo reescreve se algo falha):
   - não pode dizer "marquei", "cancelei" ou "remarquei" sem a ferramenta ter dado certo;
   - **horário citado precisa ter vindo da agenda** (`ver_horarios`);
   - **preço citado precisa existir no catálogo**;
   - até 900 caracteres, sem markdown nem marcadores (estilo WhatsApp).
7. **Resposta numerada:** o cliente responde "2" e `numberedPick` traduz para a opção do último menu. Toque em lista (Meta) vira `SF_SLOT|...`.
8. **Envio:** pelo número da loja ou do profissional, com "digitando…". O resultado é gravado. Sem identificação do provedor, a execução não é marcada como enviada (`delivery-unconfirmed`).

### 6.3 Cada capacidade pedida

| Capacidade | Como funciona | Tipo |
| --- | --- | --- |
| Interpretar mensagens | Claude Sonnet 5.5 lê a conversa inteira; datas relativas resolvidas em São Paulo; filtro entende gíria e nomes de cortes; qualquer mensagem escrita recebe resposta | IA real |
| Consultar a agenda | Ferramenta `ver_horarios` → mesmas funções do agendamento público | Regra local chamada pela IA |
| Identificar clientes | Pelo telefone do WhatsApp (vem do provedor, não da IA); nome e histórico vêm de `customers`/`appointments` | Regra local |
| Recomendar serviços | O modelo sugere a partir do catálogo e do "Mais pedido"; sem motor de recomendação próprio | IA real limitada ao catálogo |
| Criar agendamentos | `agendar` → reserva atômica (lock, conflito, trava do cliente, sinal, clube) | Regra local + IA |
| Cancelamentos | `cancelar_horario` (só do próprio telefone, futuro) | Regra local + IA |
| Reagendamentos | `remarcar_horario` com revalidação | Regra local + IA |
| Preços | Só do catálogo; a revisão bloqueia valor inexistente | IA + validação local |
| Informações do estabelecimento | Endereço, horário, regras e instruções no prompt | IA real |
| Transferência humana | `chamar_humano`; a equipe também assume em Conversas (`status=human`); a IA não responde conversa com a equipe | Regra local |
| Contexto | Histórico persistido; `ai_cursor` marca o que já foi tratado; recuperação a cada minuto | Regra local |
| Controle de custo | Teto diário de respostas por loja (`assistantDailyLimit`), alerta em 80%, uso por dia em `assistant_usage`, chave geral da IA no admin (`platform_ai_control`), horário de atendimento opcional, respostas de preço simples sem nova chamada no v2 | Regra local |
| Evitar respostas incorretas | Revisão (horários, preços, confirmações, tamanho), 39 conversas de teste, avaliação noturna (`nightly-eval`, uma loja por vez) | Regra local + testes |
| Impedir conflitos | Banco (lock + GiST + trava do cliente); a IA não consegue marcar por fora | Regra local (banco) |
| Recuperação de falhas | Prazo de 200 s por turno; RETRY até 3 vezes; cron de 1 min retoma; travados há mais de 6 min viram FAILED/SILENT; dono avisado por WhatsApp; conversa vai para "Precisam de você" | Regra local |

### 6.4 IA real × regras × simulações × planejado
- **IA real:** geração da conversa (v3), interpretação (v2), Marketing (posts/legendas), rascunhos de e-mail no admin, mensagem de abordagem na Captação, análise de conversas no treinamento.
- **Regras locais:** agenda, preços, menus, conflitos, envio, lembretes, alertas, mensagem de retorno (texto fixo, sem IA).
- **Simulações** (só na demo, marcadas como tal): conexão do WhatsApp, pagamento simulado, avisos em balões. O simulador do painel usa o **motor real** com a chave da loja.
- **Planejado ou parcial:** voz (credencial ElevenLabs existe, uso limitado ao admin); transcrição de áudio (sem credencial em produção); listas nativas (desligadas).

### 6.5 Evidências de produção (agregados)
- **Execuções (`assistant_runs`):** 34 `SENT`, 11 `SILENT`, 7 `FAILED`, sendo 6 por chave recusada e 1 por entrega não confirmada.
- **Uso:** 294 turnos e cerca de 541 mil tokens.
- **Volume:** 108 conversas de WhatsApp e 1 do chat web, com 6.813 mensagens.
- **Hoje** a IA não atende na piloto porque o WhatsApp está desconectado. A chave foi trocada em 24/11 e respondeu nos testes daquele dia.

---

## 7. Automações

| Automação | Gatilho | Condições | Ação | Dedupe / proteção | Histórico | Funciona? |
| --- | --- | --- | --- | --- | --- | --- |
| Confirmação ao cliente | Nova reserva (`after()`) | Canal conectado; uma por reserva | WhatsApp com dados da reserva salva | Claim atômico `customer_booking`; sem reenvio | `appointment_whatsapp_notices` (6 enviados) | **Sim** (entrega real confirmada em 10/10) |
| Lembretes 12h, 2h e 1h | pg_cron 5 min → `due_staged_appointment_reminders` | Confirmada, consentimento, notificações ligadas, criada há ≥10 min, acesso ativo, remetente conectado | WhatsApp | `appointment_reminder_steps` por reserva/etapa; janela de 15 min; falha não repete | 53 etapas registradas | **Sim**, quando o WhatsApp está conectado |
| E-mail de confirmação e véspera | pg_cron 5 min | Cliente com e-mail, `RESEND_API_KEY`, `email_notices` | Resend | `claim_email_notice` | `appointment_email_notices` (0) | Implementado; **sem uso real** (2 clientes com e-mail) |
| Aviso ao profissional | Nova reserva | `notify_professionals` | WhatsApp ao profissional | Claim + recuperação | 18 `professional_new` | **Sim** |
| "Atendeu?" | 15 min após o início sem iniciar | `attendanceCheck` | Link de 1 toque ao profissional | Uma vez por horário | 27 `professional_checkup` | **Sim** (27 dos 75 avisos falharam no total; ver Segurança) |
| Atendimento sem baixa | 2 h sem resposta | — | Lista ao dono | Por loja | `owner_email_notices` / WhatsApp | Implementado |
| Cancelamento / reagendamento | Comprovante, painel, IA | Política de horas | Libera vaga, registra atividade | Lock | `activity_log` | **Sim** (smoke) |
| Clientes inativos (mensagem de retorno) | Cron às 10h | Ligado pelo dono, IA ligada, dia de funcionamento | WhatsApp com texto fixo | 1 a cada 60 dias por cliente; máx. 15/loja/dia; "PARAR" = opt-out | `customer_winbacks` (1) | Implementado; **desligado por padrão** |
| Aniversários | — | — | — | — | — | **Inexistente** |
| Pós-atendimento / avaliação | Cliente abre o comprovante após "concluído" | — | Pede de 1 a 5 estrelas | 1 por atendimento | `reviews` (1) | **Passivo**: não há envio automático do pedido de avaliação |
| Recuperação de no-show | — | — | — | — | — | **Inexistente** (só registro de falta) |
| Campanhas para clientes | — | — | — | — | — | **Inexistente** (só "Lembrar" manual e textos prontos em Divulgar) |
| Alertas ao dono | Cron 5 min / falha da IA | IA ligada; WhatsApp caído ≥10 min | WhatsApp (número StudioFlow) + e-mail | `assistant_alerts` (claim; 12 h entre repetições; falha não conta) | 12 via WhatsApp, 23 via e-mail | **Sim** (WhatsApp desde 24/11) |
| Reconexão do WhatsApp | Cron 5 min | Caído ≥5 min; 1 tentativa a cada 30 min | `connectInstance` | `reconnect_tried_at` | `whatsapp_links` | Tentou; **sessão expirada exige QR** |
| Recuperação da IA | pg_cron 1 min | — | Retoma ou fecha execuções | Lease | `assistant_runs` | **Sim** |
| Relatórios diário e semanal | Cron | Preferências | PDF por WhatsApp/e-mail ao dono; semanal da plataforma | Por período | `weekly_report_deliveries` (69) | **Sim** |
| Lembrete de mensalidade, renovação de token do Instagram, boas-vindas | Vercel Cron diário | `CRON_SECRET` | WhatsApp/e-mail | `platform_billing_notices` | 0 registros | **Não roda** (segredo ausente) |
| Marketing StudioFlow | pg_cron 15 min | Conta Zernio, piloto automático | Publica no Instagram da StudioFlow | `claim_marketing_post` | 22 publicados, 5 falhas, 7 rascunhos | **Sim** |

**Proteção contra disparos indevidos (geral):**
- claims atômicos;
- nenhuma repetição automática quando o resultado é incerto;
- chave geral da IA;
- módulo e acesso conferidos antes de enviar;
- winback com teto diário e opt-out;
- envio só pelo número conectado;
- nenhum envio em massa.

---

## 8. Financeiro e indicadores

**Origem:** todos os números do painel são **derivados dos registros** (`appointments`, `payments`, `product_sales`, `memberships`). O próprio guia proíbe inventar números, e não há valores fixos no código de indicadores. Fontes: `features/management/finance-helpers.ts`, `features/dashboard/insights.ts`, `overview-model.ts`, `month-recap-model.ts`, `lib/customer-metrics.ts`, `lib/commercial-impact.ts`, todos com testes.

| Indicador | Existe? | Cálculo e observações |
| --- | --- | --- |
| Faturamento / recebido | Sim | Soma de `payments` pagos no período, mais vendas de produtos |
| Receita prevista / a receber | Sim | Preço dos atendimentos menos o já pago (`balanceFor`) |
| Despesas | **Não** | Não há módulo de despesas, DRE nem fluxo de caixa de saídas |
| Comissões | Parcial | Percentual atual do profissional × atendimentos: **estimativa**; sem histórico de percentuais nem repasse |
| Ticket médio | Sim | Recebido ÷ atendimentos concluídos |
| Ocupação | Sim | Minutos ocupados ÷ expediente, por profissional |
| Produtividade por profissional | Parcial | Ocupação e ranking por período; sem metas |
| Clientes novos / recorrentes | Sim | `customer-metrics.ts` (primeira visita, retorno, em atraso) |
| Formas de pagamento | Sim | Pix, dinheiro, crédito, débito, outro |
| Cancelamentos e faltas | Sim | Contagens no período e por canal (Relatórios) |
| Perdas por no-show | Parcial | Contagem de faltas; valor perdido não destacado (inferência) |
| Relatórios | Sim | PDF diário/semanal, CSV por canal, retrospectiva do mês, "Resultados do StudioFlow" (reservas pela IA/link) |

**Consistência:**
- pagamento só de atendimento concluído e dentro do saldo (servidor; smoke "overpayment rejection" PASS);
- preço e duração históricos preservados em `appointment_services`.

**Problema real de dados:**
- 33 dos 50 agendamentos em produção estão "confirmados" e já passaram; só 15 pagamentos foram registrados;
- isso distorce ocupação, ticket e faturamento;
- a faixa "Precisa de você" e o "Concluir e cobrar" (24/11) atacam isso.

**Dados fictícios:** só no modo demonstração (`seed.ts`, `demo-agenda.ts` para lojas em "modo apresentação"), sem misturar com produção.

---

## 9. CRM e marketing (para o cliente final)

| Item | Situação |
| --- | --- |
| Cadastro de clientes | Existe (nome, telefone, e-mail opcional, observações, consentimento de lembrete); criação automática ao agendar |
| Histórico | Existe (agendamentos, pagamentos, produtos, avaliação) |
| Fidelização | Cartão fidelidade (N atendimentos = prêmio), clube de assinatura |
| Preferências | Só texto livre e "último serviço/profissional" (Agendar de novo) |
| Segmentação | Abas fixas: Novos, Ativos, Inativos, Em atraso. Sem segmentos personalizados |
| Aniversários | **Inexistente** (não há campo de data de nascimento) |
| Clientes inativos | Sinal "Em atraso", mensagem de retorno automática opcional, card "Precisa da sua atenção" com WhatsApp pronto |
| Campanhas | **Inexistentes** para clientes (só textos prontos e posts) |
| Avaliações | Internas (1 a 5 estrelas no comprovante), média na página. Sem pedido ativo nem envio ao Google |
| Retenção | Lembretes, fidelidade, clube, retorno automático |
| Cupons | **Inexistentes** |
| Programa de fidelidade | Cartão de carimbos (atendimentos concluídos) |
| Comunicação personalizada | Mensagens usam o primeiro nome; IA com memória do cliente |
| Contatos do WhatsApp | 523 sincronizados (`whatsapp_contacts`) |

**Oportunidades comerciais:** campanhas segmentadas pelo WhatsApp com limite e opt-out, aniversário, NPS e avaliação no Google pós-atendimento, cupons e indicação ("indique um amigo"), pacotes.

---

## 10. Arquitetura, banco, segurança, visual, infraestrutura

Ver os documentos dedicados (`STUDIOFLOW_ARQUITETURA.md`, `STUDIOFLOW_SEGURANCA.md`, `STUDIOFLOW_AUDITORIA_VISUAL.md`). Pontos-chave:
- **Arquitetura:**
  - monólito Next.js 16.4.6 na Vercel (gru1) + Supabase (sa-east-1);
  - 76 tabelas com RLS, 63 migrações, 65 funções;
  - pg_cron com 3 jobs, Vercel Cron com 1 job (parado).
- **Segurança:**
  - forte no isolamento (RLS + vínculo no servidor + FKs compostas) e na concorrência;
  - fraquezas:
    - rate limit em memória;
    - sem homologação separada;
    - proteção de senhas vazadas desligada;
    - variáveis sensíveis mal classificadas na Vercel;
    - backups sem teste de restauração;
    - termos sem revisão jurídica.
- **Visual:** identidade "Cartaz" consistente e madura. **Não há evidência no repositório de uso de "Paper Design" ou "ProfitizeBuild"**: as referências registradas são `docs/reference/Foto-1.jpg` e as três direções internas (Cartaz, Noir, Gráfico).
- **Infra:**
  - app em https://app.studioflowapp.tech;
  - WhatsApp numa VPS Hostinger (Evolution + n8n em Docker);
  - sem monitoramento externo.

---

## 11. Modelo SaaS e potencial comercial

| Item | Existe hoje | Observação |
| --- | --- | --- |
| Cadastro de estabelecimentos | Sim | Self-service, 6 etapas |
| Onboarding | Sim | Ativação, checklist "Complete sua página" |
| Multiempresa | Sim | Tenant + business; o mesmo usuário pode ter vínculos com várias, mas **sem seletor de empresa no painel** (pendência registrada) |
| Personalização por estabelecimento | Sim | Identidade, cor, fotos, domínio por slug, PWA por loja |
| Planos de assinatura | Sim | Essencial, Profissional, Premium ou módulos avulsos (`modules.ts`) |
| Limites de utilização | Parcial | Teto diário de respostas da IA; sem limite por plano (profissionais, mensagens) |
| Cobrança recorrente | Parcial | Fatura Asaas mensal com liberação automática **implementada, não configurada**; cobrança manual em uso; sem cartão recorrente |
| Controle de consumo de IA | Sim | `assistant_usage`, alerta em 80%, chave geral, chave por loja |
| Custos por mensagem | Parcial | Tokens medidos; o custo em R$ não é calculado nem repassado |
| Período de teste | Sim | Configurável (padrão 30 dias) |
| Painel administrativo da plataforma | Sim | `/admin` completo |
| Suporte | Parcial | Botão de WhatsApp depende de `NEXT_PUBLIC_STUDIOFLOW_WHATSAPP` (ausente); sem central de tickets |
| Cancelamento de assinatura | Parcial | Pelo `/admin` (pausar/encerrar); sem autoatendimento do dono |
| Escalabilidade | Média | Store inteiro carregado no cliente (pesado para lojas grandes); rate limit em memória; Evolution numa única VPS |
| Rentabilidade | Não medida | Sem dados de receita nem de custo no repositório. Não há como afirmar margem |

**Não há preços nem receitas inventados neste relatório.** Para definir preço, ver as referências de mercado em `STUDIOFLOW_RELATORIO_FINAL.md` (seção Concorrência).

---

## 12. Avaliação competitiva (resumo; detalhes e fontes no Relatório Final)

| Plataforma | Preço de entrada (fonte oficial quando disponível) | IA / WhatsApp | Posição |
| --- | --- | --- | --- |
| Fresha | US$ 19,95/mês (Independent) ou US$ 14,95 por membro (Team); 20% sobre 1º cliente do marketplace | AI Concierge pago; 1 em 4 reservas via agentes de IA (Gemini) em 2026 | Marketplace global |
| Booksy | US$ 29,99/mês + US$ 20 por membro (EUA); Boost 30% da 1ª visita | Lembretes SMS/push; reserve with Google | Marketplace + gestão |
| Trinks (BR) | Por faixa de profissionais (valor não público nos resultados); planos semestral/anual com fidelidade | Atendente virtual "Cloudia" como adicional; clube como adicional | Líder brasileiro de gestão |
| Avec (BR) | A partir de R$ 88,90/mês (1–2 profissionais) | IA que agenda no WhatsApp 24h; marketing com IA; conta digital | Gestão + pagamentos |
| AgendaPro (LatAm) | Por país; WhatsApp em pacotes (ex.: US$ 7 por 50 mensagens) | IA pouco clara | Gestão multi-segmento |
| GlossGenius (EUA) | US$ 24 / 48 / 148 por mês | "Reception": IA atende ligação e texto 24/7 (a partir de ~US$ 50/mês) | Premium independente |
| Boulevard (EUA) | ~US$ 140–159/mês, contrato de 12 meses (terceiros) | Automação de marketing | Premium para salões/spas grandes |

**Onde o StudioFlow é forte:**
- IA de recepção integrada ao núcleo, que agenda de verdade no WhatsApp brasileiro;
- design premium;
- sem comissão;
- alertas operacionais;
- Salão ao vivo e TV.

**Onde é fraco:**
- base instalada;
- despesas e DRE, nota fiscal;
- campanhas e CRM avançado;
- recorrência;
- marketplace e descoberta;
- app nativo;
- maquininha e pagamentos presenciais;
- maturidade de suporte.
