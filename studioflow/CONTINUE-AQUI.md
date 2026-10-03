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

Next.js 16.3.8/App Router, React 19.3.0, TypeScript 6, Tailwind CSS 4, Geist local, Lucide, Supabase Auth/SSR, PostgreSQL, React Hook Form, Zod e date-fns. Preserve o lockfile. Os scripts usam Webpack após lentidão observada no Turbopack deste Windows.

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

O redesign editorial foi aplicado aos módulos. A interface usa branco predominante, navy e azul profundo em ações e seleções, fotografia contextual, Geist local, indicadores compactos e composições próprias. No celular, há navegação inferior e destaque para o atendimento prioritário. O calendário mobile usa datas semanais e lista por períodos.

A referência original está em `docs/reference/Foto-1.jpg`. Capturas reais da interface estão em `.data/editorial-*.jpg`; as 72 medidas responsivas ficam em `.data/editorial-responsive.json`. Leia `README.md`, `docs/redesign-validation.md` e `supabase/README.md` antes de propor mudanças.

## Direção visual e escopo aprovados

- Branco `#FFFFFF` e `#F8FAFC`, texto `#111827`, apoio `#64748B`, bordas suaves e sombras mínimas.
- Navy/azul profundo na sidebar, seleções e ações: `linear-gradient(135deg, #07111F 0%, #0D2847 55%, #123E69 100%)`.
- Títulos expressivos, espaço em branco, alinhamento preciso, cards de 12–18px e transições de 150–250ms com movimento reduzido.
- Fotografia como identidade principal do estabelecimento; logo pequena e opcional, com fallback elegante.
- Agendamento em cinco etapas separadas; preservar escolhas e dados ao voltar ou recuperar um conflito.
- Agenda com duração proporcional, expediente, pausas e bloqueios. Criação e reagendamento têm confirmação explícita.
- Indicadores e rankings derivados dos dados e do período escolhido. Não inventar avaliações, crescimento ou disponibilidade.
- Não criar ERP, landing page institucional como foco, IA complexa, envio de WhatsApp simulado ou cobrança fictícia.
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
- Ícones: `@phosphor-icons/react` (duotone/fill) na página pública, agendamento, navegação e indicadores; logos reais de WhatsApp, Instagram e mapa em `src/components/brand-icons.tsx`. Telas administrativas secundárias ainda usam Lucide.
- Animações: `src/styles/motion.css` (easing, keyframes, `.sf-stagger`, `.sf-sheen`, `.sf-press`) e `src/components/motion.tsx` (`MotionProvider` para `[data-reveal]` ao rolar e `CountUp`). Tudo respeita `prefers-reduced-motion`; o conteúdo só é escondido para revelar depois que o JS marca a página como `motion-ready`.
- Confirmação com check desenhado, onda e confete apenas para agendamentos criados há menos de 10 minutos.
- Não rode `npm run build` com o `npm run dev` ativo: os dois usam `.next` e o dev passa a falhar com "Manifest file is empty".

## Próximos passos para terminar o piloto

1. ~~Corrigir a divergência de permissões~~ (feito em 3/10).
2. Escolher Supabase dedicado, revisar/aplicar a migration e configurar URL do app, callback de Auth e SMTP. Validar contas e sessões reais.
3. Implementar convites e seleção de empresa usando os vínculos existentes.
4. Validar remotamente isolamento entre empresas, concorrência, permissões e pagamentos.
5. Migrar imagens para Supabase Storage; hoje são URLs ou imagens de até 2 MB no registro. As fotos de demonstração já são locais (`public/demo/`).
6. Adicionar consultas paginadas e rate limit com armazenamento compartilhado para múltiplos servidores.
7. Testar teclado virtual, instalação, navegação e PWA em celulares físicos com HTTPS.
8. Revisar backups, retenção, logs e proteção contra abuso antes do piloto.
9. Planejar cobrança e WhatsApp automático posteriormente; hoje existem consentimento e links de contato, sem integrações comerciais conectadas.

Comissões usam o percentual atual do profissional e são estimativas. Repasse e histórico de percentuais exigem evolução própria. Os horários seguem `America/Sao_Paulo`; outros fusos precisam de evolução conjunta no cadastro, disponibilidade, RPC e calendário.

## Conteúdo e integridade do ZIP

O pacote inclui código, configurações, lockfile, SQL, testes, fonte local com licença, ícones, documentação, snapshot fictício, capturas e referência original. Exclui `node_modules`, `.next`, caches, logs, processos do preview e arquivos de credenciais. Instale as dependências com `npm ci` no novo ambiente.

`MANIFESTO-PACOTE.json` lista os arquivos e seus hashes SHA-256. O arquivo ZIP foi aberto e cada entrada foi conferida contra os bytes de origem após a criação.

## Prompt sugerido para a próxima IA

“Leia CONTINUE-AQUI.md, README.md, AGENTS.md e a documentação do banco. Faça uma auditoria curta da aplicação existente e continue as pendências do piloto de produção, começando pelo alinhamento das permissões e pela conexão real ao Supabase. Preserve o redesign e as proteções de isolamento, concorrência e pagamentos. Execute os checks adequados, registre as verificações efetivamente feitas e não apresente integrações pendentes como concluídas.”
