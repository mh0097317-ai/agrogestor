"""Brazilian Portuguese opt-outs (StudioFlow adaptation).

Same discipline as the Spanish and Hebrew rules in the Handler: each phrase
needs the verb aimed at the sender ("me tira da lista", "não me mande
mais"), matched one line at a time with accents removed, so "tirei o
cliente da lista" (news) or "não tenho interesse no plano anual" (a
bargain) don't stop a conversation. Anything these rules miss still goes to
the model, which reads the whole reply.

Under the LGPD (Lei 13.709/2018, art. 18) the person can object at any
time and the request must be honoured free of charge: when in doubt, the
Handler's model treats a request to stop as an opt-out.
"""
from __future__ import annotations

import re
import unicodedata

# Words an opt_out_line may ask for ('Responda "SAIR"').
PORTUGUESE_OPT_OUT_WORDS = ("sair", "nao obrigado", "não obrigado", "descadastrar", "remover")

# Verbs that ask for a reply, for the opt_out_line check.
ASK_VERBS = r"(?:responda|responde|respondam|me\s+responda|escreva|escreve|mande|manda)"

# A reply that says only this (signature aside) is an opt-out.
PORTUGUESE_BARE_OPT_OUTS = {
    "sair", "pare", "parar", "remover", "descadastrar", "descadastre", "cancelar",
    "nao obrigado", "nao obrigada", "nao quero", "sem interesse",
}
# Said around a bare opt-out without changing it ("sair, obrigado").
PORTUGUESE_COURTESIES = {"por", "favor", "pf", "pfv", "obrigado", "obrigada", "valeu", "abs", "att"}

_SIGNATURE_RE = re.compile(
    r"^[ \t]*(?:enviado do meu \w[^\n]*|enviado de meu \w[^\n]*|enviado pelo \w[^\n]*"
    r"|obtenha o outlook para \w[^\n]*|baixe o outlook para \w[^\n]*)$",
    re.IGNORECASE | re.MULTILINE)


def no_accents(text: str) -> str:
    return "".join(
        c for c in unicodedata.normalize("NFD", text)
        if not (unicodedata.combining(c) and ord(c) < 0x370))


def flat_lines(text: str) -> str:
    """Lowercase, accent-free, quote markers dropped, one line at a time."""
    text = _SIGNATURE_RE.sub("", text or "")
    lines = []
    for line in text.split("\n"):
        line = re.sub(r"^[ \t>]+", "", line)
        line = line.replace("“", '"').replace("”", '"').replace("’", "'")
        lines.append(" ".join(no_accents(line).lower().split()))
    return "\n".join(lines)


_ME = r"(?:me|nos)"
_LIST = (r"(?:(?:da|de|desta|dessa|sua|suas|seu|seus|a|o)\s+)*"
         r"(?:lista|base|cadastro|mailing|envios?|e-?mails?|contatos?)\w*")
_MY_ADDRESS = r"(?:meu|meus|nosso|nossos)\s+(?:e-?mail|email|contato|endereco|cadastro|dado)s?"
_MAIL = r"(?:mais|e-?mails?|mensagens?|propagandas?|ofertas?|nada|isso)"
_SEND = r"(?:mandar|enviar|escrever|contatar|contactar|chamar|incomodar)"
# The thought ends: punctuation, end of line, or a comma not followed by "mas"/"se".
_END = r"(?=[ \t]*(?:[.!;]|$|,(?![ \t]*(?:mas|porem|se|exceto|a[ \t]+nao[ \t]+ser)(?!\w))))"

PORTUGUESE_OPT_OUT_PATTERNS = (
    # Take me off the list.
    r"(?:me|nos)\s+(?:tira|tire|tirem|remova|removam|remove|exclua|excluam|exclui|apague|apaguem)"
    r"(?:\s+d[aeo]\s+" + _LIST + "|" + _END + ")",
    r"(?:tira|tire|tirem|remova|removam|exclua|excluam|apague|apaguem|tirar|remover|excluir|apagar)\s+"
    + _MY_ADDRESS + r"(?:\s+d[aeo]\s+" + _LIST + "|" + _END + ")",
    r"(?:tirar|remover|excluir)\s*-?\s*(?:me|nos)\s+d[aeo]\s+" + _LIST,
    r"(?:me|nos)\s+descadastr\w*|descadastr(?:ar|e|em|a)(?:\s+(?:me|meu\s+\w+))?" + _END,
    r"cancelar\s+(?:a\s+|minha\s+)?inscricao",
    # Don't write to / contact me.
    r"nao\s+" + _ME + r"\s+(?:mande|mandem|manda|envie|enviem|envia|escreva|escrevam|procure|procurem"
    r"|contate|contatem|incomode|incomodem|chame|chamem)(?!\w)(?:\s+" + _MAIL + r"(?!\w)|" + _END + ")",
    r"(?:pare|parem|para|parar)\s+de\s+(?:" + _ME + r"\s+)?" + _SEND + r"(?:-?me)?",
    r"(?:chega|basta)\s+de\s+(?:e-?mails?|mensagens?|propagandas?)",
    r"nao\s+(?:quero|queremos|desejo|desejamos)\s+(?:mais\s+)?(?:receber|ser\s+contatad[oa]s?)"
    r"(?:\s+" + _MAIL + r"(?!\w))?",
    # Not interested, as the whole thought ("não tenho interesse, obrigado").
    r"(?:nao\s+(?:tenho|temos)\s+(?:nenhum\s+)?interesse|sem\s+interesse|nao\s+(?:me|nos)\s+interessa"
    r"|nao\s+(?:estou|estamos)\s+interessad[oa]s?)"
    r"(?:\s+(?:por\s+enquanto|no\s+momento|agora))?" + _END,
)
PORTUGUESE_OPT_OUT_RE = re.compile(
    r"(?<!\w)(?:" + "|".join(PORTUGUESE_OPT_OUT_PATTERNS) + r")(?!\w)", re.MULTILINE)

# A word before that conditions it ("se não tiver interesse"), or a rest of
# the sentence that narrows it to a time or a channel ("me chama no WhatsApp").
_NOT_FINAL_BEFORE = {"se", "quando", "porque", "caso", "talvez", "ainda", "mesmo"}
_LAST_WORD_RE = re.compile(r"(\S+)[ \t]*\Z")
_NOT_FINAL_AFTER_RE = re.compile(
    r"(?<!\w)(?:ate|antes\s+de|depois\s+d[eo]|a\s+partir\s+de|melhor|whatsapp|zap|wpp|telefone"
    r"|liga|ligue|me\s+chama|me\s+chame|me\s+liga|me\s+ligue|por\s+aqui\s+nao"
    r"|segunda|terca|quarta|quinta|sexta|sabado|domingo|semana|mes|janeiro|fevereiro|marco"
    r"|abril|maio|junho|julho|agosto|setembro|outubro|novembro|dezembro)(?!\w)")

# "Não, obrigado" on a line: as with "no thanks". Not "por que não, obrigado"
# (why not), "ou não" or "ainda não".
PORTUGUESE_NO_THANKS_RE = re.compile(
    r"(?<!\bou )(?<!\bque )(?<!\bainda )(?<!\bse )(?<!\bpor que )"
    r"\bnao,?[ \t]+(?:muito[ \t]+)?obrigad[oa]s?\b(?![ \t]+(?:a|por|pel[oa])\b)")


def portuguese_opt_out(text: str):
    """The first Portuguese opt-out phrase in flat_lines() text that means it."""
    for m in PORTUGUESE_OPT_OUT_RE.finditer(text):
        line_start = text.rfind("\n", 0, m.start()) + 1
        last = _LAST_WORD_RE.search(text[max(line_start, m.start() - 40):m.start()])
        before = last.group(1).strip(",") if last else ""
        if before in _NOT_FINAL_BEFORE:
            continue
        sentence_end = re.search(r"[.!?;\n]", text[m.end():])
        after = text[m.end():m.end() + sentence_end.start()] if sentence_end else text[m.end():]
        if _NOT_FINAL_AFTER_RE.search(after):
            continue
        return m
    return None


def portuguese_reason(their_text: str, own_words: str) -> dict | None:
    """Which Portuguese opt-out rule their reply trips, or None."""
    lines = flat_lines(their_text)
    m = portuguese_opt_out(lines)
    if m:
        return {"rule": "phrase", "matched": m.group(0),
                "why": f'Their reply contains "{m.group(0)}".'}
    for line in lines.split("\n"):
        m = PORTUGUESE_NO_THANKS_RE.search(line)
        if m:
            return {"rule": "no_thanks", "matched": m.group(0),
                    "why": f'Their reply says "{m.group(0)}" (no thanks).'}
    bare = re.sub(r"[^\w\s-]", "", flat_lines(own_words or "")).strip()
    bare = " ".join(bare.split())
    if bare in PORTUGUESE_BARE_OPT_OUTS or " ".join(
            w for w in bare.split() if w not in PORTUGUESE_COURTESIES) in PORTUGUESE_BARE_OPT_OUTS:
        return {"rule": "only_words", "matched": bare,
                "why": f'Their reply was only "{bare}".'}
    return None
