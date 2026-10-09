# n8n: consulta de catálogo e agenda

Endpoint: `POST /api/integrations/n8n/consultar`.

Autenticação: credencial Header Auth com nome `x-studioflow-integration-token`.
Use um token exclusivo, diferente do token do webhook n8n e da chave Anthropic.
O servidor guarda somente seu hash SHA-256 em `N8N_INTEGRATIONS`:

```json
[{"slug":"loja","businessId":"uuid","professionalId":"uuid","tokenHash":"64 caracteres hex"}]
```

O estabelecimento e o escopo do profissional são definidos no servidor.
Não permita que `$fromAI` preencha URL, credencial, estabelecimento ou token.
Acesso do plano e atendimento automático devem estar habilitados.
Respostas não incluem clientes, reservas existentes, telefones ou credenciais.
São consultas, sem chamadas a modelos e sem criação de agendamentos.

## Ferramentas HTTP Request no agente

URL fixa do aplicativo seguida pelo endpoint acima; método POST,
autenticação Header Auth, corpo JSON e resposta JSON.

Catálogo: nome `consultar_catalogo`, descrição “Consulte serviços, preços,
duração e IDs dos profissionais antes de recomendar ou consultar horários”.

```json
{"acao":"catalogo"}
```

Horários: nome `consultar_horarios`, descrição “Consulta horários reais para
serviços do catálogo e uma data específica. Não realiza reserva”. IDs devem
vir do catálogo; use datas exatas AAAA-MM-DD no fuso America/Sao_Paulo.

```json
{"acao":"horarios_livres","servicos":["id-do-catalogo"],"data":"2026-10-10","profissional":"any","periodo":"morning"}
```

Períodos: `all`, `morning`, `afternoon`, `evening`. O servidor aplica o escopo
do profissional mesmo quando a ferramenta solicita `any`. Retorna até três
horários. Sem vagas, retorna uma mensagem explícita; erro não significa vaga.

Dias alternativos (até três dias nos próximos 14 dias):

```json
{"acao":"dias_disponiveis","servicos":["id-do-catalogo"],"profissional":"any","periodo":"all","excluir_data":""}
```

Próximas vagas:

```json
{"acao":"proximos_horarios","servicos":["id-do-catalogo"],"periodo":"all"}
```

Limite por processo: 20 consultas/minuto por IP. Respostas `no-store`.
Reconsulte a disponibilidade antes de reservar através do fluxo de reservas.

## Limite desta etapa

Esta API não aceita `agendar` nem qualquer mutação. O fluxo n8n continua em
teste, sem envio de WhatsApp. Antes da produção, implementar autorização de
reserva baseada no cliente verificado e sua escolha, idempotência, controle
de intervenção humana e um único responsável pelas respostas. A memória de
teste `studioflow-teste` não deve ser usada em produção. A integração de
entrada deve preservar o histórico e os controles do StudioFlow.
