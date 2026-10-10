# Evolution API do StudioFlow

Primeira etapa escolhida: **[teste gratuito no Render](./TESTE-GRATUITO.md)**, usando o `render.yaml` gratuito da raiz ou `ops/evolution/render.free.yaml`. Todos os recursos desse arquivo usam o plano Free.

Para uma futura produção, a **[proposta no Render e seus custos](./RENDER.md)** usa [`render.production.yaml`](./render.production.yaml) e contém recursos pagos. Não aplicar esse arquivo para o teste. A conta do Render pode usar outro e-mail.

O pacote Docker abaixo continua disponível como alternativa para uma VPS Ubuntu 24.04 com Docker Engine, Compose e Node.js. O número de conexões suportadas depende do uso real; acompanhar memória, CPU e disco antes de ampliar clientes.

O StudioFlow permanece na Vercel e seu banco na Supabase. Este PostgreSQL guarda somente dados da Evolution. Este pacote não altera o banco do StudioFlow.

## Antes da instalação

1. Contratar a VPS e disponibilizar acesso SSH autorizado.
2. Escolher um domínio/subdomínio para a Evolution e apontar seu registro DNS A para o IP da VPS. Remover registro AAAA caso a VPS não tenha IPv6 configurado.
3. Instalar [Docker Engine e Compose pelo guia oficial](https://docs.docker.com/engine/install/ubuntu/), além de Node.js. Permitir somente SSH (preferencialmente restrito ao administrador), HTTP 80 e HTTPS 443 no firewall do provedor. PostgreSQL, Redis e porta 8080 não são publicados.
4. Copiar esta pasta para um diretório privado da VPS. Não enviar chaves por conversa, não usar credenciais de demonstração e não publicar `.env`.

## Instalar

Na pasta `ops/evolution`, executar com o domínio e o e-mail reais:

```sh
node configure.mjs DOMINIO_DA_EVOLUTION EMAIL_DO_ADMIN https://app.studioflowapp.tech
docker compose config --quiet
docker compose pull
docker compose up -d
docker compose ps
```

O configurador gera chaves aleatórias e grava `.env` com permissão `600`, sem exibir os valores. Recusa sobrescrever arquivo existente. O Caddy obtém o certificado automaticamente depois que DNS e portas estiverem corretos. Imagem da Evolution fixada em `v2.3.7`; revisar as notas oficiais e validar QR/webhooks em ambiente de teste antes de atualizar. Nunca executar `docker compose down -v` para atualizar: isso apaga os volumes.

## Conectar ao StudioFlow

1. No admin, abrir **Recepcionistas → Servidor do WhatsApp**.
2. Inserir a URL HTTPS real e a chave `AUTHENTICATION_API_KEY` gerada no arquivo privado da VPS. O StudioFlow valida o servidor e cifra a chave. Esta é a chave da Evolution; as chaves OpenAI/Anthropic ficam nos cofres individuais.
3. Em **Gerenciar → Cofre de IA**, cadastrar e validar a chave de IA e o modelo do estabelecimento.
4. Liberar o módulo Recepcionista e ativar o atendimento desse estabelecimento.
5. No painel do estabelecimento, abrir Recepcionista e conectar o número da loja por QR Code. Para números dos profissionais, escolher o profissional correto e ler o QR do respectivo número. Cada conexão possui instância e identidade próprias.
6. Fazer um teste autorizado com número controlado: consultar um serviço real, consultar disponibilidade, confirmar um horário e verificar a agenda. Só então liberar o atendimento do cliente.

O StudioFlow configura webhooks por instância com token próprio. Não configurar um webhook global que envie mensagens de todos os clientes para a mesma identidade. A IA e suas ferramentas são executadas no StudioFlow, não no agente nativo da Evolution.

## Operação e recuperação

- Acompanhar `docker compose ps`, `docker stats` e `df -h`. Não compartilhar logs com mensagens, tokens ou dados de clientes.
- Fazer backup diário fora da VPS do PostgreSQL (`pg_dump`), do volume `evolution_instances` e da configuração privada. Proteger backups e verificar restauração numa VPS isolada. O backup semanal do provedor é complementar.
- Antes de atualização, fazer snapshot/backup, registrar versões/digests, validar uma instância de teste e manter a imagem anterior para rollback. Não remover volumes.
- Reconexão depende da sessão persistida; mudanças no WhatsApp podem exigir nova leitura do QR Code.

Este pacote foi preparado para instalação. A VPS, o domínio e as credenciais precisam existir antes de conectar números reais; a entrega dos arquivos não significa que o servidor esteja instalado.

Referências: [Evolution API](https://github.com/evolution-foundation/evolution-api), [release 2.3.7](https://github.com/evolution-foundation/evolution-api/releases/tag/2.3.7), [instalação oficial](https://github.com/evolution-foundation/docs-evolution/blob/main/v2/en/install/docker.mdx), [VPS Hostinger](https://www.hostinger.com/br/servidor-vps).
