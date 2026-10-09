# Administração e canais de atendimento

O painel dos estabelecimentos continua usando as tabelas, autenticação, agenda e regras de disponibilidade existentes. `/admin/login` mantém a sessão exclusiva da plataforma e a verificação em `platform_admins`; o menu dos clientes não contém entrada para a plataforma.

## Módulos e atualização

`platform_access.modules` é a fonte de autorização. `null` preserva os módulos de clientes antigos; `[]` desabilita todos os adicionais. Campos marcados em Plano e módulos liberados representam módulos disponíveis. O backend continua verificando o módulo em cada operação. O painel recarrega ao ganhar foco, ao voltar a ficar visível, a cada 30 segundos e ao receber uma notificação sem dados pelo BroadcastChannel após uma alteração no admin. Abas de configurações desabilitadas deixam de renderizar o formulário ativo.

## Cofre por estabelecimento

Admin → Estabelecimentos/Recepcionistas → Gerenciar → Cofre de IA cadastra Anthropic ou OpenAI, modelo e chave. Antes de salvar, verifica acesso ao modelo no provedor sem gerar uma conversa. O servidor cifra a chave com AES-256-GCM, chave derivada com HKDF e dados autenticados contendo estabelecimento e provedor. A API administrativa retorna apenas provedor, modelo, últimos quatro caracteres e data. `business_ai_credentials` tem escopo composto tenant/estabelecimento, RLS e nenhum acesso para anon/authenticated. `platform_save_ai_key` valida o administrador e audita a troca ou remoção sem registrar o segredo.

O runtime consulta a credencial do próprio estabelecimento. Sem chave própria, preserva a credencial Anthropic global existente. Credencial inválida, modelo não disponível, saldo insuficiente ou falha no provedor encaminham para a equipe. OpenAI usa Chat Completions com as mesmas ferramentas e validações de agendamento; o adaptador mantém chamadas/resultados e contabilização de tokens. As credenciais nunca são enviadas em prompts, exportações ou dados de workspace. Não mudar a chave de criptografia sem uma estratégia para recriptografar credenciais existentes.

## Evolution API e identidade por número

Admin → Recepcionistas → Servidor do WhatsApp configura o endereço HTTPS público e a chave global da Evolution API v2. Salvar verifica a autenticação em `fetchInstances` e só depois armazena a credencial cifrada. Se as variáveis `EVOLUTION_API_URL` e `EVOLUTION_API_KEY` estiverem presentes, elas mantêm prioridade e a tela indica administração pelo ambiente. Não há simulação de conexão real nem envio automático de mensagem durante a validação.

Configurações → Recepcionista reúne nome, regras da casa, limite diário, conexão por QR Code da loja e conexões dos profissionais. A instância da loja continua `sf-<businessId>` e usa `assistant_name`. Cada número individual usa `sf-pro-<professionalId>`, recebe um token de webhook próprio e tem vínculo persistido em `professional_whatsapp_links`, com chaves estrangeiras que impedem misturar tenants ou profissionais.

O webhook valida token e instância antes de receber mensagens. Históricos WhatsApp são separados por estabelecimento, cliente e profissional (`null` indica a loja). O runtime usa o nome cadastrado do profissional para identificar aquele canal, declara a assistência virtual quando perguntado e restringe as ferramentas e a criação à agenda do profissional vinculado. Respostas humanas voltam pela instância daquela conversa, nunca por outro número como fallback. A agenda valida disponibilidade novamente antes de gravar; preços, serviços e políticas vêm do cadastro. Negociações fora das regras existentes seguem para atendimento humano.

Para validar a operação real é necessário configurar um servidor Evolution API v2 acessível, cadastrar credencial/modelo com acesso e saldo e ler os QR Codes nos aparelhos autorizados. Os testes locais de contrato não conectam números reais nem substituem essa validação.

## Mensalidades

Admin → Pagamentos → Gerenciar → Pagamentos registra mensalidades manuais com valor, vencimento, método, período e observação. Registrar uma cobrança não conta como receita. Confirmar pagamento exige data não futura e permite escolher explicitamente se o acesso também deve ser renovado. A RPC privada valida administrador e estabelecimento, usa trava transacional e garante que a mesma cobrança paga só renove uma vez. Cobranças pendentes podem ser canceladas; pagamentos confirmados permanecem registrados. Registros do Asaas continuam inalterados e aparecem identificados separadamente no relatório. Datas de recebimento determinam a receita do período.

## Divulgação e recepção

Divulgar oferece link público quando habilitado e WhatsApp quando há número real cadastrado. Os textos, QR Codes, cartazes e imagens para Stories usam o canal selecionado. Com booking desativado, nenhum material sugere aquele link; check-in continua independente, conforme o módulo recepção.

A TV atualiza a agenda, mostra contagens de atendimento/check-in/clientes esperados/atendimentos concluídos e alterna páginas da fila a cada 15 segundos. Cada página se ajusta à altura disponível, com até seis clientes, evitando linhas cortadas na TV. Nomes são abreviados e não aparecem telefone, chave, financeiro ou observações privadas. Profissional fora do expediente não é anunciado como livre agora. Check-in informa a chegada sem afirmar que um aviso WhatsApp foi entregue.

Migration `20261011130000_customer_controls.sql`: tabelas operacionais novas, coluna opcional para identidade da conversa e substituição do índice único de conversa WhatsApp preservando todos os registros existentes. Não há exclusão de estabelecimentos, agendamentos, clientes, serviços ou configuração antiga. Novas tabelas possuem RLS e grants apenas para service_role; novas RPCs revogam execução pública.
