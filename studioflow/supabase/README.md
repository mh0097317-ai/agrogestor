# Banco do StudioFlow

A migration em `migrations/` cria 17 tabelas reais, autenticação, isolamento por estabelecimento, índices, vínculos compostos e transações de agendamento. Nenhum projeto remoto foi modificado nesta implementação.

`seed.sql` contém o BARBER 011 e os mesmos dados fictícios centralizados em `src/lib/seed.ts`, para desenvolvimento local. Gere uma amostra atualizada com `npx tsx scripts/generate-supabase-seed.mts`. O seed não cria contas nem senhas padrão e não deve ser aplicado automaticamente em produção.

## Conectar produção

1. Selecione um projeto Supabase dedicado e revise a migration.
2. Aplique a migration com o fluxo normal do Supabase CLI ou o SQL Editor do projeto.
3. Configure `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` e `SUPABASE_SECRET_KEY` no servidor. A chave secreta nunca deve receber o prefixo `NEXT_PUBLIC_`.
4. No Auth, configure a URL do aplicativo e o redirect permitido `/auth/callback`; habilite confirmação por e-mail e SMTP próprio para uso comercial.
5. Crie uma conta pela rota `/login` e conclua `/onboarding`. O cadastro cria tenant, empresa, membro proprietário, serviços, equipe e configurações em uma transação.

O modo demo usa arquivos em `.data/`, apenas fora de `NODE_ENV=production` e sem URL Supabase. Cada estabelecimento possui arquivo independente e o workspace ativo usa cookie HttpOnly. O lock de arquivo serializa confirmações; a demo é para desenvolvimento local, sem autenticação real.

## Segurança

- Todas as tabelas têm RLS. O usuário precisa pertencer ao estabelecimento consultado. `user_metadata` nunca concede permissões.
- Vínculos compostos `(business_id,id)` impedem que agendamentos, serviços, profissionais e pagamentos apontem para outra empresa.
- Visitantes não recebem acesso direto às tabelas. Rotas públicas retornam projeções explícitas, sem clientes, telefone dos profissionais, comissões ou financeiro.
- Reservas são feitas somente no servidor com `book_appointment`, disponível apenas a `service_role`. A transação usa advisory lock, revalida toda a duração e aplica uma exclusion constraint GiST.
- `workspace_mutation`, `create_workspace`, `get_booking` e `manage_booking` também são RPCs exclusivas do servidor. Mutações verificam o membro e sua função novamente no banco.
- O token público tem 256 bits aleatórios. O banco guarda apenas seu SHA-256. O portador do link pode consultar/alterar aquela reserva dentro da política de cancelamento.
- Proprietário, administrador e gerente alteram serviços, equipe, financeiro e configurações. Recepcionista administra clientes, agenda e bloqueios. Profissional tem acesso de leitura; permissões mais específicas por profissional podem evoluir posteriormente.
- `appointments`, `blocked_times`, `payments` e `commissions` não permitem escrita direta por clientes autenticados. A atualização de status preserva o preço e duração reservados; pagamentos exigem atendimento concluído e respeitam o saldo dentro da transação.

## Verificação

`npm test` executa testes de domínio, concorrência da demo e a migration em PostgreSQL real compilado para WASM (PGlite), incluindo pgcrypto e btree_gist. A suíte verifica isolamento RLS, acesso anônimo negado, proteção de chaves compostas, double booking, preço/duração históricos e pagamentos. PGlite é apenas uma dependência de desenvolvimento; não é utilizado pelo aplicativo.

Antes de publicar, execute os advisors do Supabase no projeto escolhido, revise logs, backups, retenção de dados, SMTP e proteção contra abuso na infraestrutura. O limitador local de requests precisa de um armazenamento compartilhado em instalações com múltiplos servidores. O envio de lembretes WhatsApp depende de um provedor conectado; o consentimento já é registrado, nenhum envio externo é simulado.

Os horários desta versão seguem `America/Sao_Paulo`. Para operar em outros fusos brasileiros, acrescente o fuso ao cadastro da empresa e utilize-o no cálculo de disponibilidade, no RPC e no calendário.
