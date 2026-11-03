# Harvey para a StudioFlow

Agente que acha barbearias, lê o site de cada uma, escreve e-mails frios em
português e responde quem responde, sempre pedindo sua aprovação antes de
enviar. É uma cópia adaptada do projeto aberto
[Harvey](https://github.com/ethanplusai/harvey) (licença MIT, commit
`6b6a23a`). O `README.md` original continua aqui, em inglês, com todos os
detalhes.

Ele roda **no seu computador**, não no app da StudioFlow.

## O que foi adaptado
- **Português do Brasil:** e-mails, assuntos, respostas e notas, com regras próprias para dono de barbearia (`skills/regras_email_studioflow.md`).
- **Saídas em português:** "SAIR", "não, obrigado", "me tira da lista", "não me mande mais", "não tenho interesse" e parecidos param a conversa para sempre (`harvey/portuguese.py`). Frases como "não tenho interesse no plano anual, mas o mensal sim" não param.
- **Barbearias no mapa:** a busca grátis pelo OpenStreetMap entende "barbearia", "barbershop", "cabeleireiro" e "salão de beleza".
- **Configuração da StudioFlow** (`harvey.studioflow.yaml`): oferta de 30 dias para testar, link de cadastro, Goiânia, Aparecida, Anápolis e Brasília, fuso de São Paulo e envio só em dia útil das 8h30 às 17h.
- **LGPD:** identificação de quem envia em todo e-mail frio, linha de saída e regra de atender o pedido de saída na hora.

## Antes de começar (uma vez)
1. **Domínio de envio separado**, por exemplo `studioflowmail.com.br`, com um e-mail no Google Workspace. Não use o domínio principal: se algum e-mail cair em spam, o principal não sofre.
2. **Aquecimento de 2 semanas** desse e-mail antes de mandar e-mail frio (o README cita o TrulyInbox). Coloque a data em `warmup.start_date`. O Harvey começa com 5 por dia e sobe sozinho.
3. **Python 3.11 ou mais novo** e a assinatura do Claude (o Harvey usa o Claude Code do seu computador).

## Instalar
```bash
cd harvey-studioflow
python3 -m venv .venv
source .venv/bin/activate        # no Windows: .venv\Scripts\activate
pip install -e .
cp harvey.studioflow.yaml harvey.local.yaml
```

Abra `harvey.local.yaml` e troque tudo o que está entre `<...>`:
- `persona.name`, `persona.email` e `offer.meeting_owner`: seu nome e o e-mail de envio.
- `compliance.postal_address`: StudioFlow, CNPJ (ou razão social) e cidade.
- `warmup.start_date`: o dia em que o aquecimento começou.

Depois:
```bash
python -m harvey setup        # conecta o Gmail do domínio de envio
python -m harvey warmup       # diz se o e-mail já está pronto para envio frio
```

## Usar
```bash
python -m harvey discover --provider osm --estimate   # mostra as buscas, sem gastar
python -m harvey discover --provider osm              # acha as barbearias (grátis)
python -m harvey run                                  # escreve e deixa tudo na Caixa de saída
python -m harvey dashboard                            # painel para aprovar, editar ou descartar
```

- **Mais barbearias:** o OpenStreetMap traz menos casas que o Google. Para mais, use `--provider serper` com a mesma chave da Serper da Captação, colocada no arquivo `.env` como `SERPER_API_KEY`.
- **Aprovação:** `require_approval: true` vem ligado, então nada sai sem você aprovar no painel. Deixe assim nas primeiras semanas.

## Regras que não mudam
- Só e-mail que a barbearia publicou (site, Google). Nunca lista comprada.
- Pediu para sair, sai para sempre. O Harvey já faz isso sozinho, e você não deve recolocar a pessoa.
- Barbearia que já é cliente: coloque o domínio dela em `compliance.do_not_contact`.
- Quem respondeu e quer testar: crie o lead na **Captação** do /admin da StudioFlow para acompanhar no mesmo funil.

## Testes
```bash
pip install -e ".[dev]"
python -m pytest -q
```
Na adaptação passaram 2.989 testes. Os testes de português ficam em `tests/test_portuguese_opt_outs.py`.
