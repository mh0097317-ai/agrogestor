# Administração da plataforma

O acesso administrativo passa a usar `/admin/login`, com o e-mail e a senha da conta já cadastrada e autorizada em `platform_admins`. A pedido do proprietário, não foi criada outra conta nem alterada a senha existente. Nenhum usuário novo foi promovido a administrador.

A sessão do admin usa cookies próprios (`studioflow-platform-auth`, incluindo os chunks do Supabase), HttpOnly, SameSite=Lax e Secure em produção. Login de estabelecimento não autoriza as rotas administrativas. O proxy renova somente a sessão pertinente à rota; páginas e APIs administrativas também validam o usuário no Supabase e a autorização em `platform_admins` no servidor. Não há senha compartilhada, segredo embutido no frontend ou autorização por `user_metadata`.

`POST /api/admin/login` valida origem e campos, aplica o limitador existente e autentica a senha pelo Supabase. Uma conta sem autorização administrativa tem a sessão recém-criada revogada. Login não cria usuários ou concede privilégios. `POST /api/admin/logout` encerra somente essa sessão, sem apagar o login de estabelecimento; a saída do estabelecimento também usa escopo local. O bypass de demonstração permanece limitado ao desenvolvimento sem Supabase, nunca ao build de produção.

O painel mantém planos/módulos, mensalidades, liberações, datas de acesso, pausa, anotações, histórico e WhatsApp da plataforma. Ganham destaque a atividade em 30 dias, clientes cadastrados, links efetivamente habilitados em estabelecimentos liberados e pendências de liberação/vencimento. A receita mensal combinada soma os preços contratados de estabelecimentos ativos; não representa recebimentos.

Busca ignora acentos, ordenação prioriza pendências e vencimentos próximos ou permite nome/cadastro recente. O estado do link vem de `business_settings.online_booking_enabled`. Atualização indica horário da última consulta; falha ao consultar histórico é exibida como erro, sem fingir um histórico vazio.

Verificação: 76 testes automatizados, lint, typecheck, build e smoke HTTP local aprovados. O teste de autenticação usa o SDK real contra um servidor local de Auth controlado: senha inválida, conta comum rejeitada, cookies independentes, sessão válida e logout sem afetar estabelecimento. Os testes SQL existentes verificam privilégios/RLS e as operações de plataforma. Interface, busca, gerenciamento e login foram inspecionados no navegador local.

Publicação autorizada pelo usuário: o Supabase `dyukaebjntbfeqctyehi` foi identificado a partir da configuração pública do site e confirmado na conexão. As duas migrations de agendamento online foram aplicadas e verificadas antes do deploy; RLS foi mantida e nenhum estabelecimento existente foi desativado. A definição anterior da função de agendamento manual foi comparada ao código antes da correção. Não foi aplicado seed nem criado dado fictício no banco remoto.

O login com as credenciais reais deve ser feito pelo proprietário. A verificação automatizada não usa nem solicita sua senha e não substitui a confirmação pessoal de entrada no painel publicado.
