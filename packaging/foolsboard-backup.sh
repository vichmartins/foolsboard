#!/bin/sh
# foolsboard backup -- dumps the database and archives the media directory into
# /var/backups/foolsboard, then prunes copies older than the retention window.
#
# Run automatically by foolsboard-backup.timer (daily). Safe to run by hand:
#   sudo /opt/foolsboard/backup.sh
#
# Restore (example):
#   pg_restore --clean --if-exists -d "<DATABASE_URL without +psycopg>" db-<TS>.dump
#   tar xzf media-<TS>.tar.gz -C /var/lib/foolsboard
set -eu

ENV_FILE="${FOOLSBOARD_ENV_FILE:-/etc/foolsboard/foolsboard.env}"
BACKUP_DIR="${FOOLSBOARD_BACKUP_DIR:-/var/backups/foolsboard}"
RETENTION_DAYS="${FOOLSBOARD_BACKUP_RETENTION_DAYS:-14}"

[ -f "$ENV_FILE" ] || { echo "backup: $ENV_FILE not found" >&2; exit 1; }
# Load DATABASE_URL + STORAGE_LOCAL_DIR from the app's env (KEY=VALUE, sh-safe).
# shellcheck disable=SC1090
. "$ENV_FILE"

mkdir -p "$BACKUP_DIR"
TS="$(date +%Y%m%d-%H%M%S)"

# --- Database ---------------------------------------------------------------
# Write to .tmp first so a failed/partial dump never replaces a good one.
case "${DATABASE_URL:-}" in
  postgres*|postgresql*)
    # pg_dump speaks a libpq URL; drop SQLAlchemy's "+psycopg" driver tag.
    PG_URL="$(printf '%s' "$DATABASE_URL" | sed 's/+psycopg//')"
    pg_dump -Fc "$PG_URL" > "$BACKUP_DIR/db-$TS.dump.tmp"
    mv "$BACKUP_DIR/db-$TS.dump.tmp" "$BACKUP_DIR/db-$TS.dump"
    ;;
  sqlite*)
    DB_PATH="$(printf '%s' "$DATABASE_URL" | sed 's#^sqlite:////*#/#')"
    [ -f "$DB_PATH" ] && cp "$DB_PATH" "$BACKUP_DIR/db-$TS.sqlite"
    ;;
  *)
    echo "backup: unrecognized DATABASE_URL, skipping DB dump" >&2
    ;;
esac

# --- Media ------------------------------------------------------------------
STORAGE="${STORAGE_LOCAL_DIR:-/var/lib/foolsboard/storage}"
if [ -d "$STORAGE" ]; then
  tar -czf "$BACKUP_DIR/media-$TS.tar.gz.tmp" \
      -C "$(dirname "$STORAGE")" "$(basename "$STORAGE")"
  mv "$BACKUP_DIR/media-$TS.tar.gz.tmp" "$BACKUP_DIR/media-$TS.tar.gz"
fi

# --- Retention --------------------------------------------------------------
find "$BACKUP_DIR" -maxdepth 1 -type f \
  \( -name 'db-*' -o -name 'media-*' \) -mtime "+$RETENTION_DAYS" -delete

# --- Status (small, group-readable so the admin UI can show last-backup) -----
LATEST_DB="$(ls -1t "$BACKUP_DIR"/db-* 2>/dev/null | head -1 || true)"
LATEST_MEDIA="$(ls -1t "$BACKUP_DIR"/media-*.tar.gz 2>/dev/null | head -1 || true)"
COUNT="$(find "$BACKUP_DIR" -maxdepth 1 -type f -name 'db-*' | wc -l | tr -d ' ')"
# Write via tmp+rename so it works whether the previous run was the root timer
# or the app user -- rename only needs dir write (the dir is group-writable),
# unlike truncating an existing file owned by the other user.
cat > "$BACKUP_DIR/status.json.tmp" <<EOF
{"last_run":"$TS","retention_days":$RETENTION_DAYS,"db_dump":"$(basename "${LATEST_DB:-}")","media_archive":"$(basename "${LATEST_MEDIA:-}")","db_backup_count":$COUNT}
EOF
chmod 0640 "$BACKUP_DIR/status.json.tmp" 2>/dev/null || true
mv "$BACKUP_DIR/status.json.tmp" "$BACKUP_DIR/status.json"

echo "foolsboard backup complete: $TS (retention ${RETENTION_DAYS}d)"
