#!/usr/bin/env bash
# Deploy ke Railway pakai project token Kaelis dari .env.personal saja.
# RAILWAY_TOKEN mengalahkan login CLI global (akun lain), jadi deploy selalu ke project Kaelis.
# Pakai:  bash scripts/deploy.sh          (upload & deploy folder ini)
#         bash scripts/deploy.sh status   (cek project yang kebaca)
set -euo pipefail
cd "$(dirname "$0")/.."

[ -f .env.personal ] || { echo "Tidak ada .env.personal"; exit 1; }
set -a; . <(tr -d '\r' < .env.personal); set +a  # strip Windows line endings
[ -n "${RAILWAY_TOKEN:-}" ] || { echo "Isi RAILWAY_TOKEN di .env.personal dulu"; exit 1; }

# Jangan pakai token akun lain yang mungkin ada di environment
unset RAILWAY_API_TOKEN
export RAILWAY_TOKEN

if [ "${1:-}" = "status" ]; then railway status; exit 0; fi

SVC=()
[ -n "${RAILWAY_SERVICE:-}" ] && SVC=(--service "$RAILWAY_SERVICE")
railway up --ci "${SVC[@]}"
