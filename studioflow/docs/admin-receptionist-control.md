# Controle dos estabelecimentos e recepcionista

O administrador existente entra em `/admin/login` com sua conta atual. Em **Gerenciar → Canais de agendamento**, controla o link público e a recepcionista independentemente por estabelecimento. Ações são autorizadas no servidor e registradas atomicamente em `platform_channel_events`. O administrador acompanha agregados; não recebe listas de clientes, mensagens ou tokens de agendamento e não assume a operação da agenda das lojas.

## Indicadores reais

Hoje, mês atual, últimos 30 ou 90 dias, no calendário de São Paulo. A API também aceita `from` e `to`, com até 366 dias. Agendamentos/clientes seguem a criação da reserva; concluídos seguem a data do serviço; recebimentos seguem a data do pagamento. Cancelados são separados. Vendas de produtos pagas entram no recebido total, sem se misturar ao recebido de agendamentos da IA.

Cada reserva nova tem uma origem gravada na mesma transação: `public_link`, `assistant_web`, `assistant_whatsapp`, `assistant_instagram` ou `manual`. Reservas existentes são `legacy`, pois não há evidência confiável para reconstruir sua origem. Assim, os números atribuídos à IA começam nesta implantação, e não são inventados a partir de texto de conversas.

Recebido é dinheiro registrado, valor agendado pode estar em aberto, e mensalidade contratada é a receita combinada do StudioFlow. **Lucro líquido não é calculado**: o banco não registra todos os custos operacionais das lojas. Consumo de IA mostra turnos e tokens reais, não uma cobrança estimada em reais.

## WhatsApp pela Evolution API v2

Reaproveita o adaptador existente: uma instância `sf-<businessId>` por loja, QR Code em Configurações → WhatsApp, acompanhamento do estado da conexão, mensagens e áudio, resposta pela mesma instância. A instância do WhatsApp do StudioFlow para cobranças continua separada.

Novas conexões habilitam explicitamente o webhook e usam um segredo aleatório por loja no cabeçalho `x-studioflow-webhook-token`; só o hash fica no banco. URLs de conexões antigas continuam aceitas. Instance/tenant incorretos, grupos, listas de transmissão, mensagens da própria loja e mensagens já recebidas são descartados. Falhas de envio são registradas e encaminhadas à equipe.

No servidor da Vercel, configure os segredos pelo painel de variáveis, nunca pelo código ou pelo chat:

- `EVOLUTION_API_URL`: endereço HTTPS de um servidor Evolution API v2 acessível pela Vercel.
- `EVOLUTION_API_KEY`: chave de acesso a esse servidor.
- `ANTHROPIC_API_KEY`: chave do provedor de IA já usado pelo projeto.
- `STUDIOFLOW_ASSISTANT_MODEL`: opcional, ID fixo do modelo; mantém o modelo existente por padrão.
- Variáveis `TRANSCRIBE_*`: opcionais para áudios, já suportadas.

Depois da configuração, faça novo deploy, libere o módulo Recepcionista no plano, ative a recepcionista e conecte o WhatsApp da loja lendo o QR. O admin informa quando a configuração ou conexão ainda falta. Não gera um QR fictício em produção. A hospedagem do servidor Evolution e a contratação do provedor são externas a esta mudança.

## Comportamento da IA

Prioriza concluir o agendamento na conversa: serviço real → preferência de profissional/dia → horários consultados → escolha e confirmação → reserva validada novamente no backend. Só mostra link público se solicitado e ativado. A ferramenta de link também valida a configuração atual no servidor, mesmo com histórico antigo.

Mensagens curtas, naturais, uma pergunta por vez, sem se passar pelo barbeiro. Não inventa preços, promoções ou horários, não dá descontos sem uma política autorizada e não promete confirmação antes de a reserva retornar. Pode sugerir alternativas reais e acionar o humano. Pagamentos/sinais e comprovantes continuam no fluxo existente.

`book_tracked_appointment` reutiliza o motor atual e as suas regras de disponibilidade/pagamento, verifica o escopo da conversa e o estado da recepcionista e mantém a proteção do link público. Rotinas internas permanecem disponíveis.

## Migração e validação

Migration criada pelo CLI e ordenada após as migrations existentes (alguns arquivos do repositório possuem datas futuras): `20261011121001_admin_receptionist_control.sql`. Apenas adiciona colunas, tabela de auditoria, índices e RPCs restritas a `service_role`; mantém RLS existente, slugs, tokens, dados e rotinas compartilhadas.

O construtor de reservas manuais em `workspace_mutation` passa a preencher a origem obrigatória e preserva a origem/conversa ao editar uma reserva. O corpo anterior foi comparado com produção antes da substituição; assinaturas e regras existentes foram mantidas. Chamadas antigas ao motor neutro permanecem `legacy` durante a publicação, evitando atribuição inventada numa implantação gradual.

Advisors em produção: a [tabela de auditoria com RLS sem política](https://supabase.com/docs/guides/database/database-linter?lint=0008_rls_enabled_no_policy) é intencionalmente acessível apenas ao servidor, sem permissões para `anon` ou `authenticated`. A verificação também apontou a [proteção contra senhas vazadas desativada](https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection), configuração preexistente de autenticação que não foi alterada nesta entrega.

Testes com PostgreSQL local verificam autorização, auditoria, isolamento, bloqueio público, reserva pelo WhatsApp e agregação financeira. O cliente HTTP Evolution é validado contra um servidor local de contrato, sem usar números de clientes nem enviar mensagens reais. A validação ponta a ponta com QR e resposta de IA em um WhatsApp real depende das credenciais externas configuradas.
