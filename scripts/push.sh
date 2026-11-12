#!/usr/bin/env bash
# Push ke GitHub pakai akun Kaelis dari .env.personal saja.
# Login gh / Git Credential Manager global (akun lain) sengaja dimatikan untuk repo ini.
# Pakai:  bash scripts/push.sh            (push branch sekarang)
#         bash scripts/push.sh --dry-run  (cek tanpa push)
set -euo pipefail
cd "$(dirname "$0")/.."

[ -f .env.personal ] || { echo "Tidak ada .env.personal"; exit 1; }
set -a; . ./.env.personal; set +a

for v in GITHUB_TOKEN GITHUB_REPO GIT_AUTHOR_NAME GIT_AUTHOR_EMAIL; do
  [ -n "${!v:-}" ] || { echo "Isi $v di .env.personal dulu"; exit 1; }
done

# Akun harus milik project ini: owner repo wajib mengandung nama project
PROJECT_NAME="${PROJECT_NAME:-$(basename "$PWD")}"
OWNER="${GITHUB_REPO%%/*}"
if [[ "${OWNER,,}" != *"${PROJECT_NAME,,}"* ]]; then
  echo "Ditolak: owner repo \"$OWNER\" bukan akun project \"$PROJECT_NAME\"."
  echo "Tiap project pakai akun sendiri yang namanya sesuai project. Cek GITHUB_REPO / PROJECT_NAME di .env.personal."
  exit 1
fi

# Identitas commit khusus repo ini (tidak menyentuh config global)
git config --local user.name "$GIT_AUTHOR_NAME"
git config --local user.email "$GIT_AUTHOR_EMAIL"
# Pastikan credential global tetap mati untuk repo ini
git config --local --replace-all credential.helper ""
git config --local --replace-all credential.https://github.com.helper ""

URL="https://github.com/$GITHUB_REPO.git"
git remote get-url origin >/dev/null 2>&1 && git remote set-url origin "$URL" || git remote add origin "$URL"

BRANCH="$(git rev-parse --abbrev-ref HEAD)"
AUTH="$(printf 'x-access-token:%s' "$GITHUB_TOKEN" | base64 | tr -d '\n')"

# Token hanya dikirim lewat header untuk perintah ini, tidak disimpan di .git/config
GIT_TERMINAL_PROMPT=0 git -c http.https://github.com/.extraheader="Authorization: Basic $AUTH" \
  push "$@" -u origin "$BRANCH"
echo "Selesai: $BRANCH -> $GITHUB_REPO"
