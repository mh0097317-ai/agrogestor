# Atendimento WhatsApp StudioFlow → n8n

O módulo `n8n-whatsapp-contract.ts` prepara e valida o envelope. O transporte
`n8n-whatsapp.ts` está ligado ao processamento de conversas, desativado por
padrão. O seletor servidor `N8N_WHATSAPP` habilita apenas o estabelecimento e
profissional exatos configurados. Ausência de configuração mantém o motor atual.

A Evolution continua entregando ao endpoint do StudioFlow. O processamento
carrega conversa e mensagens do repositório com escopo de negócio, dentro da
lease existente. Somente mensagens pendentes de cliente em conversa WhatsApp
em estado `ai` formam o turno. Plano, escopo profissional, orçamento diário,
interpretação do assunto e intervenção humana permanecem no StudioFlow.

## Envelope v1

```json
{
  "version": 1,
  "event": "STUDIOFLOW_WHATSAPP_TURN",
  "test": false,
  "requestId": "hash SHA-256 do turno, calculado pelo backend",
  "sessionId": "studioflow:businessId:professionalId-ou-business:conversationId",
  "context": {
    "businessId": "ID validado pelo servidor",
    "professionalId": "ID validado pelo servidor ou null",
    "conversationId": "ID interno da conversa",
    "channel": "whatsapp",
    "timezone": "America/Sao_Paulo",
    "bookingAllowed": false
  },
  "message": {
    "text": "mensagens pendentes do cliente, agrupadas em um turno",
    "ids": ["IDs das mensagens armazenadas no StudioFlow"],
    "createdAt": "2026-10-09T12:54:00.000Z"
  }
}
```

Não contém telefone, credenciais ou endereço de destino da resposta. Os IDs de
message.ids são das linhas armazenadas, não supostos IDs wamid da Evolution.
O remetente real fica no backend, que usa o send já existente. O texto continua
sendo conteúdo potencialmente pessoal: ativar seu envio ao n8n exige autorização
e configuração explícita. Os campos de contexto são metadados de correlação;
não autorizam consultas ou mutações. A API de consulta usa sua própria credencial.

Autenticação da ponte: header `x-studioflow-n8n-token` na URL fixa do workflow,
com o token exclusivo do Webhook (não a chave do sandbox nem a de catálogo).
A proteção Basic Auth do Caddy também precisa ser fornecida pelo transporte
servidor. Nunca incluir os headers ou segredos no Edit Fields, no prompt ou nos logs.

## Configuração do n8n

- Edit Fields: messageText = `$json.body.message.text`;
  sessionId = `$json.body.sessionId`; requestId = `$json.body.requestId`;
  isTest = `$json.body.test === true`. Preservar somente esses campos.
- Validar version/event e os identificadores antes do AI Agent. Se faltarem,
  responder erro e não chamar IA. Testes STUDIOFLOW_TEST precisam de uma rota
  de teste explicitamente separada; não usar a sessão fixa como fallback real.
- Simple Memory: usar o sessionId dinâmico. Memória simples permanece apropriada
  apenas ao piloto; o histórico persistente e a recuperação exigem desenho próprio.
- Manter as duas ferramentas de consulta e a proibição de reservas.
- Haiku 4.5, máximo de 300 tokens de saída, até 3 iterações do agente, retries
  automáticos desativados e janela de memória 4. Testar uma chamada completa
  antes de habilitar tráfego. `supplyData` em teste isolado não prova execução.
- Webhook: trocar Respond Immediately por Using Respond to Webhook Node.
- Depois do AI Agent, retornar status 200 e JSON usando Respond to Webhook.

```json
{
  "version": 1,
  "requestId": "copiar do Edit Fields, não pedir para a IA gerar",
  "sessionId": "copiar do Edit Fields, não pedir para a IA gerar",
  "output": "texto de saída do AI Agent",
  "handoff": false,
  "bookingPerformed": false
}
```

Esse retorno é uma proposta de resposta. O backend verifica forma e correlação,
estado da conversa, cursor e validade da lease antes de usar o sender existente.
Preços e consultas de horários com parâmetros estruturados são respondidos com
dados recarregados pelo backend, substituindo o texto comercial proposto. Sem
parâmetros verificados, preços/horários explícitos são recusados. Afirmações de
reserva são recusadas; pedidos de reserva/alteração são encaminhados à equipe.
A verificação de texto é conservadora, não uma prova semântica completa.

## Condições antes de ativar

Configuração servidor (segredos nunca em Git, interface pública ou logs):

```json
[
  {
    "businessId": "UUID",
    "professionalId": "UUID-ou-null",
    "token": "token-exclusivo-do-webhook",
    "basicUser": "usuario-Caddy",
    "basicPassword": "senha-Caddy"
  }
]
```

O StudioFlow mantém a etapa de interpretação de assunto/consentimento com sua
chave de IA atual. O n8n substitui somente o motor que gera a resposta, portanto
não é uma operação sem custo nem remove a necessidade da chave interna.
Não há execução paralela nem fallback após timeout. Antes do POST o backend
persiste estado `SENDING` e requestId; recuperação não repete a chamada incerta.
Falhas passam silenciosamente para a equipe. A requisição tem no máximo 45s e
se ajusta ao tempo restante da lease; redirects e respostas acima de 16KB são
recusados. A resposta enviada é salva no histórico persistente do StudioFlow.

O limite diário de turnos se aplica. O contrato atual não retorna o consumo do
provedor; as métricas de tokens do StudioFlow medem somente a interpretação
interna, sem inventar consumo externo. O registro do turno identifica o motor
n8n. Acompanhar o consumo externo nas execuções do n8n e a cobrança na Anthropic.
Os limites de saída/iterações do workflow reduzem esse consumo, mas não são um
teto monetário nem impedem que créditos acabem.

A API de agendamento não foi criada. Memória simples pode perder contexto ao
reiniciar o n8n; o histórico persistente continua no StudioFlow, mas não é
recarregado automaticamente na memória n8n neste piloto. Validar publicação e
uma execução com conteúdo sintético antes de habilitar a configuração servidor.
requestId estável facilita correlação; o bloqueio de recuperação evita reenvio
automático pelo backend, mas não deduplica chamadas feitas diretamente ao n8n.
Reverter: remover somente a entrada desse escopo de `N8N_WHATSAPP`, redeploy e
retomar manualmente conversas pendentes com a equipe após conferir o WhatsApp.
