# Redesign editorial — validação local

Revisão de 2 de outubro de 2026. Escopo: experiência visual e operacional existente, preservando contratos das APIs, banco e dados da BARBER 011.

## Organização entregue

- Controles compartilhados para indicadores, cabeçalhos, seções de formulário, estados vazios e painéis de detalhes com foco contido.
- Início separado em apresentação, agenda e cálculos; agenda separada em timeline, períodos, lista mobile, formulário e detalhes.
- Catálogo público e informações do estabelecimento em componentes próprios. Agendamento mantém cinco etapas e CSS dividido por responsabilidade.
- CRM separado em lista, perfil e editor. Regra de retorno compartilhada com o Início, baseada no histórico e com tolerância de 50%.
- Gestão com estilos específicos de catálogo, equipe, financeiro e configurações. Financeiro e relatórios compartilham cálculo por período e controles de data.
- Ações da interface seguem os papéis existentes do servidor. Segurança e confirmação de disponibilidade continuam no servidor.

## Verificações realizadas

`npm run lint`, `npm run typecheck`, `npm test` e `npm run build` concluíram com código de saída zero. O build Webpack compilou em 19,9 segundos e gerou as 17 páginas estáticas. Os testes automatizados passaram: 24 casos, sem falhas. Cobrem disponibilidade durante o intervalo completo, expediente, pausas, bloqueios, buffer, profissional habilitado, telefone brasileiro, concorrência, isolamento, RLS, RPCs PostgreSQL, pagamentos parciais, centavos, comissões estimadas, períodos de São Paulo, métricas do painel e permissões.

O smoke HTTP cria e remove seu próprio estabelecimento de teste. Foram verificados onboarding, projeção pública, isolamento, reserva simultânea, comprovante, edição de serviço, início e conclusão, pagamento parcial, rejeição de excedente, reagendamento e cancelamento.

No navegador, um estabelecimento de teste separado foi usado para a reserva completa. Após ocupar o horário escolhido por outra requisição, o fluxo voltou ao calendário, preservou nome e WhatsApp e permitiu nova confirmação. Reagendamento e cancelamento foram executados pela interface e conferidos no servidor. Os arquivos desse estabelecimento temporário foram removidos; a BARBER 011 foi usada somente para consultas e rascunhos sem salvamento durante essa revisão.

Financeiro e relatórios foram comparados em “Este mês” e “Hoje”: os recebimentos da demonstração passaram de R$ 305 para R$ 165, acompanhados por listas, meios de pagamento e estimativas de comissão. Um período sem dados apresentou zero e estado vazio; um intervalo invertido apresentou validação. O atalho “Ver agenda” de Lucas abriu a agenda com esse profissional selecionado.

O painel de detalhes foi verificado com Tab/Shift+Tab, Escape e retorno de foco. O onboarding preservou o nome ao voltar. Configurações preservou um rascunho de Empresa ao ir para Identidade e voltar, cancelou o descarte por Escape e restaurou os dados salvos após confirmação. A saída pelo menu apresentou confirmação; “Continuar editando” manteve o rascunho. Nenhuma dessas alterações foi salva na BARBER 011. A implementação inclui alvos de toque de 44px, foco visível e suporte a movimento reduzido. A revisão por viewport não substitui teste de teclado virtual em dispositivo físico.

## Preview e recuperação

O preview local usa Next.js com Webpack, fonte local e processo persistente na porta 3000. A compilação inicial e recompilações explicavam parte da espera observada; o log diferencia compilação e execução. O GET do workspace informa `Server-Timing`, sem mudar o corpo da API.

Na medição local durante esta revisão, Agenda respondeu em 149ms, Serviços em 103ms e workspace em 116ms (22,2ms na operação do servidor). O Início levou 1.452ms após recompilação. Esses valores descrevem o ambiente local nesse momento, não representam um SLA de produção.

Consultas do painel têm prazo de 15 segundos, mensagem de falha e nova tentativa; atualizações preservam os dados anteriores. Consultas públicas usam prazo de 20 segundos e preservam o catálogo anterior. Mutações não são repetidas automaticamente após espera, evitando reservas ou pagamentos duplicados.

## Evidências

Capturas reais e 72 medidas do navegador estão em `.data/editorial-*.jpg` e `.data/editorial-responsive.json`. Foram usados 375, 390, 430, 768, 1024 e 1440px em Início, Agenda, Página pública, calendário de reserva, onboarding, acesso, Clientes, Serviços, Equipe, Financeiro, Relatórios e Configurações. Nenhuma verificação final apresentou largura de rolagem maior que a largura útil. O aceite registra largura efetiva, largura útil e largura de rolagem, com o conteúdo conferido pela árvore de acessibilidade e capturas; o título também foi registrado quando disponível.

## Piloto de produção

Ainda requer projeto Supabase dedicado, configuração e validação remota de Auth/SMTP, convites e seleção de empresa, Storage, consultas paginadas, rate limit compartilhado e auditoria remota de isolamento e concorrência. Cobrança e lembretes automáticos de WhatsApp pertencem à etapa comercial posterior. Teclado virtual e instalação PWA em dispositivo físico também seguem pendentes. Nenhum Supabase remoto foi alterado nesta entrega.
