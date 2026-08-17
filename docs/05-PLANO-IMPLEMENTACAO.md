# 05 — Plano de Implementação

> Ordem incremental. Cada fase entrega valor real e é validável. Nada de implementar tudo de uma vez.

---

## Princípios de execução

- **Arquitetura antes de tela** — modelar entidades e relacionamentos antes de codar.
- **Sem dados fictícios disfarçados** — seeds demonstrativos ficam em `prisma/seed/demo.ts`, atrás da flag `SEED_DEMO`, claramente separados dos dados base.
- **Sem secrets no frontend.**
- **Sem atalhos que forcem reconstrução** — cada fase constrói sobre a anterior.
- **Definition of Done por fase:** tipado, validado (Zod), multi-tenant respeitado, testes essenciais, responsivo (desktop + mobile), sem regra de negócio na UI.

---

## FASE 1 — Fundação (foco atual)
**Design System · Login · Multi-tenant · Dashboard · Fazendas · Talhões · Culturas · Safras**

- Setup do projeto (Next.js, TS, Tailwind, Prisma, Auth.js).
- **Design System**: tokens + componentes base (Button, Card, Input, Table, Badge, Tabs, KpiCard, StageStepper, PageHeader, Sidebar, MobileNav).
- **Auth + Multi-tenant**: cadastro de conta/tenant, login, contexto de tenant, Prisma extension + RLS, RBAC base, usuários/perfis.
- **Cadastros**: Produtor, Fazenda, Talhão, Cultura, Safra (+ SafraTalhao).
- **Dashboard**: KPIs, situação da safra (stepper), alertas (base), custo/ha e custo por categoria (com dados reais dos cadastros), mapa de talhões (imagem estática/placeholder de mapa nesta fase).
- **Entrega:** logar, criar empresa, cadastrar fazendas/talhões/culturas/safras e ver o dashboard preenchido com dados reais.

## FASE 2 — Estoque
Produtos, Fornecedores, saldo, custo médio, movimentações (entrada/saída/ajuste/transferência), alertas de estoque baixo.

## FASE 3 — Operações + Custos
Registro de operações (preparo, plantio, adubação, pulverização, irrigação, colheita), **consumo automático de estoque em transação atômica**, cálculo e atribuição de custo a talhão/safra, auditoria.

## FASE 4 — Máquinas
Máquinas, horímetro/km, abastecimento (combustível), manutenção, alertas de manutenção próxima, custo de máquina ligado a operações.

## FASE 5 — Colheita
Registro de colheita, produção total/por talhão, sacas/hectare, custo por saca.

## FASE 6 — Financeiro
Contas a pagar/receber, fluxo de caixa, categorias, centros de custo, vínculo de lançamento a safra/talhão/operação/máquina. Respostas de custo (safra, talhão, categoria).

## FASE 7 — Comercialização
Vendas, clientes, contratos, frete, descontos, entrega, recebimento, status; receita ligada à safra.

## FASE 8 — Analítico
Dashboard analítico, painel de **Resultado da Safra** (receita − custos = resultado; margem %, /ha, /saca), comparação entre safras, relatórios, central de alertas completa.

## FASE 9 — Assistente IA
Camada de tools controladas no backend (`getCropSummary`, `getFieldCosts`, `getInventory`, `getAccountsPayable`, `getHarvestResult`, `simulateMargin`), integração Claude API (tool-use), respeito a tenant + permissões, auditoria das consultas. **Sem SQL arbitrário.**

---

## Fora do MVP (portas abertas, não implementadas agora)
- Offline seletivo + sincronização em campo.
- Desenho de polígono de talhão no mapa (PostGIS + editor).
- Billing/assinaturas automatizado.
- Integrações externas (clima, mercado, notas fiscais).

---

## Próximo passo imediato
Após aprovação deste planejamento e do mockup visual do Design System, iniciar **Fase 1**, começando por: setup + Design System + Auth/Multi-tenant, depois cadastros e dashboard.
