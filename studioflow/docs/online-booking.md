# Agendamento online opcional por estabelecimento

## Arquitetura analisada

A implementação parte da `main` no commit `183447d`, correspondente ao deploy de produção identificado na Vercel. A cópia local antiga não foi usada como base. O trabalho está em `codex/optional-online-booking`.

O StudioFlow usa Next.js App Router, React, TypeScript e Tailwind/CSS próprio. As rotas de `src/app` delegam apresentação a `src/features`, estado do painel a `WorkspaceProvider` e regras/operações de servidor a `src/services`. As interfaces compartilhadas ficam em `src/types`; disponibilidade, calendário e permissões ficam em `src/lib`. Foram revisados os pontos de entrada públicos e internos, carregamento/persistência, autenticação, isolamento, migrations, integrações, divulgação e testes.

Em produção, Supabase fornece Auth, PostgreSQL, RLS e armazenamento de imagens. `requireMembership` autentica o usuário no servidor, identifica seu estabelecimento e verifica o acesso de plataforma. As alterações internas passam pela sessão, pelo papel do membro e por validação/RPC. Não há acesso anônimo direto às tabelas de negócio. O modo local de demonstração usa arquivos por estabelecimento e permanece bloqueado em produção.

O produto existente inclui agenda, clientes, serviços, equipe, financeiro, relatórios, onboarding, página pública, reservas e gestão por token. A versão atual também contém clube, fidelidade, lista de espera, sinal/pagamentos, produtos, check-in/TV, módulos/planos e integrações de atendimento por web, WhatsApp e Instagram. Estes recursos não foram recriados nem removidos. Nenhuma nova IA ou integração de WhatsApp foi desenvolvida nesta etapa.

## Fluxo anterior e dados relacionados

1. `/<slug>` renderiza `PublicPage`, com catálogo obtido no servidor e atualizado pela API pública.
2. `/<slug>/agendar` renderiza `BookingFlow`: serviços, profissional, data/horário, dados do cliente e confirmação. As consultas de disponibilidade consideram duração, intervalo, expediente, pausas, bloqueios e reservas existentes.
3. `POST /api/public/<slug>/book` valida origem, limite de requisições e dados com Zod; chama `bookWithPayments`. O serviço preserva as regras existentes de clube e sinal.
4. No PostgreSQL, a transação de reserva usa advisory lock por estabelecimento, revalidação de disponibilidade e exclusion constraint contra sobreposição. O cliente/reserva e os serviços históricos são gravados sem trocar as regras de preço/duração.
5. O comprovante usa um token aleatório de 256 bits; o banco armazena apenas seu hash. Consulta, cancelamento e remarcação de reservas existentes seguem a política atual.

| Tabela | Participação |
| --- | --- |
| `tenants`, `businesses` | Identidade, slug, apresentação e contato do estabelecimento |
| `business_members`, `profiles` | Usuário autenticado, vínculo ativo e papel |
| `business_settings` | Antecedência, horizonte, buffer, cancelamento, expediente e preferências; agora também `online_booking_enabled` |
| `services`, `professionals`, `professional_services` | Catálogo, duração/preço, disponibilidade e habilitação do profissional |
| `business_hours`, `professional_hours`, `professional_breaks` | Estrutura de horários existente; o motor atual também usa os campos de expediente de settings/profissionais |
| `customers`, `appointments`, `appointment_services` | Cliente, reserva e valores/duração históricos |
| `blocked_times` | Folgas, pausas e bloqueios manuais |
| `payments`, `payment_accounts`, `memberships`, `membership_plans` | Regras existentes de sinal/clube e recebimentos |
| `platform_access` | Liberação e módulos do estabelecimento; independente da nova opção |

Não havia configuração equivalente para desligar apenas o canal do site. A liberação de plataforma e `assistant_enabled` possuem outras finalidades e não foram reutilizadas para isso.

## Alteração implementada

`business_settings.online_booking_enabled` é `BOOLEAN NOT NULL DEFAULT TRUE`. A migration apenas acrescenta a coluna e uma RPC pública específica; não muda IDs, slug, tokens, políticas RLS, relacionamentos, reservas ou outras preferências. O tipo TypeScript usa `onlineBookingEnabled`. Snapshots locais antigos recebem o padrão `true` e novos cadastros permanecem ativados.

`PATCH /api/workspace/online-booking` aceita somente o booleano, sem seletor de empresa. O servidor obtém `businessId` da sessão; apenas owner/admin/manager podem alterar. A atualização usa o cliente autenticado e as políticas `admin_update` existentes, com filtro do estabelecimento e confirmação da linha alterada. Uma atualização de coluna única preserva as demais configurações.

Configurações ganha a seção “Agendamento online” com switch acessível. A opção salva no servidor; o estado não é anunciado como salvo antes da resposta. Ativada, apresenta endereço/cópia/abertura; desativada, apresenta o estado e não incentiva divulgação. Sidebar, cabeçalhos, checklist, Divulgação, story/QR de agendamento, TV e mensagens de retorno/lista de espera respeitam a opção. Check-in, TV, histórico e atendimento interno continuam disponíveis.

Ambas as entradas do site mostram `BookingUnavailable` ao desativar. A tela usa a identidade existente, o nome/logo reais e oferece WhatsApp somente quando o telefone cadastrado é válido. As páginas são dinâmicas para não manter uma versão pública antiga em cache de geração estática. O catálogo continua fornecendo a opção para a atualização do navegador; a proteção de gravação não depende dele.

Slots, disponibilidade mensal, próximo horário e novas entradas públicas de chat/lista de espera verificam a opção no servidor. A reserva pública faz a mesma checagem antes de processar clube, sinal ou cobrança. Uma chamada forjada com canal no corpo não muda o canal escolhido pelo servidor.

No banco, `book_public_appointment` verifica a opção sob bloqueio da linha de settings e chama a transação existente. O bloqueio dura até o commit: a desativação e a reserva concorrente são ordenadas, impedindo que uma leitura antiga autorize uma reserva após a desativação já confirmada. Só `service_role` executa a RPC; anon/authenticated não recebem permissão.

## Canais independentes

O motor compartilhado `book_appointment` e a criação interna via `workspace_mutation` continuam independentes da nova opção. `bookWithPayments` recebe um canal escolhido exclusivamente por código confiável: `public_link` por padrão, ou `receptionist` para os adaptadores externos existentes. O chat web continua pertencendo ao canal do site. O transporte WhatsApp/Instagram existente não depende da habilitação do link.

Essa separação prepara novos adaptadores controlados sem acoplar o núcleo de disponibilidade/criação ao site. Não foi criado novo painel de IA, bot, provedor, assinatura ou envio externo.

## Correção encontrada na regressão

O teste da criação manual no PostgreSQL revelou uma ambiguidade preexistente entre a variável local `services` da `workspace_mutation` e a tabela `public.services`. A migration `20261011121000_studioflow_manual_booking_variable.sql` reaplica a mesma função, renomeando somente a variável para `selected_service_ids`. Assinatura, grants, validações, locks, papéis e regras de negócio são preservados. Não foram editadas migrations antigas.

## Verificação e publicação

Os testes adicionados verificam padrão de estabelecimentos existentes/novos, desativação, tentativa direta de gravação, ausência de novos registros na rejeição, isolamento por tenant/RLS, papéis, acesso anônimo negado, funcionamento dos canais internos, tokens/slug preservados, reservas existentes e reativação. O smoke HTTP usa um estabelecimento local isolado, inclusive páginas antigas, APIs, corpo forjado e agendamento manual. Não utiliza dados fictícios em produção.

Verificação local concluída: lint e typecheck aprovados, 73 testes automatizados aprovados e smoke HTTP aprovado. A interface também foi verificada no navegador: desativação salva, ocultação dos atalhos de divulgação, tela de indisponibilidade e reativação.

Para publicar, aplicar primeiro, no projeto Supabase correspondente, as migrations novas na ordem:

1. `20261011120000_studioflow_online_booking.sql`
2. `20261011121000_studioflow_manual_booking_variable.sql`

Depois publicar a aplicação pela integração existente. Não aplicar seed. A versão nova espera a RPC `book_public_appointment`; banco e código devem seguir essa ordem. Em 07/10/2026, após o pedido explícito de publicação, as duas migrations foram aplicadas ao Supabase do StudioFlow e verificadas: padrão TRUE, RLS preservada e RPC restrita a service_role. Não foi aplicado seed ou inserido dado de demonstração no banco remoto.
