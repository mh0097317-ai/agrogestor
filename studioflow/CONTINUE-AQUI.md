# StudioFlow — guia para continuar o projeto

Este pacote contém o projeto atual, a referência visual original e evidências do redesign. Continue a aplicação existente, preservando código, dados, funcionalidades e contratos. Não recrie o projeto do zero.

## Primeiro acesso

Extraia o ZIP, abra a pasta `studioflow` e execute com Node.js 22 ou 24 e npm:

```sh
npm ci
npm run dev
```

Abra `http://localhost:3000/dashboard`. Use a pasta onde extraiu o ZIP; o caminho Windows citado no README registra somente o ambiente original.

Rotas principais:

- `/dashboard`: painel de gestão.
- `/barber-011`: página pública do estabelecimento de demonstração.
- `/barber-011/agendar`: agendamento em cinco etapas.
- `/booking/[token]`: comprovante, reagendamento e cancelamento.
- `/login`: acesso e cadastro.
- `/onboarding`: criação do estabelecimento.

Copie `.env.example` para `.env.local` quando configurar o ambiente. Nenhuma credencial real acompanha o pacote. Sem URL Supabase, o desenvolvimento usa dados fictícios e arquivos locais por estabelecimento em `.data/`. A demonstração não tem autenticação real e está bloqueada em produção. O snapshot fictício atual da BARBER 011 foi incluído; seus agendamentos de demonstração usam as datas do desenvolvimento original. Os seeds centralizados também continuam disponíveis.

`npm run build` verifica a compilação de produção sem precisar conectar um projeto remoto. Para usar contas e dados reais com `npm start`, configure o Supabase e aplique a migration.

## Stack e organização

Next.js 16.3.8/App Router, React 19.3.0, TypeScript 6, Tailwind CSS 4, Fraunces e Hanken Grotesk locais, Phosphor, Supabase Auth/SSR, PostgreSQL, React Hook Form, Zod e date-fns. Preserve o lockfile. Os scripts usam Webpack após lentidão observada no Turbopack deste Windows.

Leia `AGENTS.md`. Antes de alterar APIs ou convenções Next.js, consulte a documentação instalada em `node_modules/next/dist/docs/` depois de `npm ci`.

```text
src/app/          Rotas, APIs, Auth, metadados e PWA
src/components/   Controles compartilhados, feedback e painéis acessíveis
src/features/     Apresentação e estado de cada módulo
src/hooks/        Workspace e permissões
src/lib/          Seeds, datas, disponibilidade, métricas e Supabase
src/services/     Validações e acesso a dados no servidor
src/types/        Contratos compartilhados
supabase/         Migration, seed SQL e documentação
tests/            Domínio, banco, concorrência, datas, métricas e segurança
scripts/          Smoke HTTP e geração de seed SQL
docs/             Registro de validação e referência visual
.data/            Snapshot fictício e capturas da revisão
```

## O que já existe

Página pública personalizável; agendamento em cinco etapas com seleção automática de profissional; calendário, confirmação, arquivo de calendário, reagendamento e cancelamento; painel do proprietário; agenda dia/semana/mês; CRM com histórico e regra simples de retorno; CRUD de serviços e equipe; pagamentos parciais; financeiro e relatórios por período; CSV; configurações por seção com rascunhos e confirmação de descarte; onboarding; acesso; PWA e tela offline.

O visual "Cartaz" (papel, tinta e latão, Fraunces + Hanken Grotesk) está aplicado a todos os módulos, com fotografia contextual, indicadores compactos e composições próprias. No celular, há navegação inferior e destaque para o atendimento prioritário. O calendário mobile usa datas semanais e lista por períodos.

A referência original está em `docs/reference/Foto-1.jpg`. Capturas reais da interface estão em `.data/editorial-*.jpg`; as 72 medidas responsivas ficam em `.data/editorial-responsive.json`. Leia `README.md`, `docs/redesign-validation.md` e `supabase/README.md` antes de propor mudanças.

## Direção visual e escopo aprovados

- Direção "Cartaz" (escolhida em 4/10/2026; substitui o branco + navy anterior): papel `#F4F0E8`, cartões `#FFFDF9`, tinta `#16130F`, texto de apoio `#6E655B`, linhas `#DCD2C2`/`#E2D9CA`, latão `#8A6430` (texto) e `#A47A3C` (estrelas e detalhes). Cor do estabelecimento, quando escolhida, substitui a tinta nos botões da página e do agendamento (cor chapada, sem degradê).
- Tipografia: Fraunces (títulos, nomes e preços; variável `--serif`) e Hanken Grotesk (interface), locais em `src/app/fonts/` com licença OFL. As variáveis das fontes ficam no `<body>` (`--font-display`, `--font-ui`); não usar `--font-serif`/`--font-sans`, que o Tailwind já define.
- Sem degradês decorativos, brilho em botões, luz que segue o mouse, ondulação ao tocar ou ícones em quadradinhos coloridos. Cantos de 2–4px, linhas finas no lugar de sombras, serviços como cardápio numerado, transições de 150–250ms com movimento reduzido.
- Fotografia como identidade principal do estabelecimento; logo pequena e opcional, com fallback elegante.
- Agendamento em cinco etapas separadas; preservar escolhas e dados ao voltar ou recuperar um conflito.
- Agenda com duração proporcional, expediente, pausas e bloqueios. Criação e reagendamento têm confirmação explícita.
- Indicadores e rankings derivados dos dados e do período escolhido. Não inventar avaliações, crescimento ou disponibilidade.
- Não criar ERP, landing page institucional como foco, IA complexa, envio de WhatsApp simulado ou cobrança fictícia (o pagamento simulado existe só no modo demonstração, identificado como tal).
- Manter APIs e banco atuais; parâmetros opcionais da agenda são `view`, `date` e `professional`.
- Próxima fase: piloto de produção. Cobrança e WhatsApp automático ficam para uma etapa comercial posterior.

## Proteções que devem permanecer

- Isolamento por tenant/business_id, RLS e chaves estrangeiras compostas.
- Autenticação e vínculo do usuário verificados no servidor; `user_metadata` não concede privilégios.
- Projeções explícitas nas APIs públicas, sem CRM ou financeiro.
- Disponibilidade confirmada novamente no servidor, considerando o intervalo completo, duração, buffer, expediente, pausas, bloqueios e folgas.
- RPC/transação com advisory lock e exclusion constraint GiST para evitar double booking. Não substituir por checagem apenas no frontend.
- RPCs críticas exclusivas de `service_role`. A chave secreta nunca recebe `NEXT_PUBLIC_`.
- Tokens públicos aleatórios de 256 bits; apenas o hash fica no banco.
- Preço e duração históricos preservados; pagamento somente de atendimento concluído e dentro do saldo restante.
- Mutações com resultado desconhecido não são repetidas automaticamente.
- O service worker não deve cachear dados privados.
- Testes de escrita usam estabelecimento isolado; preservar a BARBER 011.

## Verificações já realizadas

Na entrega local de 2 de outubro de 2026, lint, TypeScript, 24 testes automatizados e build passaram. A revisão incluiu 375, 390, 430, 768, 1024 e 1440px sem overflow horizontal nas verificações finais, foco dos painéis e reserva completa no navegador com recuperação de conflito, reagendamento e cancelamento.

Reexecute após alterações:

```sh
npm run lint
npm run typecheck
npm test
npm run build
```

Com o servidor de desenvolvimento ativo:

```sh
npm run test:smoke
```

O smoke cria e remove seu próprio estabelecimento fictício. PGlite executa a migration e RPCs PostgreSQL nos testes e não é o banco do aplicativo. Nenhum Supabase remoto foi modificado ou validado nesta entrega. Teclado virtual e instalação PWA em dispositivos físicos seguem pendentes.

## Refinamento visual de 3 de outubro de 2026

O visual foi reaproximado da referência `docs/reference/Foto-1.jpg` (as capturas anteriores estão em `docs/capturas-antes/`, as novas em `docs/capturas-depois/`):

- Página pública: capa com identidade centralizada (logo pequena ou ícone do segmento via `src/lib/segments.ts`), card sobreposto com aberto/fechado e próxima abertura, ações, CTA, serviços em miniaturas, banner do espaço, comodidades, profissionais, fotos, horários e mapa. Desktop com card de agendamento fixo.
- Agendamento: etapas sem etiquetas extras, fotos nos serviços, duração humana (`durationLabel`), calendário limpo, checkbox de lembrete corrigido.
- Painel: início com 4 indicadores com ícone, tabela do dia, mini calendário e resumo (receita prevista/realizada, ticket, atendidos, comparecimento); no celular, cabeçalho navy com indicadores 2x2 e próximos agendamentos. Sidebar mostra a identidade do estabelecimento.
- Clientes: abas Todos/Em atraso/Novos/Ativos/Inativos, linhas compactas no celular, selo "Em atraso", telefone formatado.
- Fotos de demonstração em `public/demo/`; seed usa a data de São Paulo e inclui um cliente "em atraso".
- `businessDay` trata datas simples (`yyyy-MM-dd`) como dia do estabelecimento.
- Permissões: o papel `professional` agora é somente leitura no cliente, igual à RPC `workspace_mutation`, com teste.

Verificado: lint, TypeScript, 26 testes, build, smoke HTTP e varredura sem overflow horizontal em 14 rotas × 375/390/430/768/1024/1440px.

## Identidade, ícones e animações (3 de outubro de 2026)

- Logo nova: "S" geométrico em dois tons com brilho. Fonte em `public/icon.svg` e no componente `src/components/brand.tsx` (`BrandLogo`, `Brand`); PNGs do PWA (192, 512, maskable e apple) gerados a partir do SVG.
- Ícones: `@phosphor-icons/react` (duotone/fill) na página pública, agendamento, navegação e indicadores; logos reais de WhatsApp, Instagram e mapa em `src/components/brand-icons.tsx`. Desde a rodada de fotos, todas as telas usam Phosphor (Lucide não é mais importado).
- Animações: `src/styles/motion.css` (easing, keyframes, `.sf-stagger`, `.sf-sheen`, `.sf-press`) e `src/components/motion.tsx` (`MotionProvider` para `[data-reveal]` ao rolar e `CountUp`). Tudo respeita `prefers-reduced-motion`; o conteúdo só é escondido para revelar depois que o JS marca a página como `motion-ready`.
- Confirmação com check desenhado, onda e confete apenas para agendamentos criados há menos de 10 minutos.
- Não rode `npm run build` com o `npm run dev` ativo: os dois usam `.next` e o dev passa a falhar com "Manifest file is empty".

## Refinamentos de uso (3 de outubro de 2026)

Cliente:
- Etapa de horário abre com o primeiro dia livre já selecionado (`date-step.tsx`, sem efeito colateral: data ativa derivada).
- Cada profissional mostra o próximo horário livre ("Livre hoje às 14:30"), via `GET /api/public/[slug]/next-free?serviceId=` e `nextFreeByProfessional` em `src/lib/availability.ts` (projeção pública só com id do profissional e o horário).
- Cliente lembrado no aparelho (`localStorage` `studioflow:customer`) com "Que bom te ver" e "Não é você?" para apagar.
- Barra inferior acumula serviço → profissional → dia e hora; vibração curta ao escolher (`src/lib/haptic.ts`).

Dono:
- Card "Agora" (em atendimento ou próximo) com ação direta (Confirmar/Iniciar/Concluir) e WhatsApp.
- Ação rápida por linha na agenda do dia; "Iniciar" só aparece até 1 hora antes.
- Faturamento dos últimos 7 dias (recebido x agendado, comparação com a semana anterior), ocupação por profissional e "Precisa da sua atenção" (pendentes com Confirmar e clientes sumidos com WhatsApp e mensagem pronta). Cálculos em `src/features/dashboard/insights.ts`, com testes.
- No celular os blocos são reordenados por urgência: Agora, Atenção, Próximos, Resumo, Semana, Ocupação.

## Fotos, galeria e agendamento (3 de outubro de 2026)

Fotos reais e textos:
- Fotos de demonstração reais (sem imagens geradas) em `public/demo/`: capa do salão, serviços, seis trabalhos (`work-1..6`) e profissionais. Textos de serviços e telas reescritos sem frases genéricas.

Envio de fotos no painel:
- `src/components/image-upload.tsx`: `ImageUpload` (uma foto, com prévia, trocar/remover, arrastar e soltar; funciona controlado ou com `name` para formulários com `FormData`) e `GalleryUpload` (várias fotos de uma vez, até 12, reordenar e remover).
- `src/lib/image.ts`: compressão no navegador (canvas para WebP, ou JPEG/PNG como alternativa) com presets por uso (capa 1600px, galeria 1200px, serviço 900px, profissional 480px, logo 512px). Uma foto de celular vira cerca de 100–250 KB.
- Usado em Configurações → Identidade (capa, logo, galeria "Cortes, trabalhos e ambiente" e seletor de cor), Serviços (foto do serviço no topo do formulário), Equipe (foto redonda do profissional) e no cadastro inicial (capa).
- As imagens continuam como data URL no registro (o servidor aceita `https://`, `/caminho` ou `data:image/(jpeg|png|webp);base64,`, até 3 MB cada). A migração para Supabase Storage segue pendente (item 5 abaixo).

Página do cliente:
- "Nossos trabalhos" em mosaico (`src/features/public/public-gallery.tsx`) com visualização em tela cheia: deslizar, setas do teclado, miniaturas e botão "Gostei, quero agendar". O banner do espaço saiu; a seção final virou "Horário e endereço".
- Fotos aparecem com fade ao carregar; a capa tem parallax ao rolar (scroll timeline, só em navegadores compatíveis e sem `prefers-reduced-motion`).

Agendamento:
- Cabeçalho fixo com a logo ou a capa do estabelecimento.
- Serviços com descrição, duração e preço; subtítulos das etapas mais úteis.
- No celular, a etapa de horário usa uma faixa de dias com a quantidade de horários livres ("18 livres", "Fechado", "Sem vagas"), com opção "Ver mês" para o calendário completo.
- Campos com ícones (WhatsApp real no telefone). Na confirmação, "Cancelar horário" virou uma ação discreta e o local mostra a foto do estabelecimento.

Painel:
- Sidebar e topo do celular mostram a foto do estabelecimento. Telefones formatados no detalhe do agendamento, na edição e em Configurações (salvo só com dígitos). Seletor "Atendimento / Bloquear horário" estilizado. Avatares usam `object-fit: cover`.

Verificado nesta rodada: lint, TypeScript, 30 testes, build, smoke HTTP, envio real de fotos (galeria, logo e serviço) até a página pública e varredura sem overflow horizontal em 14 rotas × 375/390/430/768/1024/1440px (mais a etapa de horário em 375/390/768/1024).

## Agendamento v2 e painel com mais movimento (3 de outubro de 2026)

- Produção: a Vercel publica o repositório `mh0097317-ai/studioflow` (branch `main`), que agora espelha esta pasta. Para publicar, copie os arquivos versionados desta pasta para lá e envie para `main`.
- Agendamento reconstruído como fluxo focado (`booking-chrome.tsx`, `booking-v2.css`): capa do estabelecimento no topo, cartão branco sobreposto, barra de progresso fina (4 etapas), avanço automático ao escolher serviço e profissional (pula o profissional quando só há um), chips das escolhas para editar, faixa de dias em todas as larguras e barra "Continuar" que só aparece com horário escolhido. Revisão final e recibo usam o ticket (`BookingTicket`).
- Painel: indicador que desliza no menu lateral, ondulação ao tocar (`PointerEffects` em `components/motion.tsx`), luz que segue o mouse nos cartões, relógio ao vivo no início, indicadores com cor própria, aurora no cartão "Agora", destaque lateral nas linhas da agenda e entrada em cascata nas telas de gestão.

## Agendamento igual à referência e avaliações reais (4 de outubro de 2026)

- Agendamento refeito seguindo `docs/reference/Foto-1.jpg`: cabeçalho branco com a marca do estabelecimento, etapas numeradas (Serviço, Profissional, Horário, Dados, Pronto), lista com seleção e barra "Continuar" com o serviço escolhido, calendário do mês com horários em Manhã/Tarde/Noite, "Quase pronto!" com resumo e confirmação com check, confete, logo do estabelecimento, localização e WhatsApp. Estilos em `src/features/booking/booking.css` (os CSS antigos do agendamento foram removidos).
- Avaliações reais: depois que o atendimento é marcado como concluído, o comprovante (`/booking/[token]`) pede de 1 a 5 estrelas e um comentário opcional. Uma avaliação por atendimento, via RPC `submit_review` (só `service_role`, migration `20261004120000_studioflow_reviews.sql`, aplicada no Supabase de produção). Membros leem pela RLS; a página pública recebe só médias (`src/lib/reviews.ts`). A nota aparece na capa da página, nos profissionais (agendamento e página) e no card "Avaliações dos clientes" do painel. Sem avaliações, nada de nota aparece.
- Página pública: frase, nota e "Aberto agora" sobre a capa; logo maior sem moldura.
- Painel: marca StudioFlow no topo do menu e cartão com a logo do estabelecimento e "Ver página pública" embaixo. Corrigida a saudação duplicada no topo do celular.

## Lembretes, divulgação, fidelidade e lista de espera (4 de outubro de 2026)

- Lembretes de amanhã (painel, início): lista de quem tem horário amanhã com botão "Lembrar" que abre o WhatsApp com a mensagem pronta (`src/features/dashboard/growth.ts`, `overview-growth.tsx`). O "Enviado" fica marcado só neste aparelho. Nenhum envio automático: o dono toca e envia.
- Agendar de novo: o cliente que já agendou vê um atalho com o último serviço e profissional na página e no início do agendamento (`src/lib/last-booking.ts`, `localStorage` por estabelecimento).
- Divulgar (`/dashboard/divulgar`): link, compartilhar, QR Code (`qrcode`), cartaz para imprimir em A4, imagem para Stories (canvas 1080x1920) e textos prontos para bio, status e mensagem.
- Cartão fidelidade: Configurações → Fidelidade (ligar, número de atendimentos e prêmio; `PATCH /api/workspace/loyalty`, RLS de `business_settings`). Carimbos = atendimentos concluídos (`src/lib/loyalty.ts`). Aparece no comprovante, na página pública, no perfil do cliente e no detalhe do agendamento ("Ganha o prêmio neste atendimento").
- Lista de espera: no agendamento, dias lotados ficam riscados e abrem o formulário; em dias com vaga há o link "Nenhum horário serve?". `POST /api/public/[slug]/waitlist` (validação no servidor, rate limit, service role). No painel, "Lista de espera" com "Chamar" (WhatsApp com link de agendamento, marca como avisado) e remover; dias com cancelamento aparecem primeiro com "Abriu vaga". Tabela `waitlist` com RLS: membros leem, só owner/admin/manager/recepção alteram status ou removem; profissional só lê.
- Migration `20261004150000_studioflow_loyalty_waitlist.sql`, aplicada no Supabase de produção. Testes: `tests/growth.test.ts` e `tests/waitlist-db.test.ts`.

## Visual "Cartaz" (4 de outubro de 2026)

- Três direções foram comparadas (Cartaz, Noir e Gráfico) com as telas reais; a escolhida foi Cartaz.
- Base: paleta trocada em todo o código (cores frias mapeadas para a escala papel/tinta/latão), fontes Fraunces + Hanken Grotesk, logo do StudioFlow em tinta, papel e latão (`public/icon.svg`, `brand.tsx` e PNGs do PWA regenerados), sem `PointerEffects` e sem o brilho de `.sf-sheen` (classe mantida, sem efeito).
- Página pública reescrita (`public-page.tsx`, `public-page.css`, `public-services.tsx`): capa só com a foto e o horário numa etiqueta, nome grande com serifa, ações em linha (WhatsApp / Localização / Instagram), cardápio numerado com preço, cartão fidelidade com moldura dupla, galeria (`public-gallery.css`), comodidades em texto, equipe em retratos, horários com pontilhado; no computador, cartão de agendamento fixo à direita.
- Agendamento e comprovante: camada "Cartaz" no fim de `booking.css` (linhas de cardápio, abas sublinhadas, títulos com serifa).
- Painel: menu em tinta com destaque discreto, cartões em papel, números com serifa, indicadores sem quadradinhos, gráficos em tinta e latão (camada no fim de `overview.css`); Divulgar com cartaz em papel e moldura dupla (também na imagem para Stories).
- Verificado: lint, TypeScript, 36 testes, smoke HTTP, build e varredura sem overflow horizontal em 15 rotas × 375/390/430/768/1024/1440px; contraste de texto ≥ 4,5:1 nas cores de texto.

## Animações do agendamento (4 de outubro de 2026)

- Abertura (`booking-intro.tsx`): ao abrir o agendamento, a logo do estabelecimento (ou monograma com as iniciais, `monogram()` em `lib/utils.ts`) aparece no papel, uma linha latão se desenha, o nome surge e o papel sobe como cortina revelando a etapa. Uma vez por visita (`sessionStorage` `studioflow:intro:<slug>`), toque para pular, nunca com movimento reduzido. Enquanto o catálogo carrega, `BookingLoader` mostra uma linha latão correndo.
- Fases: títulos sobem palavra por palavra (`StepHead`), checks se desenham (`draw-check.tsx`) no indicador de etapas e nas opções, a faixa de seleção desliza da esquerda, os meses do calendário deslizam na direção escolhida.
- Confirmação: carimbo (`confirm-stamp.tsx`) com a logo/monograma no centro e o status escrito em volta ("Horário confirmado · Nome ·"), batido com tinta só em agendamento recém-criado; substitui o check com confete.
- Página pública: a capa assenta com leve zoom, a etiqueta de horário entra pela esquerda e o nome é revelado de baixo para cima.
- Tudo respeita `prefers-reduced-motion`.
- Abertura ao tocar em "Agendar" (5/10): qualquer link da página para `/[slug]/agendar` cobre a tela na hora com o papel subindo (`startHandoff` em `src/features/booking/intro-handoff.tsx`); a camada fica em `src/app/[slug]/layout.tsx`, então continua na troca de rota e só sobe quando o agendamento está pronto (mínimo 1,15 s, máximo 9 s). A página pública foi para o grupo `src/app/[slug]/(home)` para o esqueleto dela não aparecer no caminho, e o catálogo fica em memória entre a página e o agendamento (`usePublicData`).
- Velocidade e abertura (5/10): as funções da Vercel rodam em São Paulo (`"regions": ["gru1"]` em `vercel.json`, mesma região do Supabase `sa-east-1`; antes rodavam em `iad1` e cada consulta cruzava o continente). A página da barbearia e o agendamento chegam com o catálogo renderizado no servidor (`src/services/public-catalog.ts`, também usado por `/api/public/[slug]`, que agora tem cache de 15 s na CDN). No agendamento, o servidor desenha só a abertura e as etapas montam no navegador (leem o aparelho), sem erro de hidratação. Abertura nova: cantos de cartaz, anéis do monograma desenhados, linha latão e o nome letra por letra; com "reduzir movimento" ligado no aparelho, aparece e some só com esmaecimento (antes ficava escondida). O "aparecer ao rolar" só começa depois que a página hidrata.

## Pagamentos: sinal via Pix e Clube de assinatura (4 de outubro de 2026)

Cada estabelecimento conecta a **própria conta Asaas**; o dinheiro cai direto com o dono e o StudioFlow nunca recebe, segura ou repassa valores.

- Conexão: Configurações → Pagamentos (`payment-settings.tsx`, `POST/PATCH/DELETE /api/workspace/payments`). A chave de API é conferida no Asaas, guardada cifrada (AES-256-GCM, `src/services/server-secrets.ts`) na tabela `payment_accounts`, que só o servidor lê (RLS sem políticas, sem grant para `authenticated`). A chave de cifra é `PAYMENTS_ENCRYPTION_KEY` (32 bytes em base64) ou, sem ela, derivada da chave secreta do Supabase; trocar a origem exige reconectar as contas. Ao conectar, o webhook do Asaas é criado com um token aleatório (só o hash fica no banco) para `/api/payments/asaas/[businessId]`, conferido pelo cabeçalho `asaas-access-token`.
- Cliente Asaas: `src/services/payments/asaas.ts` (clientes por CPF, cobrança Pix, QR Code, assinatura mensal com `billingType UNDEFINED`, webhooks). O CPF vai só para o Asaas e não é salvo no StudioFlow.
- Sinal: modo sem sinal / valor fixo / percentual e prazo em minutos (`deposit_mode`, `deposit_value`, `deposit_hold`). Mínimo de R$ 5 (regra em `src/lib/payments.ts`). No agendamento aparece o campo CPF e o botão "Reservar e pagar"; a reserva fica `pending` com prazo (`hold_for_deposit`), o comprovante mostra QR Code, copia e cola e contagem (`deposit-panel.tsx`, `GET /api/booking/[token]/deposit`). Confirmação pelo webhook ou, se ele falhar, consultando o Asaas (`confirm_deposit`, idempotente). Reserva vencida libera o horário (`private.expire_holds`, chamada sob o lock em `book_appointment`, `manage_booking` e antes das mutações do painel). Pix pago depois do prazo volta a confirmar se o horário estiver livre; senão fica cancelado com aviso de devolução no painel. O sinal entra uma vez no financeiro como pagamento Pix (`payments.provider_charge_id`).
- Clube: planos com mensalidade, serviços inclusos e limite por mês (`membership_plans`), assinaturas (`memberships`, token do aparelho só como hash). Página do dono `/dashboard/clube` (planos, assinantes, receita mensal, "Enviar acesso" pelo WhatsApp que gera um link novo, cancelamento que encerra a assinatura no Asaas). Página do cliente `/[slug]/clube` (escolher plano, assinar, pagar a fatura do Asaas, "Já paguei, conferir"). No agendamento, quem assina vê "Incluso no clube" e o servidor aplica `apply_membership` (assinatura ativa, mesmo WhatsApp, serviços do plano, limite do mês no calendário de São Paulo); preço zerado também no histórico de serviços. A página pública ganha um quadro com os planos.
- Demonstração: "Ativar pagamento simulado" e botões "Simular pagamento" (`POST /api/demo/charges/[id]`, bloqueado fora da demonstração).
- Migration `20261005120000_studioflow_payments.sql`. Testes: `tests/payments.test.ts` e `tests/payments-db.test.ts`; o smoke agora também garante que o catálogo público não traz conta de pagamento nem assinaturas.
- Para testar com dinheiro de verdade fora da demonstração: crie uma conta no Asaas (ou no sandbox, `https://sandbox.asaas.com`), gere a chave em Integrações e cole em Configurações → Pagamentos escolhendo o ambiente certo.
- Pendências: renovação automática no cartão (hoje cada mensalidade é paga pela fatura, com Pix, boleto ou cartão), devolução do sinal pelo próprio painel e lembrete automático da mensalidade.

## Agendamento mais gostoso de usar (4 de outubro de 2026)

- Vários serviços no mesmo horário: na etapa 1 cada serviço tem caixa de seleção (ordem 1º, 2º…), até 8, só combinações que alguém da equipe faz junto (senão aparece o aviso). Tempo e valor somam na barra, no resumo, no sinal e no clube; disponibilidade usa a duração total (`serviceId=a,b` nas APIs públicas, que já aceitavam a lista). "Agendar de novo" e o link do comprovante repetem a combinação.
- "Mais pedido": serviço mais agendado nos últimos 90 dias (mínimo de 3 e à frente do segundo), calculado no servidor (`popularServiceId` no catálogo público), na etapa 1 e no cardápio da página.
- Atalho "Primeiro horário livre" no topo da etapa de horário; o horário escolhido mostra até quando vai.
- Interações (`src/features/booking/motion.tsx`): a foto do serviço voa até a barra ao somar, fotos empilhadas com contador, total que rola até o novo valor, botão "Continuar" dá um toque quando o horário é escolhido, arrastar para a direita volta uma etapa (o toque na borda continua do sistema e o navegador não sai da página), aviso com leve tremida quando não dá para combinar.
- Dados: o título cumprimenta pelo primeiro nome ("Quase pronto, Ana!"), o nome é ajustado para maiúsculas ("ana paula dos santos" → "Ana Paula dos Santos") e cada campo válido ganha um check.
- Comprovante: contagem até o horário ("Faltam 2 dias 4 horas") e "Compartilhar" (quando o aparelho permite).
- Correções: faixa do item escolhido ocupa a linha inteira, campo em foco sem caixa interna, sem degradê no hover das linhas.

## Transição com barbeiro de verdade (4 de outubro de 2026)

- Na primeira ida à etapa de Horário em cada visita, uma cena curta (2,6 s) com vídeo real de um barbeiro passando a máquina na nuca, faixas pretas de cinema, legenda "Separando a sua cadeira" com o nome do estabelecimento e uma linha latão; depois a cena sobe como cortina e revela o calendário (`src/features/booking/barber-cut.tsx`, estilos no fim de `booking.css`). Toque para pular, nunca com movimento reduzido, uma vez por visita (`sessionStorage` `studioflow:cut:<slug>`), vídeo pré-carregado nas etapas anteriores. No celular o vídeo ocupa uma faixa 4:5 e a legenda vai na barra de baixo.
- Arquivos: `public/media/barber-cut.mp4` (167 KB), `.webm` (133 KB) e `.jpg` (pôster). Origem: Mixkit, vídeo 47845 ("Close up of a trimmer shaving a man's hair"), Mixkit Stock Video Free License (uso comercial, sem atribuição obrigatória).

## Recepcionista com IA (4 de outubro de 2026)

- Atendente virtual (Claude, `claude-opus-5-5`, esforço baixo, fallback automático do servidor ligado) que responde no chat da página pública e no WhatsApp oficial do estabelecimento: tira dúvidas de serviços, preços, horários e regras, consulta horários livres e marca usando as mesmas rotinas do agendamento público (`bookWithPayments`: sinal via Pix, clube e checagens do banco continuam valendo). Cancelar e remarcar seguem pelo link do comprovante ou com a equipe.
- Cérebro: `src/services/assistant/agent.ts` (prompt montado do catálogo, sem dados de outros clientes; ferramentas `horarios_livres`, `proximos_horarios`, `agendar`, `chamar_humano`; laço manual com no máximo 6 passos; histórico só acrescentado). O telefone no WhatsApp vem da Meta, não da IA.
- Conversas: `src/services/assistant/conversations.ts` (uma resposta por vez por conversa com trava `conversation_lease`, mensagens novas tratadas na rodada seguinte, passa para a equipe quando a IA pede, quando falta a chave, quando acaba o limite diário ou quando a conversa fica longa). Tabelas `conversations`, `conversation_messages`, `assistant_usage`, `whatsapp_accounts` (migration `20261006120000_studioflow_assistant.sql`).
- Página: botão "Tirar dúvidas e agendar" e chat (`src/features/public/assistant-chat.tsx`), `POST/GET /api/public/[slug]/chat`.
- Painel: Conversas (`/dashboard/conversas`) com assumir, responder, devolver para a atendente e encerrar; Configurações → Recepcionista (ligar, nome, instruções da casa, teto diário de respostas, conexão do WhatsApp).
- WhatsApp oficial (Cloud API da Meta): o dono cola ID do número, token permanente e chave secreta do app (guardados cifrados); o painel mostra a URL do webhook `/api/whatsapp/[businessId]` e o token de verificação (só o hash fica no banco). Entregas conferidas pela assinatura `X-Hub-Signature-256`, sem duplicar mensagem (`provider_message_id`), resposta da IA depois do 200 com `after()`.
- Para ligar em produção: definir `ANTHROPIC_API_KEY` nas variáveis do projeto na Vercel. Sem ela, as mensagens chegam em Conversas e a equipe responde.
- Testes: `tests/assistant.test.ts` (laço com modelo simulado), `tests/assistant-flow.test.ts`, `tests/assistant-db.test.ts`, `tests/whatsapp.test.ts`.

## Plataforma, produtos, recepção e Instagram (4 de outubro de 2026)

- Painel da plataforma (`/admin`, só para quem está em `platform_admins`): lista os estabelecimentos com dono, e-mail, uso e situação; libera por dias (somam ao prazo que resta), até uma data ou sem prazo, pausa, volta para aguardando, anotação interna e histórico (`platform_access`, `platform_access_events`, RPCs `platform_set_access` e `platform_overview`, migration `20261007120000_studioflow_platform.sql`). Cadastro novo entra como **aguardando**; quem já existia ficou liberado sem prazo. Sem acesso liberado e dentro do prazo, o servidor fecha painel e APIs do painel (423 com o motivo), agenda online, chat, clube, lista de espera, check-in e WhatsApp/Instagram (`src/lib/access.ts`, `requireMembership`, `getPublicStore`). O dono vê a tela "Seu painel está quase pronto", que abre sozinha quando liberado (`access-gate.tsx`), e um aviso nos últimos 5 dias. Botão "Falar com o StudioFlow" aparece com `NEXT_PUBLIC_STUDIOFLOW_WHATSAPP`. Na demonstração o acesso fica no arquivo e qualquer um abre `/admin`.
- Produtos (`/dashboard/produtos`): foto, preço, custo, estoque e alerta de mínimo; venda no balcão ou no atendimento ("Vender produto" no detalhe), baixa de estoque atômica (`sell_products`), cancelamento devolve ao estoque (`cancel_product_sale`); entra no Financeiro (total do caixa, formas de pagamento e "Produtos vendidos") e aparece na página como "Na casa você encontra" (sem custo nem estoque). Migration `20261008120000_studioflow_products.sql`.
- Check-in por QR Code (`/[slug]/checkin`): o cliente avisa que chegou pelo comprovante salvo no aparelho (um toque) ou pelo WhatsApp; vale de 3 horas antes até o fim do atendimento (`check_in_by_token`, `check_in_by_phone`, coluna `appointments.checked_in_at`, migration `20261008130000_studioflow_checkin.sql`). "Cheguei" no comprovante, etiqueta "Chegou" no início, agenda e detalhe, cartaz de check-in em Divulgar.
- Modo TV (`/tv`, com login): relógio, atendendo agora e próximo de cada profissional, próximos horários com nome abreviado, chegadas com aviso grande, QR Codes de check-in e de agendamento, fotos/produtos/clube/fidelidade em rodízio; atualiza a cada 20 s e mantém a tela acesa.
- Story das vagas (Divulgar): imagem 1080x1920 com os horários livres reais de hoje ou amanhã do serviço escolhido, para compartilhar ou baixar.
- Recepcionista: áudios do WhatsApp e do Instagram viram texto com `TRANSCRIBE_API_KEY` (serviço compatível com `/audio/transcriptions`; sem chave a atendente pede texto). Instagram Direct (Configurações → Recepcionista): token da conta profissional e chave do app, cifrados; webhook `/api/instagram/[businessId]` com assinatura `X-Hub-Signature-256`; a IA pede o WhatsApp para marcar e a equipe responde em Conversas (janela de 24 h). Migration `20261008140000_studioflow_instagram.sql`.
- Testes novos: `access`, `platform-db`, `products-db`, `checkin-db`, `instagram`, `migrations-chain` (aplica todas as migrations em sequência).

## Planos e módulos por cliente (5 de outubro de 2026)

- Em `/admin` → Gerenciar, a equipe escolhe o plano (Essencial, Profissional ou Premium, ou módulo a módulo), o nome do plano e a mensalidade. O topo mostra a receita mensal combinada dos clientes ativos.
- Módulos (`src/lib/modules.ts`): `pagamentos` (sinal Pix), `clube`, `recepcionista` (chat, WhatsApp, Instagram, Conversas), `produtos`, `recepcao` (check-in e Modo TV), `fidelidade`, `espera`. Sempre inclusos: página e agendamento, agenda, clientes, serviços, equipe, financeiro, relatórios e divulgação. Essencial = fidelidade + lista de espera; Profissional = + sinal, clube, produtos, check-in/TV; Premium = tudo.
- Módulo fora do plano: some do menu e das Configurações, a página mostra "não está no seu plano" com botão para pedir, as APIs do painel recusam (403, `requireModule`) e o público não vê nem usa (`applyModules` em `getPublicStore`: sem sinal, sem clube, sem atendente, sem produtos, sem lista de espera, sem check-in). As configurações guardadas não são apagadas: religar o módulo traz tudo de volta. `modules` nulo = todos (quem já usava).
- Configurações → Plano mostra ao dono o plano, o prazo e os módulos incluídos.
- Migration `20261009120000_studioflow_modules.sql` (colunas `modules`, `plan`, `monthly_price` e RPC `platform_set_plan`). Testes: `modules.test.ts`, `migrations-chain` e o smoke.

## Fotos dos serviços, mapa e Instagram (5 de outubro de 2026)

- Até 3 fotos por serviço (`services.image` + `services.photos` com até mais duas). No painel, Serviços → editar usa a galeria com reordenar (a primeira é a principal). No agendamento e no painel a foto troca ao passar o mouse ou deslizar o dedo (`src/components/photo-scrub.tsx`); no cardápio da página aparece uma pilha de fotos que abre em tela cheia.
- Localização: "Localização" abre "Como chegar" dentro da página (mapa do Google, copiar endereço, rota no Google Maps e no Waze). Link opcional do perfil no Google Maps em Configurações → Empresa (`businesses.maps_url`, só domínios do Google).
- Instagram: "Instagram" abre o perfil com seguidores e os 12 posts mais recentes pela API oficial (`/api/public/[slug]/instagram`, cache de 15 minutos, token cifrado em `instagram_feeds` ou o da Recepcionista). Sem conta ligada, mostra o @ e as fotos da casa. Conexão em Configurações → Empresa → Posts do Instagram na página.
- Migration `20261010120000_studioflow_photos_instagram.sql`. Teste: `tests/photos-instagram.test.ts`.

## WhatsApp por QR Code e aviso ao profissional (5 de outubro de 2026)

- Evolution API (v2) do StudioFlow: um servidor só (`EVOLUTION_API_URL`, `EVOLUTION_API_KEY`), uma instância por loja (`sf-<businessId>`). Em Configurações → WhatsApp a loja toca em "Conectar com QR Code", lê o código no celular (Aparelhos conectados) e o painel confere a cada 3 s até conectar; o código se renova sozinho. Tabela `whatsapp_links` (só servidor; hash do token do webhook), cliente em `src/services/whatsapp/evolution.ts`, conexão em `link.ts`, webhook `/api/evolution/[businessId]?token=` (token novo a cada conexão).
- Mensagens que chegam por esse número entram em Conversas e a recepcionista responde por ele (mesmo fluxo do WhatsApp oficial: `receiveWhatsAppMessages`, áudio transcrito). A equipe responde em Conversas pelo número da loja (`shopSender`: QR Code primeiro, depois a API oficial da Meta se existir).
- A recepcionista agora manda o link de agendamento por padrão (ferramenta `link_agendamento`, já com serviço e profissional) e continua tirando dúvidas; ainda marca pela conversa se o cliente preferir.
- Aviso ao profissional: quando o cliente agenda (página ou recepcionista), quem vai atender recebe pelo WhatsApp da loja nome, dia, horário, serviços, valor, se é a primeira vez, sinal pendente e o link da agenda do dia (`src/services/whatsapp/notify.ts`, depois da resposta com `after()`). Liga/desliga em Configurações → WhatsApp (`business_settings.notify_professionals`). Na demonstração a conexão é simulada e os avisos aparecem como balões na mesma tela.
- Migration `20261010130000_studioflow_whatsapp_links.sql`. Teste: `tests/whatsapp-link.test.ts`.

## Mensalidade do StudioFlow com liberação automática (5 de outubro de 2026)

- Conta Asaas da própria plataforma (`STUDIOFLOW_ASAAS_API_KEY`, `STUDIOFLOW_ASAAS_ENV`). Com plano e mensalidade definidos em `/admin`, o dono vê "Pagar agora" no aviso de vencimento (últimos 5 dias), "Pagar mensalidade" na tela de acesso encerrado e em Configurações → Plano (com o histórico). A fatura é do Asaas (Pix, boleto ou cartão, `billingType UNDEFINED`), uma em aberto por loja (`platform_invoices`); pede CPF/CNPJ na primeira vez e guarda em `businesses.cnpj`.
- Pagou → `platform_invoice_paid` marca a fatura e soma 30 dias ao acesso (do fim do prazo, ou de agora se já venceu), uma vez só, com o evento "Pagou a mensalidade" no histórico. Chega pelo webhook `/api/billing/asaas` (cabeçalho `asaas-access-token` = `STUDIOFLOW_ASAAS_WEBHOOK_TOKEN`) ou pelo botão "Já paguei, conferir" (o painel também confere sozinho a cada 10 s). Acesso sem prazo não é cobrado.
- Lembretes no WhatsApp: Vercel Cron diário (`vercel.json`, 9h de Brasília) chama `/api/cron/billing` com `CRON_SECRET`; manda 3 dias antes, no último dia e depois de vencer (até 7 dias), uma vez por vencimento (`platform_billing_notices`), com o link da fatura ou do painel. Saem pelo WhatsApp do próprio StudioFlow, conectado com QR Code no topo de `/admin` (instância `EVOLUTION_PLATFORM_INSTANCE`, padrão `sf-studioflow`).
- Migration `20261010140000_studioflow_billing.sql`. Teste: `tests/billing.test.ts`.

## Cadastro completo da loja (5 de outubro de 2026)

- O cadastro (`/onboarding`) agora tem 6 etapas e a página já nasce completa: Negócio; Contato (nome, frase, WhatsApp e endereço obrigatórios, Instagram); Identidade (capa obrigatória, logo, cor dos botões, até 12 fotos dos trabalhos e comodidades); Serviços com foto e descrição; Equipe com foto e WhatsApp (para os avisos de agendamento); Horários. A prévia ao lado mostra "Sua página está X% pronta".
- O servidor continua criando com `create_workspace` e completa em seguida o que a RPC não recebe (contato, identidade, fotos dos serviços, foto e WhatsApp da equipe) em `completeWorkspace` (`src/app/api/onboarding/route.ts`); os campos novos do `onboardingSchema` são opcionais no servidor para não quebrar integrações antigas.

- "Complete sua página" (5/10): no Início do painel, dono e gerência veem o que falta na página pública (WhatsApp, endereço, Instagram, frase, capa, logo, fotos dos trabalhos, fotos dos serviços), com a porcentagem pronta e link direto para o campo (`src/features/dashboard/page-checklist.tsx`). Configurações abre na aba pedida por `?aba=` (ex.: `?aba=identity`). Lojas criadas antes do cadastro completo (como a Coliseu) não mostram Localização/WhatsApp/Instagram até esses dados serem preenchidos.

## Próximos passos para terminar o piloto

1. ~~Corrigir a divergência de permissões~~ (feito em 3/10).
2. Escolher Supabase dedicado, revisar/aplicar a migration e configurar URL do app, callback de Auth e SMTP. Validar contas e sessões reais.
3. Implementar convites e seleção de empresa usando os vínculos existentes.
4. Validar remotamente isolamento entre empresas, concorrência, permissões e pagamentos.
5. Migrar imagens para Supabase Storage; hoje são URLs ou imagens de até 2 MB no registro. As fotos de demonstração já são locais (`public/demo/`).
6. Adicionar consultas paginadas e rate limit com armazenamento compartilhado para múltiplos servidores.
7. Testar teclado virtual, instalação, navegação e PWA em celulares físicos com HTTPS.
8. Revisar backups, retenção, logs e proteção contra abuso antes do piloto.
9. Cobrança dos clientes (sinal e clube) via Asaas do próprio estabelecimento está feita; falta WhatsApp automático e a cobrança da assinatura do StudioFlow.

Comissões usam o percentual atual do profissional e são estimativas. Repasse e histórico de percentuais exigem evolução própria. Os horários seguem `America/Sao_Paulo`; outros fusos precisam de evolução conjunta no cadastro, disponibilidade, RPC e calendário.

## Conteúdo e integridade do ZIP

O pacote inclui código, configurações, lockfile, SQL, testes, fonte local com licença, ícones, documentação, snapshot fictício, capturas e referência original. Exclui `node_modules`, `.next`, caches, logs, processos do preview e arquivos de credenciais. Instale as dependências com `npm ci` no novo ambiente.

`MANIFESTO-PACOTE.json` lista os arquivos e seus hashes SHA-256. O arquivo ZIP foi aberto e cada entrada foi conferida contra os bytes de origem após a criação.

## Prompt sugerido para a próxima IA

“Leia CONTINUE-AQUI.md, README.md, AGENTS.md e a documentação do banco. Faça uma auditoria curta da aplicação existente e continue as pendências do piloto de produção, começando pelo alinhamento das permissões e pela conexão real ao Supabase. Preserve o redesign e as proteções de isolamento, concorrência e pagamentos. Execute os checks adequados, registre as verificações efetivamente feitas e não apresente integrações pendentes como concluídas.”
