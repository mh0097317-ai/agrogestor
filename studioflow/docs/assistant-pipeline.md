# StudioFlow: atendimento por WhatsApp

O canal da loja e cada canal de profissional usam o mesmo fluxo, sempre limitado
ao estabelecimento e, no canal individual, aos serviços do profissional conectado.

1. O webhook autenticado ignora mensagens próprias, grupos, reações e protocolos.
   O identificador do provedor evita armazenar/transcrever a mesma mensagem novamente.
2. Áudios são transcritos com a credencial criptografada do estabelecimento. Uma
   transcrição indisponível nunca é tratada como se o áudio tivesse sido entendido.
3. Mensagens próximas são agrupadas antes de adquirir a trava da conversa.
4. O interpretador recebe o pedido e as últimas seis mensagens visíveis da mesma
   conversa. Extrai intenção, estágio, serviço, profissional, dia/horário, dados
   faltantes, confiança e próxima ação. O JSON e os IDs são validados no servidor.
   Assuntos pessoais explícitos e conversas sem contexto comercial ficam em silêncio.
5. O agente recebe a interpretação validada e o contexto. Ele pergunta apenas o que
   falta, usa o catálogo real e consulta ferramentas para disponibilidade. Uma
   interpretação não autoriza inventar preços, descontos ou agendar sem confirmação.
   Perguntas simples sobre serviço, dia ou nome faltante são compostas a partir da
   interpretação válida, sem uma segunda chamada paga ao modelo e sem ferramentas.
6. A validação de linguagem permite uma única reescrita de respostas genéricas ou
   longas. A reescrita não recebe ferramentas e não pode repetir um agendamento.
7. O envio ocorre com a trava ainda ativa. A resposta é registrada como enviada
   somente depois de a Evolution aceitar o envio. Aceitação não comprova leitura
   nem entrega no aparelho. Envio com resultado incerto exige conferência humana;
   não é reenviado automaticamente, para evitar duplicações.

`assistant_runs` registra o cursor, estado, interpretação, tentativas e código
seguro de falha. As tabelas operacionais e de credenciais têm RLS, acesso exclusivo
do backend e chaves estrangeiras que impedem cruzar tenants/conversas.

O scanner autenticado recupera mensagens ainda pendentes após reinício/timeout.
Falhas temporárias permitem até três tentativas por cursor. Limite diário, acesso
ao plano, módulo, atendimento ligado e controle humano são verificados novamente.
O scanner não reabre conversas fechadas, não envia campanhas nem faz follow-up.
Um agendamento já gravado para o pedido pendente também interrompe a repetição:
a equipe confere a agenda e confirma ao cliente, sem criar outro horário.
Uma falha de envio não é repetida automaticamente porque a Evolution pode ter
aceitado a mensagem mesmo sem devolver a confirmação ao StudioFlow.

Em Conversas, **Analisar e responder** recupera explicitamente o último pedido
sem resposta, de até 24 horas, mesmo quando o atendimento ficou com a equipe ou
foi encerrado. Relê as últimas seis mensagens visíveis da mesma conversa e agrupa
o pedido pendente. O filtro de assunto continua ativo: solicitar análise não
autoriza responder conversas pessoais. Retomar StudioFlow continua dedicado às
próximas mensagens, sem reproduzir pedidos atendidos pela equipe.

`request_assistant_analysis` trava a conversa e verifica novamente tenant,
última mensagem, envio incerto, agendamento já gravado, atendimento ligado e quota.
Enfileira a tentativa duravelmente, reiniciando apenas o contador de tentativas
daquele pedido. Não altera uso diário, créditos, configuração global ou histórico.
O callback inicia o processamento e o scanner recupera a fila se ele for interrompido.
Uma solicitação repetida durante processamento/fila é recusada. O backend verifica
também chave configurada e conexão do canal antes de aceitar a solicitação.
O painel mostra confirmação, progresso e diagnóstico seguro em caso de falha.
Saldo/chave inválidos no provedor exigem correção e nova solicitação; o botão
não contorna esses limites. O funcionamento publicado independe do limite do Codex.

Áudio: Groq (`whisper-large-v3-turbo`) ou OpenAI (`whisper-1`), com campo separado
no cofre administrativo de cada cliente. A chave Anthropic continua responsável
pela conversa. Sem a credencial de transcrição não há compreensão de áudio.

Este fluxo atende serviços e agendamentos. Estoque, entrega, pedidos de produtos,
negociação automática de desconto e memória comercial permanente não são
implementados como se já existissem no domínio da barbearia. Os limites financeiros
e o banco continuam sendo a autoridade para as ações executadas pelas ferramentas.
