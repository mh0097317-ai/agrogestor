# 🌱 Agrogestor — Plano do Projeto

> ERP completo para gestão do agronegócio: **agricultura**, **pecuária**, **estoque de insumos** e **financeiro** num sistema web único.

**Data:** 17/08/2026
**Status:** Planejamento (repositório ainda vazio — este é o ponto de partida)

---

## 1. Visão do produto

O **Agrogestor** é um ERP web para produtores rurais e gestores de fazenda administrarem toda a operação num lugar só: onde plantam, o que gastam, o que produzem, o rebanho que criam e para onde vai o dinheiro.

**Problema que resolve:** hoje muito produtor controla safra em caderno, estoque no "de cabeça" e financeiro em planilha solta. O Agrogestor conecta tudo — cada gasto de insumo vira custo de uma safra, cada colheita vira estoque de produto, cada venda vira entrada no financeiro.

**Princípio-guia:** tudo se conecta ao redor de duas entidades centrais — a **Propriedade/Talhão** (o *onde*) e o **Ciclo/Safra ou Lote de animais** (o *o quê ao longo do tempo*).

---

## 2. Módulos do ERP

### 2.1 🌾 Agricultura / Safra
- Cadastro de **propriedades** e **talhões** (áreas de plantio, com hectares e localização)
- Cadastro de **culturas** (soja, milho, café, etc.)
- **Ciclos de safra**: plantio → tratos → colheita, ligados a um talhão e uma cultura
- Registro de **atividades no campo** (plantio, adubação, pulverização, colheita) com data, insumo usado e custo
- **Produtividade**: colheita registrada (sacas/toneladas por hectare)

### 2.2 🐄 Pecuária / Rebanho
- Cadastro de **animais** (individual) e/ou **lotes**
- Controle **sanitário** (vacinação, medicação, com calendário e alertas)
- **Pesagem** e ganho de peso ao longo do tempo
- **Reprodução** (cobertura, gestação, nascimento) — fase posterior
- Ligação com estoque (consumo de ração/medicamento) e financeiro (compra/venda de animais)

### 2.3 📦 Estoque de insumos
- Cadastro de **produtos/insumos** (sementes, fertilizantes, defensivos, ração, medicamentos)
- **Movimentações**: entrada (compra), saída (uso em campo/rebanho), ajuste
- Controle de **saldo atual** e **custo médio**
- Alertas de **estoque mínimo** e **validade**

### 2.4 💰 Financeiro
- **Contas a pagar** e **a receber**
- Lançamentos ligados à origem (custo de uma safra, venda de um lote, compra de insumo)
- **Centros de custo** por talhão / safra / rebanho → *quanto cada safra realmente deu de lucro*
- **Fluxo de caixa** e relatórios de resultado

### 2.5 🧭 Núcleo transversal (base pra tudo)
- **Autenticação** e usuários
- **Multi-propriedade** (um usuário pode gerir várias fazendas)
- **Dashboard** com indicadores (custo por hectare, saldo de caixa, próximas colheitas, alertas)
- **Permissões** (dono, gerente, operador)

---

## 3. Stack técnica

| Camada | Tecnologia | Por quê |
|---|---|---|
| Framework | **Next.js 15 (App Router)** + **TypeScript** | Front e back num projeto só, produtivo, SSR |
| UI | **Tailwind CSS** + **shadcn/ui** | Componentes bonitos e rápidos de montar |
| Banco de dados | **PostgreSQL** | Robusto, relacional (ERP é cheio de relações) |
| ORM | **Prisma** | Modelagem type-safe, migrações fáceis |
| Autenticação | **Auth.js (NextAuth)** | Login pronto e seguro |
| Validação | **Zod** | Validação de formulários e API |
| Gráficos | **Recharts** | Dashboards e relatórios |
| Testes | **Vitest** + **Playwright** | Unitário + end-to-end |
| Deploy | **Vercel** (app) + **Neon/Supabase** (Postgres) | Deploy simples e barato pra começar |

---

## 4. Estrutura de pastas (proposta)

```
agrogestor/
├── prisma/
│   ├── schema.prisma          # modelo de dados de todos os módulos
│   └── seed.ts                # dados de exemplo
├── src/
│   ├── app/                   # rotas (App Router)
│   │   ├── (auth)/            # login, cadastro
│   │   ├── (dashboard)/       # área logada
│   │   │   ├── dashboard/
│   │   │   ├── safras/
│   │   │   ├── talhoes/
│   │   │   ├── rebanho/
│   │   │   ├── estoque/
│   │   │   └── financeiro/
│   │   └── api/               # endpoints
│   ├── components/            # UI reutilizável
│   ├── lib/                   # prisma client, auth, helpers
│   ├── modules/               # regras de negócio por módulo
│   │   ├── agricultura/
│   │   ├── pecuaria/
│   │   ├── estoque/
│   │   └── financeiro/
│   └── types/
├── public/
├── .env.example
├── package.json
└── README.md
```

---

## 5. Modelo de dados (esboço das entidades)

- **User**, **Propriedade**, **UsuarioPropriedade** (multi-fazenda + permissão)
- **Talhao** (área, hectares, propriedade)
- **Cultura**
- **Safra** (talhão + cultura + datas + status)
- **AtividadeCampo** (safra + tipo + insumo + custo)
- **Animal** / **LoteAnimal**, **RegistroSanitario**, **Pesagem**
- **Insumo**, **MovimentacaoEstoque**
- **LancamentoFinanceiro** (tipo, valor, vencimento, origem, centro de custo)

*A modelagem detalhada em Prisma sai na Fase 1.*

---

## 6. Roadmap por fases

### 🟢 Fase 0 — Fundação (base do projeto)
- Setup Next.js + TypeScript + Tailwind + Prisma
- Estrutura de pastas, `.env.example`, README
- Banco Postgres conectado + primeira migração
- Layout base (sidebar, header) e tema
- **Entrega:** projeto roda `npm run dev` com tela de login e dashboard vazio

### 🟢 Fase 1 — Núcleo + Cadastros
- Autenticação (login/cadastro)
- Multi-propriedade e cadastro de propriedades/talhões
- CRUD de culturas e insumos
- **Entrega:** dá pra logar e cadastrar as bases

### 🟢 Fase 2 — Agricultura/Safra
- Ciclos de safra + atividades de campo
- Registro de colheita e produtividade
- **Entrega:** gestão de safra funcional

### 🟢 Fase 3 — Estoque
- Movimentações, saldo, custo médio
- Alertas de mínimo/validade
- Integração: atividade de campo baixa estoque
- **Entrega:** estoque conectado à operação

### 🟢 Fase 4 — Financeiro
- Contas a pagar/receber, centros de custo
- Fluxo de caixa + custo por safra
- **Entrega:** "quanto minha safra deu de lucro"

### 🟢 Fase 5 — Pecuária
- Rebanho, sanidade, pesagem
- Integração com estoque e financeiro
- **Entrega:** módulo de rebanho funcional

### 🟢 Fase 6 — Dashboards e relatórios
- Indicadores, gráficos, exportação
- **Entrega:** visão gerencial completa

---

## 7. Primeiros passos sugeridos

1. Confirmar este plano (ajustar módulos/ordem se quiser)
2. Eu executo a **Fase 0** (fundação) e mando o projeto rodando
3. Seguimos fase a fase, você validando cada entrega

---

## 8. Decisões em aberto (pra você pensar)

- **Público-alvo:** produtor pequeno/médio ou grande fazenda/cooperativa? (muda a complexidade)
- **Mobile:** vai ter uso pesado no campo pelo celular? (pesa no design responsivo/PWA)
- **Offline:** precisa funcionar sem internet no campo? (isso é grande, decidir cedo)
- **Ordem das fases:** manteve agricultura antes de pecuária — ok pra você?

---

*Plano inicial gerado para o projeto Agrogestor. Nada foi construído ainda — este documento é a base para começarmos.*
