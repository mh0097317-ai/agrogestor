#!/usr/bin/env bash
# Aplica todas as migrações no banco de HOMOLOGAÇÃO, em ordem.
# Uso: STAGING_DB_URL='postgresql://...' scripts/staging/apply-migrations.sh
# A URL vem do painel do Supabase do projeto de staging (Connect → URI).
set -euo pipefail
: "${STAGING_DB_URL:?Defina STAGING_DB_URL com a conexão do projeto de homologação}"
if [[ "$STAGING_DB_URL" == *dyukaebjntbfeqctyehi* ]]; then
  echo "Recusado: esta é a conexão de PRODUÇÃO." >&2
  exit 1
fi
command -v psql >/dev/null || { echo "Instale o psql (cliente PostgreSQL)." >&2; exit 1; }
cd "$(dirname "$0")/../.."
for file in supabase/migrations/*.sql; do
  echo "→ $file"
  psql "$STAGING_DB_URL" -v ON_ERROR_STOP=1 -q -f "$file"
done
echo "Migrações aplicadas. Rode o seed fictício: psql \"\$STAGING_DB_URL\" -f supabase/seed.sql (se existir)."
