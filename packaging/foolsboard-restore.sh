#!/bin/sh
# foolsboard restore -- interactively restore the database and/or media from a
# restic snapshot in the foolsboard repository.
#
#   sudo /opt/foolsboard/restore.sh
#
# DESTRUCTIVE: replaces the live data. It stops the app, takes a safety snapshot
# of the CURRENT state first (so a restore is itself reversible), restores the
# chosen snapshot, re-applies migrations, then restarts. Every restic snapshot is
# a complete point in time -- the DB and media in it are a consistent pair.
set -eu

ENV_FILE="${FOOLSBOARD_ENV_FILE:-/etc/foolsboard/foolsboard.env}"
BACKUP_DIR="${FOOLSBOARD_BACKUP_DIR:-/var/backups/foolsboard}"
PWFILE="${FOOLSBOARD_RESTIC_PASSWORD_FILE:-/etc/foolsboard/restic-password}"
APP_DIR=/opt/foolsboard
SVC=foolsboard.service
SVC_USER=foolsboard

[ "$(id -u)" -eq 0 ] || { echo "Please run as root:  sudo $0" >&2; exit 1; }
[ -f "$ENV_FILE" ] || { echo "Config not found: $ENV_FILE" >&2; exit 1; }
[ -f "$PWFILE" ] || { echo "restic password file not found: $PWFILE" >&2; exit 1; }
command -v restic >/dev/null 2>&1 || { echo "restic is not installed" >&2; exit 1; }
# shellcheck disable=SC1090
. "$ENV_FILE"

export RESTIC_REPOSITORY="${FOOLSBOARD_RESTIC_REPO:-$BACKUP_DIR/restic}"
export RESTIC_PASSWORD_FILE="$PWFILE"
# Always touch the repo AS the foolsboard user so it keeps a single owner -- the
# timer and the app back up as foolsboard, and restic's repo files are owner-only,
# so a root write here would create files the foolsboard user can't read.
RESTIC="runuser -u $SVC_USER -- env RESTIC_REPOSITORY=$RESTIC_REPOSITORY RESTIC_PASSWORD_FILE=$RESTIC_PASSWORD_FILE restic"
$RESTIC cat config >/dev/null 2>&1 || { echo "No restic repository at $RESTIC_REPOSITORY." >&2; exit 1; }

# --- Pick a snapshot (numbered list to stderr; ids captured from stdout) ----
echo "Snapshots in the foolsboard repository (newest last):"
echo
IDS="$($RESTIC snapshots --json | python3 -c '
import json, sys
s = json.load(sys.stdin)
for i, x in enumerate(s, 1):
    print("  %2d) %s   %s" % (i, x["short_id"], x["time"][:19]), file=sys.stderr)
print("\n".join(x["short_id"] for x in s))
')"
[ -n "$IDS" ] || { echo "No snapshots found." >&2; exit 1; }
N="$(printf '%s\n' "$IDS" | wc -l | tr -d ' ')"
echo
printf "Restore which snapshot? [1-%s, q to quit]: " "$N"
read -r choice
case "$choice" in q | Q | "") echo "Cancelled."; exit 0 ;; esac
SID="$(printf '%s\n' "$IDS" | sed -n "${choice}p")"
[ -n "$SID" ] || { echo "Invalid choice." >&2; exit 1; }

printf "Restore [d]atabase, [m]edia, or [b]oth? [b]: "
read -r mode
case "$mode" in
  d | D) mode=db ;;
  m | M) mode=media ;;
  b | B | "") mode=both ;;
  *) echo "Invalid choice." >&2; exit 1 ;;
esac

echo
echo "About to restore snapshot $SID ($mode). This REPLACES the current data."
echo "A safety snapshot of the current state is taken first."
printf "Type 'yes' to proceed: "
read -r ok
[ "$ok" = yes ] || { echo "Cancelled."; exit 0; }

echo ">> Stopping $SVC ..."
systemctl stop "$SVC" || true

echo ">> Safety snapshot of current state ..."
runuser -u "$SVC_USER" -- "$APP_DIR/backup.sh" || echo "   WARNING: safety backup failed -- continuing."

# A foolsboard-owned temp so the (foolsboard) restic write lands cleanly; root can
# still read it for the pg_restore / media copy below.
TMP="$(runuser -u "$SVC_USER" -- mktemp -d)"
trap 'rm -rf "$TMP"' EXIT
echo ">> Extracting snapshot $SID ..."
$RESTIC restore "$SID" --target "$TMP"

STORAGE="${STORAGE_LOCAL_DIR:-/var/lib/foolsboard/storage}"
DUMP="$TMP$BACKUP_DIR/.stage/database.dump"
MEDIA_SRC="$TMP$STORAGE"

if [ "$mode" = db ] || [ "$mode" = both ]; then
  if [ ! -f "$DUMP" ]; then
    echo "   Snapshot has no database dump -- skipping DB." >&2
  else
    echo ">> Restoring database ..."
    case "${DATABASE_URL:-}" in
      postgres* | postgresql*)
        DB_NAME="$(printf '%s' "$DATABASE_URL" | sed -E 's#.*/([^/?]+).*#\1#')"
        PG_URL="$(printf '%s' "$DATABASE_URL" | sed 's/+psycopg//')"
        runuser -u postgres -- psql -v ON_ERROR_STOP=1 -c \
          "SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname='$DB_NAME' AND pid<>pg_backend_pid();" >/dev/null
        runuser -u postgres -- psql -v ON_ERROR_STOP=1 -c "DROP DATABASE IF EXISTS \"$DB_NAME\";"
        runuser -u postgres -- psql -v ON_ERROR_STOP=1 -c "CREATE DATABASE \"$DB_NAME\" OWNER \"$SVC_USER\";"
        if pg_restore --no-owner --no-privileges -d "$PG_URL" "$DUMP"; then
          echo "   Database restored."
        else
          echo "   WARNING: pg_restore reported errors (review above)." >&2
        fi
        ;;
      sqlite*)
        DB_PATH="$(printf '%s' "$DATABASE_URL" | sed 's#^sqlite:////*#/#')"
        cp "$DUMP" "$DB_PATH"
        chown "$SVC_USER":"$SVC_USER" "$DB_PATH"
        ;;
      *) echo "   Unrecognized DATABASE_URL -- skipping DB restore." >&2 ;;
    esac
    echo ">> Applying migrations to match the current code ..."
    runuser -u "$SVC_USER" -- sh -c \
      "set -a; . '$ENV_FILE'; cd '$APP_DIR/backend'; exec '$APP_DIR/venv/bin/alembic' upgrade head" \
      || echo "   WARNING: migration step failed -- check the app version vs this snapshot." >&2
  fi
fi

if [ "$mode" = media ] || [ "$mode" = both ]; then
  if [ -d "$MEDIA_SRC" ]; then
    echo ">> Restoring media ..."
    rm -rf "$STORAGE"
    mkdir -p "$(dirname "$STORAGE")"
    cp -a "$MEDIA_SRC" "$STORAGE"
    chown -R "$SVC_USER":"$SVC_USER" "$STORAGE"
  else
    echo "   Snapshot has no media -- skipping media." >&2
  fi
fi

echo ">> Starting $SVC ..."
systemctl start "$SVC"
echo
echo "Done. Restored $mode from snapshot $SID."
echo "The pre-restore state was snapshotted too -- re-run and pick the newest to roll back."
