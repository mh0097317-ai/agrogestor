# StudioFlow

> Importado do pacote do Codex (2 out 2026) para a pasta `studioflow/` do repositório agrogestor. Rode os comandos abaixo dentro de `studioflow/`. As capturas do visual recebido ficaram em `docs/capturas-antes/`.

Produto de agenda e gestão para negócios de beleza, com página pública por estabelecimento e painel separado. Projeto criado em `C:\Nova pasta\studioflow`; VendeAI, AgroGestor e os demais projetos existentes foram preservados.

## Executar localmente

Requer Node.js 22 ou 24 e npm. As versões das dependências estão fixadas e o lockfile está incluído.

```powershell
cd 'C:\Nova pasta\studioflow'
npm ci
npm run dev
```

Sem credenciais Supabase, o ambiente de desenvolvimento usa dados fictícios centralizados em `src/lib/seed.ts`. As alterações são persistidas por estabelecimento em `.data/`, com confirmação serializada no servidor. Esse modo não usa autenticação real e fica desabilitado em produção.

- Painel: http://localhost:3000/dashboard
- Experiência do cliente: http://localhost:3000/barber-011
- Agendamento: http://localhost:3000/barber-011/agendar
- Conta: http://localhost:3000/login
- Cadastro do estabelecimento: http://localhost:3000/onboarding

`npm run build` e `npm start` executam o modo de produção: é necessário configurar Supabase para acessar dados e contas reais. O compilador Webpack foi escolhido após a lentidão do Turbopack observada neste Windows. A fonte Geist é hospedada localmente, com licença incluída em `src/app/fonts/OFL.txt`.

## Implementado

| Área | Comportamento |
| --- | --- |
| Página pública | Capa, identidade opcional, fallback por segmento, serviços, equipe, comodidades, horários, mapa e contatos |
| Agendamento | Cinco etapas, escolhas preservadas, profissional automático, datas disponíveis, validação brasileira e confirmação por token |
| Gestão de reserva | Comprovante, arquivo de calendário, reagendamento e cancelamento conforme a política |
| Painel | Indicadores derivados dos dados, agenda diária, calendário, resumo e link compartilhável |
| Agenda | Dia, semana e mês, filtros, criação, edição, status e bloqueios; lista e horários livres específicos para mobile |
| CRM | Busca, filtros, perfil, histórico, métricas e sinal de retorno atrasado |
| Serviços/equipe | CRUD, arquivamento com histórico, vínculos de serviços, expediente, intervalos, dias de trabalho e comissão |
| Financeiro | Pagamentos parciais, saldo validado no servidor, métodos, indicadores e estimativa de comissões |
| Relatórios | Indicadores por período e exportação CSV com proteção contra fórmulas |
| Configurações | Empresa, identidade, agenda, notificações e informações do plano |
| Onboarding | Segmento, nome/capa, serviços, profissionais, expediente e link público |
| PWA | Manifest, ícones PNG, metadados, theme-color, tela offline e service worker sem cache de dados privados |

No celular, o painel usa navegação inferior com criação rápida. O início apresenta o atendimento prioritário antes da lista; a agenda diária tem faixa semanal, lista por períodos e contagens mensais. O redesign editorial usa Geist local, branco predominante, navegação navy, indicadores compactos e painéis de detalhes acessíveis.

Início, Agenda, Página pública, calendário de agendamento, onboarding, acesso, Clientes, Serviços, Equipe, Financeiro, Relatórios e Configurações foram inspecionados no navegador em 375, 390, 430, 768, 1024 e 1440px, sem overflow horizontal nas verificações finais. Capturas desktop/mobile estão em `.data/editorial-*.jpg`; as 72 medidas DOM estão em `.data/editorial-responsive.json`. O painel de atendimento foi verificado com foco contido, Escape e retorno de foco. O onboarding preservou o nome ao voltar; Configurações preservou o rascunho entre seções e confirmou o descarte e a saída pelo menu. Teclado virtual e instalação PWA em dispositivo físico continuam pendentes.

O redesign passou em lint, TypeScript, 24 testes automatizados e build de produção. O fluxo de reserva foi executado no navegador em empresa de teste, incluindo recuperação de conflito, dados preservados, confirmação, reagendamento e cancelamento. Veja o [registro de validação e diagnóstico do preview](docs/redesign-validation.md).

## Organização

```text
src/app/                 Rotas App Router, APIs, Auth, PWA
src/components/          Controles, modal acessível, calendário e feedback
src/features/            Agenda, painel, público, booking e módulos de gestão
src/hooks/               Estado do workspace e atualização após mutações
src/lib/                 Seeds, datas, disponibilidade e clientes Supabase
src/services/            Validações e acesso a dados exclusivo do servidor
src/types/               Contratos compartilhados
supabase/                Migration, seed SQL e documentação do banco
tests/                   Domínio, concorrência, PostgreSQL, RLS e datas
scripts/                 Smoke test HTTP e geração de seed
```

## Supabase e segurança

Copie `.env.example` para `.env.local` e preencha as credenciais do projeto dedicado. A chave secreta deve ficar somente no servidor. Veja [instruções completas do banco](supabase/README.md).

A migration cria 17 tabelas com UUID, timestamps, índices, RLS e chaves estrangeiras compostas por estabelecimento. O servidor verifica o usuário e seu vínculo com a empresa. As APIs públicas retornam projeções explícitas, sem clientes ou financeiro. Confirmações usam uma transação com advisory lock, verificação do intervalo inteiro e exclusion constraint PostgreSQL. Os tokens públicos têm 256 bits e apenas o hash fica no banco.

O fluxo SSR segue a [documentação oficial de Auth Supabase](https://supabase.com/docs/guides/auth/server-side/creating-a-client?framework=nextjs). Nenhum projeto Supabase remoto foi modificado: a escolha do projeto dedicado está pendente. A migration e as RPCs foram executadas nos testes usando PostgreSQL/PGlite, não um substituto de SQL.

## Verificar

```powershell
npm run lint
npm run typecheck
npm test
npm run build
```

Com o servidor de desenvolvimento em execução:

```powershell
npm run test:smoke
```

O smoke test cria e remove apenas seu próprio estabelecimento fictício `StudioFlow QA`, sem alterar a BARBER 011. Ele valida onboarding, projeção pública, isolamento, duas reservas simultâneas, comprovante, edição de serviço, início/conclusão do atendimento, pagamentos parciais, rejeição de pagamento excedente, reagendamento e cancelamento. `npm test` executa também RLS e as RPCs com os papéis reais `authenticated`, `anon` e `service_role`.

Para regenerar o SQL de demonstração a partir da única fonte de dados:

```powershell
npm run db:seed:generate
```

## Pendências para operação comercial

- Escolher e conectar o projeto Supabase; aplicar migration e configurar URLs de Auth/SMTP. As contas reais não foram testadas contra um projeto remoto.
- Validar teclado virtual e instalação em dispositivo físico. Instalação PWA em produção requer HTTPS; Android oferece instalação no navegador e iPhone usa Compartilhar → Adicionar à Tela de Início.
- Conectar um provedor para envio automático de WhatsApp. Atualmente o consentimento é salvo e os botões de contato abrem o WhatsApp, sem envio simulado.
- Conectar cobrança e limites comerciais dos planos, se necessários. Não há cobrança fictícia.
- Evoluir uploads atuais (URL ou imagem até 2 MB salva no registro) para Supabase Storage; adicionar paginação para volumes acima do limite de retorno do Data API.
- Usar armazenamento compartilhado para o rate limit em múltiplos servidores. A estimativa de comissão usa o percentual atual do profissional; o repasse e snapshots históricos exigem evolução específica.

As duas últimas evoluções não substituem as proteções já implementadas de RLS e de concorrência. A lista registra os limites concretos desta versão, para que a conexão à produção seja revisável.
