# Administração ampliada

O painel mantém `/admin/login`, a sessão exclusiva do admin e o mesmo usuário já autorizado. A identidade visual, os planos, os módulos, as liberações, as anotações e os controles dos canais foram preservados.

## Áreas do painel

- **Visão geral:** atividade dos estabelecimentos, recebimentos das lojas, recebimentos das mensalidades do StudioFlow, pendências, origens dos agendamentos, comparação por estabelecimento e distribuição de planos.
- **Estabelecimentos:** busca existente, filtros combinados de situação/plano/canais, ordenação por atividade/IA/recebimentos, 25 registros por página e relatório CSV de todos os registros filtrados.
- **Recepcionistas:** estado registrado do WhatsApp, configuração dos provedores, módulo contratado, acesso do estabelecimento, clientes/agendamentos da IA, conversas, fila humana, recebimentos atribuídos e uso em respostas/tokens. Gerenciar abre os controles existentes.
- **Cobranças:** faturas já registradas no Asaas da plataforma, filtros por estado/estabelecimento, paginação e CSV. Esta área é de acompanhamento; não gera cobranças, não marca pagamentos e não envia lembretes.
- **Histórico:** últimas 50 mudanças de acessos, planos e canais no período, com filtros e acesso ao histórico individual existente.

Todos os indicadores podem seguir Hoje, Este mês, 30/90 dias ou um intervalo personalizado de até 366 dias. A tela mantém o período da última consulta concluída quando uma atualização falha e ignora respostas antigas que chegam depois de outra consulta.

## Semântica financeira

**Mensalidade combinada** soma preços dos acessos ativos. **Recebido pelo StudioFlow** soma faturas pagas pela data efetiva do pagamento, no calendário de São Paulo. **Em aberto/vencido** é a situação atual das faturas pendentes, independente do período. Vencimento hoje ainda não é atraso.

A lista de faturas inclui registros emitidos ou pagos no período e todas as faturas pendentes. Faturas canceladas não compõem recebimentos ou dívida. Pagamentos sem data não são atribuídos a um período inventado. Os registros são paginados no backend para evitar totais truncados pelo limite de linhas do PostgREST.

Recebimentos dos estabelecimentos permanecem separados da receita do StudioFlow. Lucro líquido das lojas exige custos operacionais e não é calculado. As origens antigas permanecem sem atribuição confiável; não se inventa histórico da IA. Não é mostrado um percentual de conversão sem vínculo comprovado entre conversa e agendamento.

## Segurança e limitações

As consultas adicionais usam `requirePlatformAdmin` e o cliente de servidor; as tabelas existentes de faturas e auditoria continuam sem acesso para usuários comuns. Não há nova migration, nova conta admin ou concessão de privilégios. Não são retornadas mensagens de clientes, documentos fiscais, chaves ou identificadores internos do provedor de cobrança.

Se cobranças/histórico não puderem ser consultados, o admin informa a falha, sem transformar ausência de dados em receita zero nem impedir uma alteração autorizada nos canais. O relatório CSV usa BOM, separador de ponto e vírgula, números brasileiros e neutralização de fórmulas em campos de texto.

O estado “Pronta para atender” indica acesso/módulo/provedores configurados e conexão registrada como aberta; não é um teste ativo do serviço externo. Evolution API e IA continuam dependendo das credenciais e da conexão real descritas em `admin-receptionist-control.md`.

## Verificação

Testes adicionais cobrem fronteiras de pagamento no fuso de São Paulo, centavos, faturas canceladas/vencidas, independência do link e recepcionista, requisitos de conexão, agregações, rankings e proteção do CSV. Smoke HTTP valida dados de monitoramento, histórico, período personalizado e datas inválidas, além das rotinas existentes. Fixtures e simulações são exclusivamente locais e são removidas após a revisão.
