# 03 — Design System

> Tokens e componentes derivados **diretamente da imagem de referência**. Objetivo: SaaS premium, clean, agrícola — nunca "ERP antigo".

---

## 1. Identidade

- **Azul-marinho profundo** — sidebar, títulos, texto forte.
- **Verde agrícola** — cor de marca / ação (ativo, botões primários, FAB, positivo).
- **Branco** — superfícies / cards.
- **Cinza muito claro** — fundo da aplicação.
- **Âmbar/laranja** — estados de atenção.
- **Vermelho** — apenas situações críticas.

---

## 2. Tokens de cor

> Valores iniciais calibrados pela referência. Ajustáveis após feedback. Definidos como CSS variables + Tailwind theme.

### Marca / Primária (verde)
| Token | Hex | Uso |
|---|---|---|
| `primary-50` | `#ECFDF3` | fundo de badge sucesso, hover leve |
| `primary-100` | `#D1FADF` | chips, destaque suave |
| `primary-500` | `#16A34A` | **cor principal de ação** |
| `primary-600` | `#15833B` | hover de botão primário |
| `primary-700` | `#116A30` | pressionado |

### Navy (sidebar / texto)
| Token | Hex | Uso |
|---|---|---|
| `navy-900` | `#0E2233` | fundo da sidebar |
| `navy-800` | `#13324B` | item de sidebar hover |
| `navy-700` | `#1B4A6B` | bordas sutis no escuro |
| `ink-900` | `#0F1F2E` | títulos |
| `ink-700` | `#334155` | texto forte |

### Neutros / superfícies
| Token | Hex | Uso |
|---|---|---|
| `bg` | `#F5F7FA` | fundo da aplicação |
| `surface` | `#FFFFFF` | cards |
| `border` | `#E7ECF1` | bordas de card/tabela |
| `text` | `#1E293B` | texto padrão |
| `text-muted` | `#64748B` | texto secundário |
| `text-subtle` | `#94A3B8` | labels, placeholders |

### Estados
| Token | Hex | Fundo | Uso |
|---|---|---|---|
| `success` | `#16A34A` | `#ECFDF3` | concluído, em produção, positivo |
| `warning` | `#D97706` | `#FEF3C7` | em manejo, estoque baixo, atenção |
| `danger` | `#DC2626` | `#FEE2E2` | crítico, vencido, perda |
| `info` | `#2563EB` | `#EFF6FF` | informativo |

**Regra:** vermelho é reservado a crítico. "Atenção" é sempre âmbar.

---

## 3. Tipografia

- **Família:** Inter (fallback: system-ui). Alternativa premium: "Plus Jakarta Sans" para títulos.
- **Números** (KPIs, valores): peso Semi Bold/Bold, tabular-nums para alinhar em tabelas.

| Estilo | Tamanho / Peso | Uso |
|---|---|---|
| Display | 28–32 / 700 | valor grande de KPI |
| H1 | 24 / 700 | título de página |
| H2 | 20 / 600 | título de card/seção |
| H3 | 16 / 600 | subtítulo |
| Body | 14 / 400–500 | texto geral |
| Small | 13 / 400 | labels, meta |
| Caption | 12 / 500 | badges, hints |

---

## 4. Espaçamento, raio, sombra

- **Escala de espaço** (px): 4, 8, 12, 16, 20, 24, 32, 40, 48. Espaçamento generoso entre elementos (a referência respira).
- **Raio:** `sm` 8px, `md` 12px (cards), `lg` 16px, `full` (pills/avatars).
- **Sombra:** cards com sombra muito suave (`0 1px 2px rgba(16,35,51,.04), 0 4px 12px rgba(16,35,51,.06)`). Evitar bordas pesadas — preferir sombra + fundo.
- **Densidade:** confortável. Evitar tabelas apertadas, principalmente no mobile.

---

## 5. Grid e layout

- **Desktop:** sidebar fixa ~248px + área de conteúdo fluida. Conteúdo máx ~1440px, padding 24–32px.
- **Cards do dashboard:** grid responsivo (5 KPIs em linha no desktop → 2 col no tablet → 1 col no mobile).
- **Breakpoints:** `sm` 640, `md` 768, `lg` 1024, `xl` 1280, `2xl` 1536.

---

## 6. Inventário de componentes (Design System)

### Primitivos (`components/ui/`)
- **Button** — variantes: `primary` (verde), `secondary` (branco/borda), `ghost`, `danger`; tamanhos sm/md/lg; com ícone.
- **IconButton** — ações compactas (⋮, notificação).
- **Input / Textarea / Select / DatePicker / Combobox** — com label, hint, erro.
- **Checkbox / Radio / Switch**.
- **Badge / StatusPill** — success/warning/danger/info (usado em status de talhão, conta, estoque).
- **Card** — container branco padrão; variações `CardHeader`, `CardTitle`, `CardAction`.
- **Avatar** — usuário.
- **Tooltip / Popover / Dropdown Menu**.
- **Tabs** — (Visão Geral, Talhões, Informações, Histórico).
- **Table** — cabeçalho leve, linhas espaçadas, coluna de ações, ordenação, paginação; **variante mobile** vira lista de cards.
- **Modal / Drawer / Sheet** — formulários e detalhes.
- **Toast** — feedback.
- **Breadcrumb**.
- **EmptyState** — telas sem dados (com CTA).
- **Skeleton** — carregamento.

### Compostos (domínio)
- **KpiCard** — ícone, label, valor grande, delta (▲/▼ com cor) e comparação ("+12,4% vs safra anterior").
- **StageStepper** — etapas da safra (Planejamento → Comercialização) com estado concluído/andamento/pendente.
- **AlertItem / AlertList** — ícone por nível, título, tempo.
- **CostByCategoryChart** — donut (Recharts).
- **CostPerHectareChart** — linha.
- **FieldMap** — mapa de talhões (MapLibre) com polígonos coloridos por status; fallback imagem estática na Fase 1.
- **DataTableToolbar** — filtros (talhão, tipo, período).
- **SafraSelector** — seletor de safra no topo.
- **WeatherWidget** — clima + local.
- **PageHeader** — título + breadcrumb + ações.
- **AssistantPanel** — chat do assistente com chips de sugestão.

---

## 7. Navegação (da referência)

### Desktop — sidebar navy
Topo: logo. Principal: **Dashboard, Fazendas, Talhões, Safras, Operações, Estoque, Máquinas, Colheita, Financeiro, Comercial, Relatórios, Assistente IA**. Rodapé: **Configurações, Usuário, Sair**. Item ativo com destaque verde.

### Mobile — bottom nav própria
**Início, Safras, [ + Nova operação (FAB verde central) ], Operações, Mais**. Mobile NÃO é o desktop encolhido — telas repensadas (KPIs empilhados, tabelas viram cards, ações principais ao alcance do polegar).

---

## 8. Acessibilidade

- Contraste mínimo AA (texto sobre navy e sobre verde verificados).
- Foco visível em todos os interativos.
- Alvos de toque ≥ 44px no mobile.
- Cor nunca é o único indicador de status (ícone + texto junto).
- `prefers-reduced-motion` respeitado.

---

## 9. Modo de tema

- **Light** é o padrão (referência é clara).
- Tokens já preparados para um **dark mode** futuro (sidebar já é escura — meio caminho andado).
