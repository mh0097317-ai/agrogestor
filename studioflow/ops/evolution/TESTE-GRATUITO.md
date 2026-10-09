# Primeiro teste da Evolution no Render — sem contratar planos pagos

Use **[`render.yaml`](../../render.yaml)** da raiz, que agora contém apenas planos `free`. O arquivo `ops/evolution/render.free.yaml` mantém uma cópia explícita do pacote de teste. A proposta paga está separada em `ops/evolution/render.production.yaml` e não deve ser aplicada neste teste.

O StudioFlow permanece na Vercel e o banco/autenticação dos estabelecimentos na Supabase. O novo banco do teste armazena apenas dados da Evolution. Nenhuma migration, seed ou cópia do banco dos clientes é necessária.

## Custo e limites

| Recurso de teste | Plano | Cobrança de compute |
| --- | --- | ---: |
| `studioflow-evolution-test` | Free: 512 MB de RAM | US$ 0 |
| `studioflow-evolution-test-db` | Free: PostgreSQL, 1 GB de armazenamento | US$ 0 |
| `studioflow-evolution-test-cache` | Free: Key Value, 25 MB de RAM | US$ 0 |

O pacote não cria disco pago, autoscaling, réplica ou serviço de produção. Usar workspace Hobby gratuito e não cadastrar meio de pagamento para este teste: o Render informa que excedentes de tráfego/build podem gerar cobrança quando há meio de pagamento; sem ele, os serviços/builds são suspensos ao atingir a cota. Se a conta já possuir cartão ou assinatura, revisar a cobrança e os limites antes de aplicar. Não contratar upgrade, adicionar cartão ou aceitar qualquer custo para concluir o teste.

A hospedagem Free não inclui créditos de OpenAI/Anthropic. Primeiro validar servidor, autenticação e QR **sem ativar respostas da IA**. Para testar a recepcionista depois, será necessária uma chave com créditos existentes e autorização de uso; não comprar créditos automaticamente nem presumir que uma assinatura do ChatGPT fornece créditos de API.

Limites oficiais consultados em 07/10/2026:

- O servidor dorme após 15 minutos sem tráfego de entrada e leva cerca de um minuto para despertar. Uma mensagem chegando ao WhatsApp não deve ser tratada como garantia de despertar o servidor: a conexão com o WhatsApp é iniciada pela Evolution.
- Não existe disco persistente. Arquivos locais e cache podem se perder em reinicializações; pode ser necessário ler o QR novamente. Não prometer atendimento contínuo.
- O PostgreSQL Free expira após 30 dias; depois há 14 dias de tolerância antes da exclusão. Não armazenar dados essenciais ou usar esse banco como backup.
- É permitida uma única instância Free de PostgreSQL e uma de Key Value por workspace. Se a conta já utilizar essas cotas, não apagar outro banco nem mudar para um plano pago: revisar a alternativa de teste.
- Os 512 MB do servidor são inferiores ao tamanho proposto para produção. A inicialização e uma única conexão precisam ser verificadas na prática; se faltar memória, registrar o limite e interromper o teste sem contratar upgrade.

Fonte: [Render — Deploy for Free](https://render.com/docs/free), [planos de compute](https://render.com/docs/compute-plans).

## Instalação

1. Entrar na conta do Render escolhida. Não enviar senha ou chave por conversa.
2. Abrir **New → Blueprint**, escolher `mh0097317-ai/studioflow`, branch `main`.
3. Em **Blueprint Path**, manter o padrão **`render.yaml`**, agora gratuito. Também é possível selecionar `ops/evolution/render.free.yaml`, com a mesma configuração Free.
4. Conferir os três nomes terminados em `test`, `test-db` e `test-cache`, todos **Free**, sem discos e sem cobrança de plano. Conferir cotas e ausência de meio de pagamento. Se a tela exigir pagamento/cartão, não prosseguir.
5. Aplicar somente essa configuração gratuita. Depois, definir **Auto Sync → No** no Blueprint, para mudanças futuras dependerem de revisão manual. Os previews já estão desativados.
6. Aguardar banco/cache disponíveis e serviço **Live**. Verificar os logs de inicialização e abrir a URL HTTPS real fornecida pelo Render. Não compartilhar logs que contenham credenciais ou mensagens.

O pacote utiliza a imagem oficial fixada em Evolution 2.3.7. URL HTTPS é obtida automaticamente, a chave global é gerada pelo Render, e banco/cache só aceitam conexões pela rede privada. O gerenciador da Evolution e o webhook global ficam desativados.

A Evolution usa `CORS_ORIGIN=*` com credenciais de navegador desativadas para aceitar também chamadas de servidor sem `Origin`, incluindo o health check do Render. Os endpoints protegidos continuam exigindo `apikey`; a chave global fica somente no servidor do StudioFlow e não deve ser enviada ao navegador do cliente.

## Testar em etapas

1. **Servidor:** abrir a URL HTTPS e verificar resposta da Evolution. O estado Live sozinho não comprova conexão com WhatsApp.
2. **StudioFlow:** no admin, em **Recepcionistas → Servidor do WhatsApp**, validar a URL real e a chave gerada no Render. Se já existir servidor conectado a clientes, não substituí-lo por este teste sem revisar o impacto.
3. **QR:** escolher um estabelecimento e um número controlados pelo proprietário e autorizados para teste. Manter a recepcionista desativada até autorizar o consumo da IA. Ler o QR no painel e confirmar o estado conectado.
4. **Recepção:** com o atendimento automático ainda desligado, usar somente mensagens de texto de um número controlado e verificar o recebimento no backend. Não usar áudios nesta etapa: a transcrição pode consumir créditos mesmo com as respostas automáticas desligadas. Não enviar mensagens a clientes reais para simular teste.
5. **IA e agenda, posteriormente:** somente com chave/créditos autorizados, validar serviços e preços reais e uma reserva real explicitamente autorizada. Não criar dados fictícios em produção nem afirmar que o teste completo passou apenas porque o QR apareceu.

Não cadastrar webhook global. Cada número mantém instância e token de webhook próprios; loja e profissional mantêm suas identidades. Desativar o booking público não impede o canal WhatsApp.

## Encerrar ou passar para produção

O teste gratuito não é convertido automaticamente em plano pago. Registrar os resultados e a data real de expiração exibida no Render. Antes de qualquer migração, revisar conexão, sessões, backup e custo. A proposta paga continua descrita em [RENDER.md](./RENDER.md), sem contratação autorizada neste teste.

**Status:** pacote preparado. Servidor criado, QR conectado e resposta da IA são verificações distintas e só podem ser declaradas concluídas depois dos testes reais.
