# foolsboard — Backups & Restore

foolsboard backs itself up automatically using **restic** — an incremental,
deduplicated, encrypted snapshot tool. Each nightly run adds a snapshot that
contains the **whole** database + media, but only the data that changed since the
last run is actually stored. Every snapshot is a complete, independently
restorable point in time — there's no fragile "full + increments" chain to keep
intact.

All paths below are the package defaults. Server commands run on the host
foolsboard is installed on (e.g. over SSH), as a user with `sudo`.

---

## How it works

| Thing | Where |
|-------|-------|
| restic repository (all snapshots) | `/var/backups/foolsboard/restic` |
| Repository password | `/etc/foolsboard/restic-password` (generated on install; back this up somewhere safe — without it the repo can't be read) |
| Status summary (read by the Admin UI) | `/var/backups/foolsboard/status.json` |

- **What's in each snapshot:** a full PostgreSQL dump (`database.dump`) **and** the
  entire media directory — every board, node, connection, user, share, plus every
  uploaded image/video/audio/file. The DB and media in one snapshot are a
  consistent pair.
- **Schedule:** automatically every night (~03:30), plus any on-demand runs. Runs
  as the `foolsboard` user.
- **Retention:** the chain is thinned to the most recent **7 daily, 6 weekly, and
  12 monthly** snapshots; older ones are forgotten and their unreferenced data
  pruned. (Configurable — see below.)

> ⚠️ **Disaster recovery:** the repository lives on the **same host** as the app.
> If that host's disk is lost, so are the backups. For real DR, copy the repo (and
> the password) off-host — see *Off-host copies* below.

---

## Making a backup

**Automatically** — nothing to do; it runs nightly. Confirm the schedule:

```bash
systemctl list-timers foolsboard-backup.timer
```

**On demand, from the app** — sign in as an admin, go to
**Admin → Storage → Backups → “Run backup now.”**

**On demand, from the server:**

```bash
sudo systemctl start foolsboard-backup.service   # same as the nightly run
# …or directly, as the foolsboard user:
sudo -u foolsboard /opt/foolsboard/backup.sh
```

---

## Checking your backups

**In the app:** **Admin → Storage → Backups** shows the last run, the retention
policy, snapshot count, repo size, the recent snapshots, and a warning if the
newest is over two days old (a sign backups have stopped).

**On the server** — list the chain with restic:

```bash
sudo -u foolsboard env \
  RESTIC_REPOSITORY=/var/backups/foolsboard/restic \
  RESTIC_PASSWORD_FILE=/etc/foolsboard/restic-password \
  restic snapshots
```

(Tip: `export` those two env vars once per shell and the `restic …` commands below
get shorter.)

---

## Restoring (recommended: the guided script)

Restoring **replaces** the current data, so it's a server operation:

```bash
sudo /opt/foolsboard/restore.sh
```

It lists your snapshots and asks three things:

1. **Which snapshot?** — type its number.
2. **Database, media, or both?** — `d`, `m`, or `b` (Enter = both).
3. **Confirm** — type `yes`.

It then automatically:

1. Stops the app.
2. **Takes a fresh safety snapshot of the current state first** (so the restore is itself reversible).
3. Extracts the chosen snapshot and restores the database and/or media.
4. Re-applies database migrations, so an older snapshot still matches the running version.
5. Restarts the app.

**To undo a restore:** run the script again and pick the **newest** snapshot —
that's the safety one it just took.

---

## Manual restore (advanced)

Prefer the script above. The equivalent steps, with the restic env exported:

```bash
export RESTIC_REPOSITORY=/var/backups/foolsboard/restic
export RESTIC_PASSWORD_FILE=/etc/foolsboard/restic-password
restic snapshots                       # find the snapshot short-id
sudo systemctl stop foolsboard
restic restore <SNAPSHOT_ID> --target /tmp/fb-restore
```

That recreates the snapshot's files under `/tmp/fb-restore` at their original
absolute paths:
`/tmp/fb-restore/var/backups/foolsboard/.stage/database.dump` and
`/tmp/fb-restore/var/lib/foolsboard/storage`.

### Database (PostgreSQL)
```bash
PG_URL="postgresql://USER:PASSWORD@localhost:5432"   # from DATABASE_URL, no +psycopg
DB="foolsboard"
sudo -u postgres psql -c "DROP DATABASE IF EXISTS \"$DB\";"
sudo -u postgres psql -c "CREATE DATABASE \"$DB\" OWNER foolsboard;"
pg_restore --no-owner -d "$PG_URL/$DB" /tmp/fb-restore/var/backups/foolsboard/.stage/database.dump
sudo -u foolsboard sh -c '. /etc/foolsboard/foolsboard.env; cd /opt/foolsboard/backend; /opt/foolsboard/venv/bin/alembic upgrade head'
```

### Media
```bash
sudo rm -rf /var/lib/foolsboard/storage
sudo cp -a /tmp/fb-restore/var/lib/foolsboard/storage /var/lib/foolsboard/storage
sudo chown -R foolsboard:foolsboard /var/lib/foolsboard/storage
sudo systemctl start foolsboard
```

---

## Inspecting a snapshot without touching production

```bash
export RESTIC_REPOSITORY=/var/backups/foolsboard/restic
export RESTIC_PASSWORD_FILE=/etc/foolsboard/restic-password
restic mount /tmp/fb-browse        # browse all snapshots as files (Ctrl-C to unmount)
# or restore one to a scratch dir and load the dump into a throwaway DB.
restic check                       # verify repository integrity
```

---

## Off-host copies (disaster recovery)

The cleanest option is to keep a second restic repository elsewhere and copy
snapshots into it (still deduplicated):

```bash
restic copy --repo2 sftp:user@nas:/backups/foolsboard --password-file2 <pwfile2>
```

Or simply mirror the repository directory (plus the password) to a NAS:

```bash
rsync -a /var/backups/foolsboard/restic/ /mnt/nas/foolsboard-restic/
```

Either way, **keep a copy of `/etc/foolsboard/restic-password`** somewhere safe —
the repository is encrypted and useless without it.

---

## Configuration

| Setting | Default | Env var |
|---------|---------|---------|
| Repository | `/var/backups/foolsboard/restic` | `FOOLSBOARD_RESTIC_REPO` |
| Password file | `/etc/foolsboard/restic-password` | `FOOLSBOARD_RESTIC_PASSWORD_FILE` |
| Keep daily / weekly / monthly | `7` / `6` / `12` | `FOOLSBOARD_KEEP_DAILY` / `_WEEKLY` / `_MONTHLY` |

To change the retention for the **scheduled** job:

```bash
sudo systemctl edit foolsboard-backup.service
# add:
#   [Service]
#   Environment=FOOLSBOARD_KEEP_DAILY=14
#   Environment=FOOLSBOARD_KEEP_MONTHLY=24
```
