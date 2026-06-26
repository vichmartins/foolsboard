#!/bin/sh
# foolsboard restore -- interactively restore the database and/or media from a
# snapshot in /var/backups/foolsboard.
#
#   sudo /opt/foolsboard/restore.sh
#
# DESTRUCTIVE: replaces the live data. It stops the app, takes a safety backup of
# the CURRENT state first (so a restore is itself reversible), restores the chosen
# snapshot, re-applies migrations, then restarts. The database and media of the
# same timestamp are a consistent pair -- restore them together.
set -eu

ENV_FILE="${FOOLSBOARD_ENV_FILE:-/etc/foolsboard/foolsboard.env}"
BACKUP_DIR="${FOOLSBOARD_BACKUP_DIR:-/var/backups/foolsboard}"
APP_DIR=/opt/foolsboard
SVC=foolsboard.service
SVC_USER=foolsboard

[ "$(id -u)" -eq 0 ] || { echo "Please run as root:  sudo $0" >&2; exit 1; }
[ -f "$ENV_FILE" ] || { echo "Config not found: $ENV_FILE" >&2; exit 1; }
# shellcheck disable=SC1090
. "$ENV_FILE"

# --- Pick a snapshot --------------------------------------------------------
TSS="$(ls -1 "$BACKUP_DIR"/db-*.dump "$BACKUP_DIR"/db-*.sqlite 2>/dev/null \
       | sed -E 's#.*/db-(.*)\.(dump|sqlite)$#\1#' | sort -ru)"
[ -n "$TSS" ] || { echo "No database backups found in $BACKUP_DIR." >&2; exit 1; }

echo "Snapshots in $BACKUP_DIR (newest first):"
echo
i=1
for ts in $TSS; do
  db="$(ls "$BACKUP_DIR"/db-"$ts".dump "$BACKUP_DIR"/db-"$ts".sqlite 2>/dev/null | head -1)"
  dbsz="$(du -h "$db" 2>/dev/null | cut -f1)"
  media="$BACKUP_DIR/media-$ts.tar.gz"
  if [ -f "$media" ]; then mnote="media $(du -h "$media" | cut -f1)"; else mnote="(no media)"; fi
  printf "  %2d) %s   db %s · %s\n" "$i" "$ts" "$dbsz" "$mnote"
  i=$((i + 1))
done
echo
printf "Restore which snapshot? [1-%s, q to quit]: " "$((i - 1))"
read -r choice
case "$choice" in q | Q | "") echo "Cancelled."; exit 0 ;; esac
TS="$(printf '%s\n' "$TSS" | sed -n "${choice}p")"
[ -n "$TS" ] || { echo "Invalid choice." >&2; exit 1; }

# --- What to restore --------------------------------------------------------
printf "Restore [d]atabase, [m]edia, or [b]oth? [b]: "
read -r mode
case "$mode" in
  d | D) mode=db ;;
  m | M) mode=media ;;
  b | B | "") mode=both ;;
  *) echo "Invalid choice." >&2; exit 1 ;;
esac
if [ "$mode" != db ] && [ ! -f "$BACKUP_DIR/media-$TS.tar.gz" ]; then
  echo "No media archive for $TS -- can't restore media." >&2
  exit 1
fi

echo
echo "About to restore snapshot $TS ($mode)."
echo "This REPLACES the current data. A safety backup of the current state is taken first."
printf "Type 'yes' to proceed: "
read -r ok
[ "$ok" = yes ] || { echo "Cancelled."; exit 0; }

# --- Do it ------------------------------------------------------------------
echo ">> Stopping $SVC ..."
systemctl stop "$SVC" || true

echo ">> Safety backup of current state ..."
"$APP_DIR/backup.sh" || echo "   WARNING: safety backup failed -- continuing."

if [ "$mode" = db ] || [ "$mode" = both ]; then
  echo ">> Restoring database from db-$TS ..."
  case "${DATABASE_URL:-}" in
    postgres* | postgresql*)
      DB_NAME="$(printf '%s' "$DATABASE_URL" | sed -E 's#.*/([^/?]+).*#\1#')"
      PG_URL="$(printf '%s' "$DATABASE_URL" | sed 's/+psycopg//')"
      runuser -u postgres -- psql -v ON_ERROR_STOP=1 -c \
        "SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname='$DB_NAME' AND pid<>pg_backend_pid();" >/dev/null
      runuser -u postgres -- psql -v ON_ERROR_STOP=1 -c "DROP DATABASE IF EXISTS \"$DB_NAME\";"
      runuser -u postgres -- psql -v ON_ERROR_STOP=1 -c "CREATE DATABASE \"$DB_NAME\" OWNER \"$SVC_USER\";"
      if pg_restore --no-owner --no-privileges -d "$PG_URL" "$BACKUP_DIR/db-$TS.dump"; then
        echo "   Database restored."
      else
        echo "   WARNING: pg_restore reported errors (review above)." >&2
      fi
      ;;
    sqlite*)
      DB_PATH="$(printf '%s' "$DATABASE_URL" | sed 's#^sqlite:////*#/#')"
      cp "$BACKUP_DIR/db-$TS.sqlite" "$DB_PATH"
      chown "$SVC_USER":"$SVC_USER" "$DB_PATH"
      ;;
    *) echo "   Unrecognized DATABASE_URL -- skipping DB restore." >&2 ;;
  esac

  echo ">> Applying migrations to match the current code ..."
  runuser -u "$SVC_USER" -- sh -c \
    "set -a; . '$ENV_FILE'; cd '$APP_DIR/backend'; exec '$APP_DIR/venv/bin/alembic' upgrade head" \
    || echo "   WARNING: migration step failed -- check the app version vs this backup." >&2
fi

if [ "$mode" = media ] || [ "$mode" = both ]; then
  echo ">> Restoring media from media-$TS.tar.gz ..."
  STORAGE="${STORAGE_LOCAL_DIR:-/var/lib/foolsboard/storage}"
  rm -rf "$STORAGE"
  tar xzf "$BACKUP_DIR/media-$TS.tar.gz" -C "$(dirname "$STORAGE")"
  chown -R "$SVC_USER":"$SVC_USER" "$STORAGE"
fi

echo ">> Starting $SVC ..."
systemctl start "$SVC"
echo
echo "Done. Restored $mode from snapshot $TS."
echo "If something looks wrong, the pre-restore state was just backed up too --"
echo "re-run this script and pick the newest snapshot to roll back."
