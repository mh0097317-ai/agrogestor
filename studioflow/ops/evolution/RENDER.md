# Evolution API no Render

**Para testar sem pagar, use primeiro [TESTE-GRATUITO.md](./TESTE-GRATUITO.md) e o `render.yaml` gratuito da raiz. O arquivo `ops/evolution/render.production.yaml` descrito abaixo cria serviços pagos e não está autorizado para o teste gratuito.**

O arquivo [`render.production.yaml`](./render.production.yaml) instala apenas a infraestrutura do WhatsApp. O StudioFlow continua na Vercel e o banco/autenticação dos estabelecimentos continuam na Supabase. O e-mail do Render pode ser diferente do e-mail do StudioFlow.

## Recursos e custo inicial

| Recurso | Configuração | Estimativa mensal em USD |
| --- | --- | ---: |
| Evolution API 2.3.7 | Web service `1c-2g`, 1 CPU / 2 GB RAM | $25.00 |
| PostgreSQL exclusivo da Evolution | `0.5c-1g`, 1 GB RAM | $19.00 |
| Armazenamento PostgreSQL | 5 GB | $1.50 |
| Render Key Value, compatível com Redis | `256mb` | $10.00 |
| Disco das sessões | 5 GB em `/evolution/instances` | $1.25 |
| **Total de infraestrutura** | Workspace Hobby, sem mensalidade adicional de workspace | **$56.75** |

Estimativa consultada em 07/10/2026 na [tabela oficial do Render](https://render.com/pricing). Não inclui câmbio, impostos, tráfego excedente, outros serviços já contratados, Vercel/Supabase nem consumo da IA. Revisar a estimativa exibida na conta antes de **Deploy Blueprint**. Se o workspace já for Pro, sua mensalidade é adicional. Não é necessário contratar Pro para aplicar este pacote.

Os planos gratuitos não são adequados para manter atendimento contínuo: o web service adormece e não aceita disco persistente; o banco gratuito expira. Todos os recursos estão em Virginia para usar a rede privada. A capacidade inicial precisa ser acompanhada conforme o número de conexões e mensagens aumentar; não há promessa de quantidade ilimitada de clientes.

## Criar o servidor

1. Entrar na [conta do Render](https://dashboard.render.com/) escolhida pelo administrador. Não enviar senhas, chaves ou dados de pagamento por conversa.
2. Abrir **New → Blueprint** e selecionar o repositório `mh0097317-ai/studioflow`, branch `main`, arquivo `ops/evolution/render.production.yaml`. Se ainda não estiver conectado, autorizar no GitHub somente o repositório necessário.
3. Conferir os três recursos e o disco. Verificar se algum nome corresponde a recurso existente antes de aplicar, para evitar alterar outro servidor. Revisar o custo e autorizar a contratação antes de clicar em **Deploy Blueprint**.
4. Após a criação, definir **Auto Sync → No** em Settings do Blueprint. Assim mudanças futuras na infraestrutura passam por revisão manual. Previews estão desativados para não duplicar recursos pagos.
5. Esperar banco e cache ficarem disponíveis e o web service ficar **Live**. A imagem oficial executa as migrations somente no novo banco da Evolution. Não usar credenciais do banco do StudioFlow.

O Render fornece uma URL HTTPS real terminada em `onrender.com`; não é necessário contratar domínio ou instalar Caddy. `SERVER_URL` referencia automaticamente `RENDER_EXTERNAL_URL`. PostgreSQL e Key Value usam URLs da rede privada e bloqueiam conexões públicas. A chave global é gerada pelo Render, sem valor fixo no código. O gerenciador independente da Evolution está desativado: as conexões são administradas pelo StudioFlow.

## Conectar a plataforma e os números

1. Copiar a URL HTTPS exibida no serviço **studioflow-evolution**.
2. No Render, em **Environment** desse serviço, obter `AUTHENTICATION_API_KEY` em ambiente privado. Não publicá-la, enviá-la por conversa nem incluí-la na URL.
3. No StudioFlow, abrir **Admin → Recepcionistas → Servidor do WhatsApp** e preencher a URL e a chave. Usar **Validar e salvar servidor**. A plataforma verifica a conexão e cifra a credencial.
4. Cadastrar e validar a chave/modelo de IA no **Cofre de IA** do estabelecimento. Liberar o módulo Recepcionista e ativar seu atendimento.
5. No painel do estabelecimento, abrir **Recepcionista** e ler o QR Code com o WhatsApp da loja. Para números dos profissionais, selecionar cada profissional e conectar seu próprio número. As instâncias e os tokens de webhook são individuais.
6. Realizar teste autorizado com um número controlado e dados reais: consultar serviço, preço e profissional, escolher disponibilidade, confirmar o horário e verificar o agendamento na agenda. Testar também a identidade da loja e a do profissional antes de liberar atendimento.

O webhook é configurado por instância pelo StudioFlow. Não habilitar webhook global. A IA roda no backend do StudioFlow, com ferramentas e limites do estabelecimento; `OPENAI_ENABLED=false` desativa apenas o agente nativo da Evolution. Desativar o link público não desativa o canal WhatsApp.

## Operação

- Acompanhar memória/CPU, disco, armazenamento do banco, falhas de webhook e consumo de tráfego. A expansão automática do armazenamento está desativada; revisar capacidade e custo antes de aumentar.
- Manter backup protegido do banco da Evolution e das sessões. Conferir a retenção de backups do plano escolhido e testar restauração isoladamente. Não substituir o backup do StudioFlow pelo backup da Evolution.
- O disco persistente exige uma única instância do serviço; novos deploys podem causar uma breve interrupção. Preservar disco, banco e cache ao atualizar. Não apagar recursos para resolver um erro de conexão.
- Antes de atualizar a imagem fixada, revisar notas oficiais, fazer backup e validar QR/webhook numa instância de teste. Mudanças no WhatsApp podem exigir nova leitura do QR.
- Ao trocar para domínio próprio, atualizar `SERVER_URL` e a URL salva no admin. A configuração inicial utiliza a URL HTTPS fornecida pelo Render.

**Status deste pacote:** configuração preparada para instalação. Arquivos no Git e schema válido não significam servidor criado, número conectado ou recepcionista validada de ponta a ponta.

Referências: [Blueprints](https://render.com/docs/infrastructure-as-code), [schema e campos](https://render.com/docs/blueprint-spec), [variáveis automáticas](https://render.com/docs/environment-variables), [discos persistentes](https://render.com/docs/disks), [limites gratuitos](https://render.com/docs/free), [release Evolution 2.3.7](https://github.com/evolution-foundation/evolution-api/releases/tag/2.3.7).
