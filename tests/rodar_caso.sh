#!/bin/sh
# Roda um caso de tests/casos.json de ponta a ponta no n8n local (com o modelo de verdade).
# Uso: sh tests/rodar_caso.sh <indice> <pasta_temporaria>
set -e
I=$1; T=$2; cd "$(dirname "$0")/.."
python3 -I tests/make_cli_variant.py n8n/workflow.json tests/casos.json "$I" "$T/cli$I.json" >/dev/null
docker cp "$T/cli$I.json" n8n:/tmp/cli$I.json
docker exec n8n n8n import:workflow --input=/tmp/cli$I.json >/dev/null 2>&1
docker exec -e N8N_RUNNERS_BROKER_PORT=5691 -e N8N_PORT=5699 -e QUEUE_HEALTH_CHECK_PORT=5698 n8n \
  n8n execute --id="testecli$(printf %08d "$I")" --rawOutput > "$T/cli$I.out" 2>&1 || true
python3 -I tests/resumo_execucao.py "$T/cli$I.out"
