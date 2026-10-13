# Relatórios semanais em PDF

Relatórios oferece download da semana anterior (segunda a domingo, horário de
Brasília) para o dono e para cada profissional. O profissional autenticado
acessa apenas seu próprio relatório. A gestão configura o WhatsApp do dono e
pode incluir os profissionais ativos com telefone cadastrado. Envios começam
desativados até o cadastro e ativação explícita no painel.

O PDF da loja soma recebimentos de serviços pela data do pagamento e vendas de
produtos pagas. Não trata o preço da agenda como dinheiro recebido. O PDF
individual inclui somente atendimentos e recebimentos ligados ao profissional,
sem vendas globais de produtos. Comissões são estimadas com a taxa atual,
não comprovam liquidação. Despesas e mensalidades do clube ficam fora destes
totais. A comparação de comparecimento usa concluídos e faltas explícitas.

O admin tem uma terceira versão com mensalidades recebidas, carteira atual,
cadastros da semana e valores atualmente em atraso. Não soma a receita das lojas
à receita da plataforma. Download e configurações exigem requirePlatformAdmin.
O envio automático desta versão usa exclusivamente o WhatsApp próprio StudioFlow,
conectado na área administrativa, nunca o canal de um cliente.

O scheduler autenticado de agendamentos, já executado a cada cinco minutos,
inicia a geração às segundas a partir das 09h America/Sao_Paulo. A janela de
recuperação vai até 09h59. Cada chamada tenta no máximo três novos PDFs de lojas,
mais o PDF da plataforma; a carteira examinada é limitada a cem configurações.
Para carteiras maiores, ampliar a fila e capacidade antes de prometer a mesma
janela a todos. Atendimentos/avisos existentes rodam independentemente do resultado
do relatório semanal. Não há chamadas de IA para gerar estes documentos.

Cada tentativa consome uma chave única por loja/semana/destinatário, ou por semana
no caso da plataforma. Uma falha de geração ou envio fica registrada e não é
repetida automaticamente. Envios incertos exigem revisão para evitar documentos
duplicados. Um canal desconectado não consome a chave, permitindo recuperação na
janela se a conexão voltar. Aceitação pelo WhatsApp não comprova leitura.

PDFs são gerados em memória e enviados como documento privado, em base64, pela
Evolution. Não existem URLs públicas dos relatórios. As quatro tabelas de
preferências e recibos têm RLS e acesso exclusivo de service_role; APIs validam
sessão, escopo da loja/profissional e papel administrativo antes da consulta.

Verificação: testes de datas/fuso, escopo profissional, dinheiro recebido,
assinaturas, deduplicação, envio incerto e paginação do PDF. Validação visual com
renderização das seis páginas e conferência de margens/texto. Teste real autorizado
em 13/10/2026 enviou os PDFs da loja e do profissional ao número terminado em
4376; o canal da plataforma estava desconectado. Não ativou recorrência de teste.
