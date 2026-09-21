#!/usr/bin/env sh
# Issue a one-time password-reset link for a partner/reviewer account on the
# live Turso database, without touching their password. Run from your own
# terminal (needs ~/.turso/turso signed in). Usage:
#   scripts/issue-reset-link.sh advika.richhariya@gmail.com
# Prints the link; open it (or email it) within 48 hours. Works once.
set -eu
EMAIL="$(printf '%s' "${1:?email required}" | tr 'A-Z' 'a-z')"
DB="${TURSO_DB:-foster-connect}"
TURSO="${TURSO_BIN:-$HOME/.turso/turso}"
TOKEN="$(node -e "console.log(require('crypto').randomBytes(32).toString('base64url'))")"
HASH="$(node -e "console.log(require('crypto').createHash('sha256').update(process.argv[1]).digest('hex'))" "$TOKEN")"
EXPIRES="$(node -e "console.log(new Date(Date.now()+48*3600*1000).toISOString())")"
"$TURSO" db shell "$DB" "INSERT INTO partner_password_resets(partner_id, token_hash, issued_by, issued_at, expires_at)
  SELECT id, '$HASH', 'issue-reset-link.sh', CURRENT_TIMESTAMP, '$EXPIRES' FROM partners WHERE email = '$EMAIL' AND active = 1" >/dev/null
COUNT="$("$TURSO" db shell "$DB" "SELECT COUNT(*) FROM partner_password_resets WHERE token_hash = '$HASH'" | tail -1 | tr -d ' ')"
[ "$COUNT" = "1" ] || { echo "No active account for $EMAIL" >&2; exit 1; }
echo "${SITE_URL:-https://fosterguide.org}/partners/reset?token=$TOKEN"
