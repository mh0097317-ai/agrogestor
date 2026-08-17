# 01 — Arquitetura Técnica

> **Agrogestor** — Plataforma SaaS de gestão rural. Projeto independente, preparado para produção e para evoluir até um ERP Rural completo.

---

## 1. Princípios de arquitetura

1. **Modular e escalável** — cada domínio (fazendas, safras, estoque, financeiro…) é um módulo isolado, com suas próprias regras de negócio.
2. **Separação de camadas** — UI nunca contém regra de negócio. Regra de negócio vive em *services*; acesso a dados em *repositories*.
3. **Multi-tenant seguro desde o dia 1** — todo dado de negócio é isolado por `tenant`. Vazamento entre empresas é tratado como falha crítica.
4. **Rastreabilidade de custo até a origem** — o modelo de dados garante que todo custo se liga a Safra → Talhão → Operação → Insumo/Máquina/Mão de obra.
5. **Transações seguras** — operações que mexem em estoque + custo + auditoria acontecem numa transação atômica (tudo ou nada).
6. **IA sem SQL arbitrário** — o modelo de IA nunca executa SQL. Ele só chama *tools* controladas e tipadas no backend.
7. **Sem atalhos que exijam reconstrução** — nada de "banco improvisado só pra telas". Modelagem correta antes de implementar.

---

## 2. Stack

| Camada | Tecnologia | Motivo |
|---|---|---|
| **Framework** | Next.js 15 (App Router) + TypeScript | Full-stack num projeto só, SSR, produtivo |
| **UI / Estilo** | Tailwind CSS + shadcn/ui + Design System próprio | Componentes premium, tema consistente |
| **Estado servidor** | Server Components + Server Actions / Route Handlers | Menos client JS, dados seguros no servidor |
| **Estado cliente** | TanStack Query (quando necessário) + Zustand (UI leve) | Cache e sincronização de dados |
| **Banco** | PostgreSQL | Relacional, robusto, suporta RLS |
| **ORM** | Prisma | Type-safe, migrações, middleware p/ multi-tenant |
| **Auth** | Auth.js (NextAuth) — credenciais + OAuth futuro | Sessão segura, integração com RBAC |
| **Autorização** | RBAC por permissões (CASL ou checagem própria) | Perfis: admin, proprietário, gerente… |
| **Validação** | Zod (compartilhada front + back) | Contrato único de dados |
| **Mapas / Geo** | MapLibre GL + PostGIS (fase futura p/ polígonos) | Open-source, sem lock-in, geometria de talhão |
| **Gráficos** | Recharts | Gráficos elegantes e responsivos |
| **IA** | Claude API (tool-use) + camada de tools no backend | Assistente rural conectado aos dados, seguro |
| **Storage** | S3-compatível (Cloudflare R2 / Supabase Storage) | Documentos, fotos, mapas |
| **Filas / Jobs** | (Fase futura) BullMQ ou Trigger.dev | Relatórios pesados, sync offline |
| **PWA** | Manifest + Service Worker (next-pwa) | Uso em campo, base p/ offline futuro |
| **Testes** | Vitest (unit) + Playwright (e2e) | Confiança pra evoluir |
| **Deploy** | Vercel (app) + Neon/Supabase (Postgres) | Simples e barato pra começar |

---

## 3. Camadas da aplicação

```
┌─────────────────────────────────────────────────────────┐
│  Apresentação (Next.js App Router)                        │
│  - Server Components (leitura)                             │
│  - Client Components (interação)                           │
│  - Design System (components/ui)                           │
│  → NUNCA contém regra de negócio                          │
├─────────────────────────────────────────────────────────┤
│  Aplicação / Casos de uso (modules/*/services)            │
│  - Regras de negócio, orquestração, transações            │
│  - Ex.: registrarOperacao() → baixa estoque + custo + audit│
├─────────────────────────────────────────────────────────┤
│  Domínio (modules/*/domain)                               │
│  - Entidades, tipos, invariantes, cálculos                │
│  - Ex.: cálculo dose × área = litros; custo/ha; custo/saca│
├─────────────────────────────────────────────────────────┤
│  Infraestrutura (modules/*/repositories, lib/)            │
│  - Prisma, storage, auth, IA tools, integrações           │
│  - Middleware multi-tenant (injeta tenantId)              │
├─────────────────────────────────────────────────────────┤
│  PostgreSQL (+ RLS opcional) + Storage + Claude API       │
└─────────────────────────────────────────────────────────┘
```

**Regra de ouro:** um Server Component chama um *service*, nunca o Prisma direto. O *service* aplica regra de negócio, usa *repositories*, e roda dentro de uma transação quando necessário.

---

## 4. Estrutura de pastas

```
agrogestor/
├── prisma/
│   ├── schema.prisma
│   ├── migrations/
│   └── seed/                 # seeds SEPARADOS e claramente demonstrativos
│       ├── demo.ts           # dados de demonstração (flag DEMO)
│       └── base.ts           # dados essenciais (culturas, unidades, categorias)
├── src/
│   ├── app/
│   │   ├── (auth)/           # login, cadastro, recuperar senha
│   │   ├── (app)/            # área logada (layout com sidebar)
│   │   │   ├── dashboard/
│   │   │   ├── fazendas/
│   │   │   ├── talhoes/
│   │   │   ├── safras/
│   │   │   ├── operacoes/
│   │   │   ├── estoque/
│   │   │   ├── maquinas/
│   │   │   ├── colheita/
│   │   │   ├── financeiro/
│   │   │   ├── comercial/
│   │   │   ├── relatorios/
│   │   │   ├── assistente/
│   │   │   └── configuracoes/
│   │   └── api/              # route handlers (webhooks, IA, uploads)
│   ├── components/
│   │   ├── ui/               # Design System (Button, Card, Input, Table…)
│   │   ├── charts/           # gráficos
│   │   ├── maps/             # mapas
│   │   └── layout/           # sidebar, topbar, mobile nav
│   ├── modules/              # DOMÍNIOS (regra de negócio)
│   │   ├── tenant/
│   │   ├── auth/
│   │   ├── fazendas/
│   │   ├── talhoes/
│   │   ├── safras/
│   │   ├── operacoes/
│   │   ├── estoque/
│   │   ├── maquinas/
│   │   ├── colheita/
│   │   ├── financeiro/
│   │   ├── comercial/
│   │   ├── alertas/
│   │   ├── auditoria/
│   │   └── ia/               # tools controladas do assistente
│   ├── lib/                  # prisma client, auth, tenant context, utils
│   ├── server/               # server actions compartilhadas
│   └── types/
├── public/                   # manifest PWA, ícones
├── .env.example              # NUNCA secrets reais versionados
└── docs/
```

Cada módulo em `modules/` segue: `domain/` (tipos + cálculos puros), `services/` (casos de uso + transações), `repositories/` (Prisma), `schemas/` (Zod).

---

## 5. Multi-tenant (isolamento por empresa)

**Estratégia: coluna `tenantId` em toda entidade de negócio + isolamento forçado em camada de acesso.**

1. Toda tabela de negócio tem `tenantId` (FK para `Tenant`).
2. **Prisma middleware / extension** injeta `tenantId` automaticamente em toda query (where + create), lendo o tenant do contexto da requisição (sessão autenticada).
3. **Defesa em profundidade:** ativar **PostgreSQL Row-Level Security (RLS)** com policy por `tenantId`, usando `SET app.current_tenant` por conexão. Assim, mesmo um bug na aplicação não vaza dados.
4. Nenhuma query de negócio roda sem tenant no contexto — falta de tenant = erro, não "retorna tudo".

```
Requisição → Auth (sessão) → resolve tenantId
          → abre contexto (AsyncLocalStorage)
          → Prisma extension aplica tenantId em TODA query
          → (RLS no Postgres como rede de segurança)
```

---

## 6. Segurança

- **Secrets só no servidor.** Nunca chave/token/secret no frontend. Variáveis `NEXT_PUBLIC_*` só para valores realmente públicos.
- **Validação em toda entrada** com Zod, no servidor (não confiar no cliente).
- **RBAC** checado no servidor (Server Action / Route Handler), não só escondendo botão na UI.
- **Auditoria** de ações sensíveis (ver doc 02).
- **Transações atômicas** para operações compostas.
- **Rate limiting** nos endpoints de IA e auth.

---

## 7. Camada de IA (Assistente Rural)

**A IA nunca toca no banco diretamente. Nunca executa SQL do modelo.**

```
Usuário → pergunta ("Quanto gastei nesta safra?")
   ↓
Backend monta contexto seguro (tenantId, permissões do usuário)
   ↓
Claude API (tool-use) escolhe UMA das tools controladas:
   - getCropSummary(safraId)
   - getFieldCosts(talhaoId)
   - getInventory(filtro)
   - getAccountsPayable(periodo)
   - getHarvestResult(safraId)
   - simulateMargin(precoSaca, safraId)
   ↓
Tool = função TypeScript tipada no backend:
   - valida args (Zod)
   - aplica tenantId + permissão do usuário
   - roda query parametrizada (Prisma) — SÓ dados autorizados
   ↓
Resultado estruturado volta ao modelo → resposta em linguagem natural
```

- Cada tool tem escopo mínimo e respeita o perfil do usuário (um "Operador" não vê financeiro).
- O modelo só recebe dados que o usuário logado já poderia ver.
- Logs de auditoria para toda consulta da IA.
- Detalhe de implementação (modelos, tool schema) seguirá a referência oficial da Claude API na Fase 9.

---

## 8. PWA / Mobile / Offline

- **Fase 1:** app 100% responsivo + PWA instalável (manifest + service worker básico, cache de assets).
- **Futuro:** offline seletivo — registrar operações em campo sem internet e sincronizar depois (fila local + reconciliação).
- **Decisão consciente:** NÃO implementar offline complexo agora — não comprometer a primeira versão. A arquitetura só deixa a porta aberta (services desacoplados da UI, ids gerados de forma sincronizável).

---

## 9. Ambientes e configuração

- `.env.example` documenta todas as variáveis (sem valores reais).
- Banco: connection string via env. Storage e Claude API via env, só no servidor.
- Seeds separados por flag: `SEED_DEMO=true` popula dados demonstrativos claramente marcados; dados base (culturas, unidades, categorias) são neutros.
