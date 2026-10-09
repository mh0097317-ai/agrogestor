# Próxima etapa: canais e recepcionista comercial

Planejamento aprovado conceitualmente pelo proprietário do projeto. Este documento não implementa a próxima etapa nem declara os canais existentes prontos para produção.

## Canais por estabelecimento

Configurações → Canais de agendamento deve apresentar dois modos: **Link + WhatsApp** e **Somente WhatsApp**. O primeiro mantém o booking público e o atendimento pelo WhatsApp; o segundo desativa o booking público e usa o WhatsApp como canal oficial de atendimento externo. Não criar outro fluxo externo substituto, remover o código público ou trocar slug/token. A agenda interna continua independente.

A opção `online_booking_enabled` controla somente o site. Conexão WhatsApp, habilitação da recepcionista e limites comerciais são configurações separadas, com escopo do estabelecimento. O modo exibido deve refletir a conexão e a habilitação reais; não anunciar atendimento automático disponível quando o WhatsApp estiver desconectado. Revisar as integrações já presentes antes de acrescentar componentes.

## Fluxo pretendido

Cliente → WhatsApp do estabelecimento → StudioFlow → recepcionista IA → ferramentas do StudioFlow → agenda real → confirmação pelo WhatsApp. O cliente não precisa de aplicativo novo nem conta StudioFlow.

A recepcionista identifica intenção, serviço e profissional usando o catálogo real. Resolve datas e horários no fuso do estabelecimento, pergunta quando há ambiguidade e calcula duração dos serviços selecionados pelo motor existente. Sugere apenas horários consultados. Na escolha do cliente, o servidor revalida disponibilidade e permissões na transação de criação; confirma sucesso somente depois do commit. Em conflito, consulta opções novamente. Prevenir reservas e respostas duplicadas com idempotência de mensagens e operações.

Ferramentas controladas: buscarServicos, buscarProfissionais, buscarCliente, buscarHorariosDisponiveis, criarAgendamento, remarcarAgendamento e cancelarAgendamento. O servidor deriva tenant/business da conexão WhatsApp verificada, nunca de IDs fornecidos pela IA ou pelo cliente. Identificação e autorização para consultar/alterar reservas devem evitar acesso a reservas de outras pessoas. O canal WhatsApp não depende da habilitação do booking público.

## Objetivo e autonomia

Objetivo: conduzir a conversa até um agendamento quando fizer sentido, com linguagem natural e respeitando a decisão do cliente. Consultar horários antes de oferecê-los, inclusive em respostas sobre preço. Explicar serviços, sugerir alternativas de profissional/horário e oferecer serviços adicionais ou combos reais e habilitados pelo dono.

Configurações por estabelecimento: responder sobre informações cadastradas; consultar preços/disponibilidade; criar/remarcar/cancelar; sugerir alternativas e combos; negociar desconto até X%; conceder benefício até R$ X; recuperar desistências; fazer contraproposta; encaminhar para humano. Cada capacidade deve ser verificável no servidor e independente da instrução em linguagem natural. Não inventar fatos, preços, benefícios, combos, encaixes ou descontos. Encaixe exige disponibilidade válida ou autorização humana específica; não contorna as regras de conflito.

Descontos e benefícios exigem políticas estruturadas e cálculo determinístico no backend, em centavos, com base no preço real, limites por operação e regras explícitas de combinação. Não confiar em valores ou percentuais calculados pela IA. Persistir preço original, condição aprovada e valor final nos registros históricos apropriados, preservando financeiro, sinal, comissão e regras de clube. Antes de implementar, decidir como descontos percentuais e benefícios monetários se combinam e qual é o limite cumulativo.

Exemplo: serviço de R$80 com teto automático de 10% permite proposta de R$72; R$60 exige aprovação. Condição acima do limite gera solicitação no painel: Aprovar / Fazer contraproposta / Assumir conversa. Autorização humana deve estar ligada à proposta, cliente e estabelecimento, ter validade e ser revalidada antes do uso. Até aprovação, não prometer a condição nem declarar reserva criada. Uma retenção temporária de horário só pode existir por regra explícita, com expiração.

## Registros e painel

Registrar operações, propostas, descontos, benefícios, aprovações, encaminhamentos e resultado das ferramentas com estabelecimento, conversa, identidade do ator e correlação com o agendamento. Histórico auditável deve permitir entender o que foi oferecido e efetivamente aplicado. Limitar acesso por membership/RLS e não registrar credenciais.

Painel pretendido: recepcionista ativa/desativada, WhatsApp conectado, conversas hoje, agendamentos realizados, clientes aguardando humano, consumo mensal, vendas e descontos concedidos. Métricas comerciais devem ter definições verificáveis: agendamento criado não equivale a receita recebida; recuperação exige critério explícito; descontos devem vir dos valores persistidos. Não fabricar indicadores nem atribuir automaticamente toda receita à IA.

## Sequência de implementação futura

1. Auditar integrações existentes, identidade da conexão, segurança, disponibilidade, ações e dados comerciais.
2. Consolidar configuração dos canais e contratos das ferramentas com isolamento, validação, idempotência e auditoria.
3. Entregar criação/remarcação/cancelamento no WhatsApp com atendimento humano e testes de concorrência.
4. Acrescentar políticas comerciais, propostas e aprovação humana com regressão de financeiro/clube/sinal/comissão.
5. Entregar painel e métricas com critérios documentados; validar em ambiente de teste antes da publicação.

Critérios de aceite: informações reais; nenhum horário confirmado sem revalidação; nenhum desconto acima dos limites sem aprovação; nenhuma operação entre tenants; ausência de duplicações em reentrega de mensagens; agenda atualizada após commit; histórico das ações; escalonamento humano; ambos os modos funcionando independentemente do motor de reservas.
