#!/usr/bin/env bash
# Rotate the JWT signing secret. This invalidates EVERY existing login token, so
# all users must sign in again. Run as root:  sudo /opt/foolsboard/rotate-jwt.sh
set -euo pipefail

ENV_FILE=/etc/foolsboard/foolsboard.env

if [ ! -f "$ENV_FILE" ]; then
  echo "error: $ENV_FILE not found (is foolsboard installed?)" >&2
  exit 1
fi
if [ "$(id -u)" -ne 0 ]; then
  echo "error: run as root (sudo)" >&2
  exit 1
fi

NEW="$(python3 -c 'import secrets; print(secrets.token_urlsafe(48))')"

# Replace the JWT_SECRET line (or append it), writing through a temp file and
# redirecting back into the original so its owner/permissions (root:foolsboard
# 640) are preserved.
tmp="$(mktemp)"
grep -v '^JWT_SECRET=' "$ENV_FILE" > "$tmp" || true
printf 'JWT_SECRET=%s\n' "$NEW" >> "$tmp"
cat "$tmp" > "$ENV_FILE"
rm -f "$tmp"

systemctl restart foolsboard.service

echo "JWT secret rotated and foolsboard restarted."
echo "All sessions are now invalid — every user must log in again."
