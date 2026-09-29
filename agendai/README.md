# 💈 Agendaí

Agenda online **multi-negócio** para barbearias, salões femininos, salões masculinos,
estética e manicure. O cliente marca sozinho pelo link, recebe confirmação e lembrete
no WhatsApp — e o dono é avisado na hora de cada novo horário ou cancelamento.

## O que tem

**Para o cliente** (`/<link-do-negocio>`, ex.: `/dom-bigode`)
- Página com a cara do negócio (cor, nome, endereço, Instagram, WhatsApp, "aberto agora")
- Agendamento em 4 passos: serviço → profissional (ou "sem preferência") → dia e hora → dados
- Só aparecem horários realmente livres (jornada, pausas, folgas, antecedência, outros clientes)
- Página de confirmação com **Google Agenda / iPhone (.ics)**, WhatsApp do salão e **cancelamento pelo link**
- Lembra nome/telefone de quem já agendou

**Para o dono** (`/painel`)
- **Início**: agenda do dia, faturamento previsto, próximos 7 dias, clientes novos, link para divulgar
- **Agenda** visual por profissional (colunas), linha do "agora", folgas; tocar no horário → confirmar,
  atendido, faltou, cancelar, lembrete no WhatsApp
- **Novo agendamento** pelo painel (cliente de balcão/telefone) e **bloqueios** (folga, feriado, almoço)
- **Clientes**: visitas, faltas, total gasto, próximo horário, WhatsApp com 1 toque
- **Serviços**, **Equipe** (serviços e jornada de cada um, com pausa de almoço) e **Configurações**
  (link, cor, horário de funcionamento, regras de antecedência/cancelamento, confirmação automática ou manual)
- **Avisos**: histórico de tudo que foi enviado para o dono e para os clientes

**Avisos automáticos**

| Evento | Cliente | Dono |
|---|---|---|
| Cliente agendou | ✅ confirmação (ou "pedido recebido", se confirmação manual) | 🔔 painel + WhatsApp + e-mail |
| Dono confirmou pedido | ✅ confirmação | — |
| Lembrete (X horas antes) | ⏰ lembrete com link para cancelar | — |
| Cliente cancelou | ❌ confirmação do cancelamento | 🔔 painel + WhatsApp + e-mail |
| Dono cancelou | ❌ aviso com o motivo | — |

Canais: **WhatsApp** (Z-API ou Twilio), **e-mail** (Resend) e **sino no painel**.
Sem credenciais configuradas, nada quebra: as mensagens ficam em *Avisos* como "para enviar"
e o dono envia com 1 clique (abre o WhatsApp com o texto pronto).

**Multi-tenant**: cada negócio é isolado por `negocioId` em todas as consultas e ações.
**Sem horário duplicado**: além da checagem na aplicação, uma *exclusion constraint* no Postgres
impede dois atendimentos sobrepostos do mesmo profissional, mesmo com cliques simultâneos.

## Rodando

Requisitos: Node 20.9+ e PostgreSQL.

```bash
cd agendai
npm install
cp .env.example .env          # ajuste DATABASE_URL e AUTH_SECRET
npx prisma migrate deploy     # cria as tabelas
npm run db:seed               # (opcional) 3 negócios de demonstração
npm run dev                   # http://localhost:3000
```

### Demonstração (após o seed)

| Negócio | Página | Login do dono |
|---|---|---|
| Dom Bigode (barbearia) | `/dom-bigode` | `demo@agendai.app` / `demo123` |
| Studio Bella (salão feminino) | `/studio-bella` | `bella@agendai.app` / `demo123` |
| Corte Fino (salão masculino) | `/corte-fino` | `cortefino@agendai.app` / `demo123` |

São dados fictícios — o seed só apaga/recria esses três negócios.

## Notificações de verdade

Preencha no `.env` (todas opcionais):

- **WhatsApp via Z-API**: `ZAPI_INSTANCE_ID`, `ZAPI_TOKEN`, `ZAPI_CLIENT_TOKEN`
- **WhatsApp via Twilio**: `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `TWILIO_WHATSAPP_FROM`
- **E-mail via Resend**: `RESEND_API_KEY`, `EMAIL_FROM`
- `APP_URL`: URL pública, usada nos links das mensagens

### Lembretes

`GET /api/cron/lembretes` com `Authorization: Bearer $CRON_SECRET` envia os lembretes pendentes
(é idempotente). O `vercel.json` agenda de hora em hora — no plano Hobby da Vercel o cron só pode
rodar 1×/dia; nesse caso use um agendador externo (ex.: cron-job.org) chamando
`/api/cron/lembretes?chave=SEU_CRON_SECRET`.

## Stack

Next.js 16 (App Router, Server Actions, `proxy.ts`) · React 19 · TypeScript · Tailwind CSS v4 ·
PostgreSQL + Prisma · JWT (jose) + bcrypt · Zod · date-fns + @date-fns/tz · lucide-react.

```
src/
├── app/
│   ├── page.tsx                 # site do produto
│   ├── [slug]/                  # página pública de agendamento do negócio
│   ├── agendamento/[token]/     # confirmação / cancelamento do cliente (+ .ics)
│   ├── (auth)/entrar, cadastro
│   ├── painel/                  # área do dono
│   └── api/horarios, api/cron/lembretes
├── modules/
│   ├── agenda/                  # disponibilidade (horários livres) + regras de agendamento
│   ├── notificacoes/            # mensagens, provedores (Z-API/Twilio/Resend) e disparo
│   ├── painel/                  # server actions do painel
│   ├── negocio/, auth/
├── components/                  # UI (design system), público e painel
└── lib/                         # prisma, fuso horário, utilidades
```
