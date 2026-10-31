#!/bin/bash
# Narrates every reel with one voice: node narracao/todos.sh VOICE_ID NAME
export NARRATION_URL=https://app.studioflowapp.tech NODE_USE_ENV_PROXY=1 NODE_NO_WARNINGS=1
for r in 01-madrugada 02-faltas 03-caderno 04-salao-ao-vivo 05-cliente-sumido 06-pix 07-marca-sozinho 08-comissao 09-modo-tv 10-nao-lidas; do
  node narracao/narrar.cjs "$r" "$1" > "narracao/log-$r.txt" 2>&1 && mv -f "out/$r-narrado-$1.mp4" "out/$r-narrado.mp4" && echo "ok $r" || echo "FALHOU $r"
done
