# Evolution 2.3.7: listas nativas

Correção limitada ao envio de listas. O fluxo de encaminhamento e a conversão JSON da versão original podem perder os tipos Long esperados pelo protocolo. A correção monta uma mensagem `SINGLE_SELECT` com os tipos do Baileys e a envia diretamente com o nó de lista comercial. A mesma mensagem continua passando pela autenticação da Evolution, consulta do destinatário e registro do envio.

O script confere o hash exato da versão inspecionada e o hash esperado após a alteração. Recusa qualquer versão desconhecida. Texto, mídia, credenciais e sessões seguem os caminhos anteriores. A imagem mantém a versão base fixada por digest.

## Construção e aplicação

Crie e confirme um snapshot da VPS antes da aplicação. Conserve a configuração Compose e os volumes existentes.

```sh
docker build --network=none -t studioflow-evolution-native:2.3.7-sf1 ops/evolution-native-list
```

A construção testa a serialização com o Baileys instalado, os identificadores das opções, o nó comercial e a preservação de mensagens de texto. O cliente do teste é simulado: nenhum número recebe mensagens.

Use um arquivo Compose adicional que altere somente a imagem do serviço `api`:

```yaml
services:
  api:
    image: studioflow-evolution-native:2.3.7-sf1
```

Recrie apenas esse serviço com os dois arquivos Compose. Confira a resposta da API e as conexões das instâncias. Para voltar à versão original, recrie `api` usando somente o Compose original, que mantém a imagem anterior. Não remova volumes nem desconecte números.

## Liberação no StudioFlow

`STUDIOFLOW_WHATSAPP_NATIVE_LISTS` deve continuar desligada até um teste controlado confirmar a renderização e a seleção no telefone. HTTP201 confirma aceitação pelo servidor; não comprova que o aplicativo exibiu a lista. A chave geral da IA continua sendo independente e não deve ser ligada automaticamente por esta correção.

Envios de teste precisam de destinatário autorizado e registro prévio da tentativa para impedir repetição após resultado incerto. Após a confirmação no dispositivo, habilite a flag e publique a configuração. Continue validando disponibilidade e consentimento no backend ao receber uma seleção; clicar numa opção de consulta não confirma um agendamento.
