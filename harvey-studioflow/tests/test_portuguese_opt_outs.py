"""Brazilian Portuguese opt-outs (StudioFlow adaptation)."""
import pytest

from harvey.agents.handler import _opt_out_reason
from harvey.config import ComplianceConfig
from harvey.collectors.discover import OpenStreetMap


@pytest.mark.parametrize("reply", [
    "SAIR",
    "sair, obrigado",
    "Pare",
    "Não, obrigado.",
    "nao obrigado",
    "Me tira da lista, por favor.",
    "Por favor me remova da sua lista de e-mails",
    "Remova meu e-mail do cadastro.",
    "Não me mande mais e-mails.",
    "Não me envie mais nada",
    "Parem de me mandar isso.",
    "Não quero mais receber essas mensagens",
    "Não tenho interesse.",
    "Sem interesse, valeu",
    "Me descadastra",
    "Não tenho interesse, obrigado\n\nEnviado do meu iPhone",
])
def test_portuguese_opt_outs_stop(reply):
    assert _opt_out_reason(reply, reply) is not None


@pytest.mark.parametrize("reply", [
    "Não tenho interesse no plano anual, mas o mensal me interessa.",
    "Tirei o cliente da lista de espera ontem.",
    "Se não tiver interesse eu te aviso.",
    "Não me mande por e-mail, me chama no WhatsApp.",
    "Por que não, obrigado pela mensagem! Pode mandar o link.",
    "Pode me mandar o link sim, quero ver como fica.",
    "Quanto custa depois dos 30 dias?",
    "Não tenho interesse até dezembro, me procura depois.",
])
def test_portuguese_replies_that_are_not_opt_outs(reply):
    assert _opt_out_reason(reply, reply) is None


def test_portuguese_opt_out_line_is_accepted():
    line = 'Não quer receber? Responda "SAIR" e eu não mando mais.'
    assert ComplianceConfig(opt_out_line=line).opt_out_line == line


def test_portuguese_opt_out_line_still_needs_a_recognised_word():
    with pytest.raises(ValueError):
        ComplianceConfig(opt_out_line="Não quer receber? Me avise.")


def test_openstreetmap_knows_barbershops():
    osm = OpenStreetMap()
    assert "shop=barber" in osm._tags("barbearia")
    assert "shop=hairdresser" in osm._tags("Barbearias em Goiânia")
