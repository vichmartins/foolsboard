#!/bin/sh
# foolsboard backup -- creates an incremental, deduplicated snapshot of the
# database + media in a restic repository, then thins the chain per the
# retention policy.
#
# restic dedups across snapshots, so each run stores only what changed, yet
# EVERY snapshot is a full, independently-restorable point in time (no fragile
# base/increment chain). Runs as the foolsboard user -- the daily timer and the
# admin "Run backup now" both use this user, so the repo has a single owner.
#
#   sudo -u foolsboard /opt/foolsboard/backup.sh   # run by hand
#   restic snapshots                                # list the chain
#   sudo /opt/foolsboard/restore.sh                 # interactive restore
set -eu

ENV_FILE="${FOOLSBOARD_ENV_FILE:-/etc/foolsboard/foolsboard.env}"
BACKUP_DIR="${FOOLSBOARD_BACKUP_DIR:-/var/backups/foolsboard}"
PWFILE="${FOOLSBOARD_RESTIC_PASSWORD_FILE:-/etc/foolsboard/restic-password}"
# Retention: thin the chain to this many daily / weekly / monthly snapshots
# (older ones are forgotten and their unreferenced data pruned). Overridable.
KEEP_DAILY="${FOOLSBOARD_KEEP_DAILY:-7}"
KEEP_WEEKLY="${FOOLSBOARD_KEEP_WEEKLY:-6}"
KEEP_MONTHLY="${FOOLSBOARD_KEEP_MONTHLY:-12}"

[ -f "$ENV_FILE" ] || { echo "backup: $ENV_FILE not found" >&2; exit 1; }
[ -f "$PWFILE" ] || { echo "backup: restic password file $PWFILE not found" >&2; exit 1; }
command -v restic >/dev/null 2>&1 || { echo "backup: restic is not installed" >&2; exit 1; }
# Load DATABASE_URL + STORAGE_LOCAL_DIR (KEY=VALUE, sh-safe).
# shellcheck disable=SC1090
. "$ENV_FILE"

export RESTIC_REPOSITORY="${FOOLSBOARD_RESTIC_REPO:-$BACKUP_DIR/restic}"
export RESTIC_PASSWORD_FILE="$PWFILE"

# First run: create the repository.
if ! restic cat config >/dev/null 2>&1; then
  echo "backup: initialising restic repository at $RESTIC_REPOSITORY"
  restic init
fi

# --- Database -> a staging dump the snapshot will include -------------------
STAGE="$BACKUP_DIR/.stage"
mkdir -p "$STAGE"
DUMP="$STAGE/database.dump"
rm -f "$DUMP"
case "${DATABASE_URL:-}" in
  postgres*|postgresql*)
    # pg_dump speaks a libpq URL; drop SQLAlchemy's "+psycopg" driver tag.
    PG_URL="$(printf '%s' "$DATABASE_URL" | sed 's/+psycopg//')"
    pg_dump -Fc "$PG_URL" > "$DUMP.tmp"
    mv "$DUMP.tmp" "$DUMP"
    ;;
  sqlite*)
    DB_PATH="$(printf '%s' "$DATABASE_URL" | sed 's#^sqlite:////*#/#')"
    [ -f "$DB_PATH" ] && cp "$DB_PATH" "$DUMP" || \
      echo "backup: sqlite file $DB_PATH not found, skipping DB" >&2
    ;;
  *)
    echo "backup: unrecognized DATABASE_URL, skipping DB dump" >&2
    ;;
esac

# --- One snapshot: the media dir + the DB dump -----------------------------
STORAGE="${STORAGE_LOCAL_DIR:-/var/lib/foolsboard/storage}"
set -- "$STAGE"
[ -d "$STORAGE" ] && set -- "$STORAGE" "$@"
restic backup --tag foolsboard --host foolsboard "$@"

# --- Retention: thin the chain, then prune unreferenced data ---------------
restic forget --tag foolsboard \
  --keep-daily "$KEEP_DAILY" --keep-weekly "$KEEP_WEEKLY" --keep-monthly "$KEEP_MONTHLY" \
  --prune

# The dump now lives inside the snapshot; don't leave it on disk.
rm -f "$DUMP"

# --- Status (group-readable; powers the admin "last backup" view) ----------
python3 - "$BACKUP_DIR/status.json" "$KEEP_DAILY" "$KEEP_WEEKLY" "$KEEP_MONTHLY" <<'PY'
import datetime, json, os, subprocess, sys, tempfile

out_path, kd, kw, km = sys.argv[1:5]

def restic_json(*args):
    r = subprocess.run(["restic", *args, "--json"], capture_output=True, text=True, check=True)
    return json.loads(r.stdout)

snaps = restic_json("snapshots")
items = [{"id": s["short_id"], "time": s["time"]} for s in snaps][-50:]
try:
    repo_bytes = restic_json("stats", "--mode", "raw-data").get("total_size", 0)
except Exception:
    repo_bytes = 0

status = {
    "tool": "restic",
    "last_run": datetime.datetime.now(datetime.timezone.utc).strftime("%Y%m%d-%H%M%S"),
    "snapshot_count": len(snaps),
    "repo_bytes": repo_bytes,
    "retention": f"{kd} daily / {kw} weekly / {km} monthly",
    "snapshots": items,
}
fd, tmp = tempfile.mkstemp(dir=os.path.dirname(out_path))
with os.fdopen(fd, "w") as f:
    json.dump(status, f)
os.chmod(tmp, 0o640)
os.replace(tmp, out_path)
PY

echo "foolsboard backup complete (restic; keep ${KEEP_DAILY}d/${KEEP_WEEKLY}w/${KEEP_MONTHLY}m)"
