# 🌱 Agrogestor

Plataforma SaaS de gestão rural — do talhão ao resultado. Controle de fazendas,
talhões, culturas, safras, operações, estoque, máquinas, colheita, financeiro e
comercialização, com cada custo rastreável até a origem e um assistente de IA
conectado com segurança aos dados.

> Projeto independente. Arquitetura pensada para começar pequena e evoluir até um
> ERP Rural SaaS completo.

## Status — Fase 1 (fundação) ✅

Implementado:

- **Design System** próprio (tokens de cor/tipografia + componentes) fiel à referência visual
- **Autenticação** (cadastro de conta/tenant, login, sessão JWT httpOnly)
- **Multi-tenant** — todo dado de negócio isolado por `tenantId`
- **RBAC** base (7 perfis) e **auditoria** de ações
- **Cadastros**: Fazendas, Talhões, Culturas, Safras (com etapas do ciclo)
- **Dashboard** executivo com dados reais (KPIs, situação da safra, distribuição por cultura, alertas)
- App **responsivo** (desktop com sidebar + mobile com bottom nav e FAB)

As próximas fases (estoque, operações, máquinas, colheita, financeiro, comercial,
relatórios, assistente IA) estão descritas em [`docs/05-PLANO-IMPLEMENTACAO.md`](docs/05-PLANO-IMPLEMENTACAO.md).

## Stack

Next.js 16 (App Router) · TypeScript · Tailwind CSS v4 · PostgreSQL · Prisma ·
Auth via JWT (jose) + bcrypt · Zod · Recharts · lucide-react.

## Documentação

- [`docs/01-ARQUITETURA.md`](docs/01-ARQUITETURA.md) — arquitetura, camadas, multi-tenant, IA, segurança
- [`docs/02-MODELO-DADOS.md`](docs/02-MODELO-DADOS.md) — entidades, relacionamentos, rastreabilidade de custo
- [`docs/03-DESIGN-SYSTEM.md`](docs/03-DESIGN-SYSTEM.md) — tokens e componentes
- [`docs/04-NAVEGACAO-E-ROTAS.md`](docs/04-NAVEGACAO-E-ROTAS.md) — mapa de rotas
- [`docs/05-PLANO-IMPLEMENTACAO.md`](docs/05-PLANO-IMPLEMENTACAO.md) — roadmap por fases

## Como rodar

Pré-requisitos: Node 20+ e PostgreSQL.

```bash
# 1. Instalar dependências
npm install

# 2. Configurar ambiente
cp .env.example .env
#   edite DATABASE_URL e AUTH_SECRET

# 3. Criar o banco (migrações)
npx prisma migrate dev

# 4. (opcional) Popular dados de demonstração
SEED_DEMO=true npm run db:seed

# 5. Rodar
npm run dev
```

### Login de demonstração

Após rodar o seed (`SEED_DEMO=true`):

- **E-mail:** `demo@agrogestor.local`
- **Senha:** `demo123`

Os dados demonstrativos ficam em `prisma/seed/` e são **claramente separados** dos
dados reais — nunca use como se fossem reais.

## Estrutura

```
src/
├── app/            # rotas (App Router): (auth) e (app)
├── components/     # design system (ui/), layout, charts, maps, módulos
├── modules/        # regra de negócio por domínio (auth, fazendas, talhoes, safras…)
└── lib/            # prisma, utils, status
prisma/             # schema + migrações + seeds
docs/               # documentação e mockups
```

Regra de ouro: **a UI nunca contém regra de negócio** — ela vive nos *services*
de cada módulo, com validação Zod e transações atômicas.
