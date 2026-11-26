# StudioFlow: proposta comercial (para decisão)

> **Nada aqui está no sistema.** Os planos continuam "Sob consulta" até você definir os valores em `/admin` → Cobranças → Planos. As faixas abaixo são sugestões fundamentadas, não preços definitivos.

## 1. Referências de mercado (pesquisa de 25/11/2026)

| Concorrente | Entrada | Observação |
|---|---|---|
| Avec (BR) | a partir de R$ 88,90/mês (1–2 profissionais) | IA que agenda no WhatsApp, conta digital |
| Trinks (BR) | a partir de ~R$ 81/mês (agregador) | atendente virtual, lembrete premium e clube são **adicionais** |
| GlossGenius (EUA) | US$ 24 / 48 / 148 | recepção com IA cobrada à parte |
| Booksy / Fresha | assinatura + **comissão sobre cliente novo** | o StudioFlow não cobra comissão |

Os preços de terceiros mudam: confira nas páginas oficiais antes de usar em material comercial (fontes em `STUDIOFLOW_RELATORIO_FINAL.md`, seção 8).

## 2. Custos que o preço precisa cobrir (por casa, por mês)

| Custo | Como medir | Observação |
|---|---|---|
| IA da recepcionista | `/admin` → "Custo da IA" (R$ por casa e por modelo) | Varia com o volume de conversas. Use 30 dias reais da Coliseu antes de fixar preço. |
| WhatsApp | QR/Evolution: rateio da VPS; Meta oficial: tabela por conversa | A VPS é custo fixo dividido entre as lojas. |
| Cobrança | taxa do Asaas por fatura/cartão | Conferir na tabela vigente do Asaas. |
| Infra (Vercel, Supabase, e-mail) | faturas mensais | Free hoje; o Pro do Supabase entra quando houver clientes pagantes. |
| Suporte | horas por loja | É o maior custo escondido no início. |

**Regra sugerida:** preço ≥ 3 × (IA + WhatsApp + taxa de cobrança) por loja, para sobrar margem para suporte e infraestrutura.

## 3. Estrutura sugerida

| Plano | Para quem | Módulos (já configurados) | Faixa sugerida |
|---|---|---|---|
| **Essencial** | barbeiro sozinho ou 2 cadeiras | página, agendamento, agenda, clientes, financeiro, fidelidade, lista de espera | R$ 69 a R$ 89/mês |
| **Profissional** | barbearia com equipe | + sinal via Pix, clube, produtos, check-in e Modo TV | R$ 129 a R$ 169/mês |
| **Premium** | quem quer a recepcionista IA no WhatsApp | tudo, inclusive a recepcionista | R$ 229 a R$ 299/mês, com teto de IA por casa |

**Princípios:**
- **Sem comissão por cliente.** É o diferencial contra Booksy e Fresha.
- **Anual com desconto:** o campo `annual_cents` já existe. Sugestão: 2 meses grátis, sem multa de fidelidade (a Trinks cobra 50% de multa; não ter multa vira argumento de venda).
- **Teto de IA:** cada casa Premium nasce com teto mensal em R$. Ao atingir, a conversa passa para a equipe e o dono é avisado; nunca há cobrança surpresa.
- **Teste grátis:** o período já é configurável (`platform_settings`). Sugestão: 14 dias, com a ativação acompanhada.

## 4. Antes de publicar os preços

1. Medir 30 dias de custo de IA real da Coliseu pelo card novo.
2. Ligar o Asaas da plataforma no sandbox e testar a assinatura no cartão (autorizações, item 4).
3. Definir o número de suporte (item 5) e um tempo de resposta que dê para cumprir.
4. Preencher os valores em `/admin` → Planos. A página `/precos` atualiza em até 5 minutos.
5. Revisar Termos de Uso e Política de Privacidade com um advogado, incluindo cancelamento e reembolso.
