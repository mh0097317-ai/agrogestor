# Controle geral de IA e atendimento

A chave geral do admin bloqueia atendimento por IA, geração de Marketing,
piloto automático do Marketing e rascunhos de e-mail por IA. Cada módulo ainda
precisa de suas próprias configurações e credenciais válidas. A chave geral
não copia credenciais nem retoma conversas assumidas por uma pessoa.
Confirmações, lembretes, envio normal de e-mails e PDFs seguem suas regras
de envio, independentemente do uso de IA.

## Lembretes de agendamento

O job existente `/api/cron/appointments`, chamado a cada cinco minutos, consulta
`due_staged_appointment_reminders`: 12h, 2h e 1h antes, com janela de recuperação
de 15 minutos em cada etapa. Só entram reservas confirmadas, com consentimento
para lembretes, notificações habilitadas e criadas há pelo menos dez minutos.
Contas sem acesso ou sem remetente conectado não enviam.

`appointment_reminder_steps` registra a tentativa atomicamente por reserva,
início e etapa. A etapa de 2h compartilha o registro legado com n8n para evitar
duplicações. Falhas ou envios com aceitação incerta não são repetidos
automaticamente. O aviso WhatsApp legado de 24h foi desativado; e-mails não
foram alterados. A tabela é acessível somente ao backend, com RLS habilitada.

## Escolhas no WhatsApp

As opções usam catálogo e agenda reais da empresa e preservam a restrição de
profissional do número conectado. Escolher um horário apenas pede revisão e
confirmação; não cria uma reserva. A disponibilidade é revalidada.

Meta Cloud usa listas interativas. No conector Evolution QR, o padrão é texto:
`STUDIOFLOW_WHATSAPP_NATIVE_LISTS` só deve ser `true` após um teste real no
telefone. O servidor 2.3.7 rejeitou o teste controlado com HTTP 400. O fallback
para texto ocorre apenas após rejeição explícita; timeouts não provocam um
segundo envio. Não atualizar o servidor apenas para habilitar essa flag sem
backup, validação de compatibilidade e teste de renderização.

## Consulta cadastral

Em Configurações, um novo CNPJ válido inicia a consulta após uma pausa de
digitação. O botão permite tentar novamente. A rota exige usuário autorizado
da empresa, limita requisições e consulta a BrasilAPI/Minha Receita. Retorna
somente CNPJ, razão social, nome fantasia, endereço e telefone; não expõe
quadro societário ou CPF. Preenche apenas campos vazios, para revisão antes
de salvar. A consulta não importa fotos; a busca no Maps é um link separado.
