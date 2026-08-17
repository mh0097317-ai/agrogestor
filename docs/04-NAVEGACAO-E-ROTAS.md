# 04 — Navegação e Rotas

> Mapa de rotas do App Router (Next.js). Área pública `(auth)` e área logada `(app)` com layout de sidebar + guarda de tenant/permissão.

---

## 1. Rotas públicas — `(auth)`

| Rota | Tela |
|---|---|
| `/login` | Login |
| `/cadastro` | Criar conta / tenant (onboarding SaaS) |
| `/recuperar-senha` | Recuperação |
| `/convite/[token]` | Aceitar convite para um tenant |

---

## 2. Rotas da aplicação — `(app)` (autenticadas)

Layout com sidebar (desktop) / bottom nav (mobile). Toda rota resolve `tenantId` da sessão e checa permissão.

| Rota | Descrição | Fase |
|---|---|---|
| `/dashboard` | Dashboard executivo | 1 |
| `/fazendas` | Lista de fazendas | 1 |
| `/fazendas/[id]` | Fazenda (tabs: Visão Geral, Talhões, Safras, Máquinas, Estoque, Financeiro, Histórico) | 1 |
| `/fazendas/nova` | Cadastro de fazenda | 1 |
| `/talhoes` | Lista de talhões | 1 |
| `/talhoes/[id]` | Detalhe do talhão (custos, produção, produtividade) | 1 |
| `/culturas` | Cadastro de culturas | 1 |
| `/safras` | Lista de safras | 1 |
| `/safras/[id]` | Safra (talhões, operações, insumos, máquinas, custos, colheita, vendas, resultado) | 1 |
| `/estoque` | Produtos + saldo + alertas | 2 |
| `/estoque/movimentacoes` | Movimentações | 2 |
| `/fornecedores` | Fornecedores | 2 |
| `/operacoes` | Operações agrícolas (lista + filtros) | 3 |
| `/operacoes/nova` | Registrar operação (consumo automático) | 3 |
| `/maquinas` | Máquinas | 4 |
| `/maquinas/[id]` | Detalhe (horímetro, manutenção, abastecimento) | 4 |
| `/colheita` | Registros de colheita + produtividade | 5 |
| `/financeiro` | Contas a pagar/receber, fluxo de caixa | 6 |
| `/financeiro/categorias` | Categorias e centros de custo | 6 |
| `/comercial` | Comercialização / vendas | 7 |
| `/clientes` | Clientes | 7 |
| `/relatorios` | Relatórios + resultado da safra | 8 |
| `/alertas` | Central de alertas | 8 |
| `/assistente` | Assistente IA | 9 |
| `/configuracoes` | Tenant, usuários, perfis, planos, preferências | 1 (base) |
| `/configuracoes/usuarios` | Gestão de usuários e permissões | 1 (base) |
| `/perfil` | Perfil do usuário | 1 |

---

## 3. APIs — `app/api/`

| Endpoint | Uso | Fase |
|---|---|---|
| `POST /api/auth/*` | Auth.js | 1 |
| `POST /api/assistente` | Chat IA (tool-use, server-side) | 9 |
| `POST /api/uploads` | Upload seguro para storage | 2+ |
| `POST /api/webhooks/assinatura` | Billing/assinatura | futuro |

> Preferência: **Server Actions** para mutações internas; Route Handlers só para o que precisa ser endpoint (IA, uploads, webhooks).

---

## 4. Guardas / middleware

1. **Autenticação** — sem sessão → `/login`.
2. **Tenant** — resolve `tenantId`; injeta no contexto (Prisma extension + RLS).
3. **Permissão** — cada rota/ação declara permissão exigida; perfil sem acesso → 403 / UI oculta + bloqueio no servidor.
4. **Assinatura** — tenant sem plano ativo → tela de billing (futuro).
