# foolsboard — Backups & Restore

foolsboard backs itself up automatically. This guide explains what the backups
are, how to make them on demand, and how to restore — both with the guided
script and by hand.

All paths below are the package defaults. Server commands are run on the host
foolsboard is installed on (e.g. over SSH), as a user with `sudo`.

---

## What gets backed up

Each backup run produces **two files that share a timestamp** — together they are
**one consistent snapshot**:

| File | What it is |
|------|------------|
| `db-<TIMESTAMP>.dump` | A full **database** dump — every board, node, connection, user, share, category, etc. (PostgreSQL custom-format; on a SQLite install it's `db-<TIMESTAMP>.sqlite`.) |
| `media-<TIMESTAMP>.tar.gz` | A **media** archive — every uploaded image, video, audio, and file. |
| `status.json` | A small summary (last run, retention) the Admin UI reads. |

- **Location:** `/var/backups/foolsboard`
- **Schedule:** automatically every night (~03:30), plus any on-demand runs.
- **Retention:** the last **14 days** are kept; older ones are pruned.

> The database references media files internally, so the `db` and `media` of the
> **same timestamp** belong together. When restoring, use a matched pair.

> ⚠️ **Disaster recovery:** backups are written to the **same host** as the app.
> If that host's disk is lost, the backups are lost too. For real DR, copy
> snapshots off the host (see *Off-host copies* below).

---

## Making a backup

### Automatically
Nothing to do — it runs nightly. Confirm the schedule with:

```bash
systemctl list-timers foolsboard-backup.timer
```

### On demand — from the app (easiest)
Sign in as an admin and go to **Admin → Storage → Backups → “Run backup now.”**
The list updates and shows “Backup complete.”

### On demand — from the server
```bash
sudo systemctl start foolsboard-backup.service   # same as the nightly run
# …or run the script directly:
sudo /opt/foolsboard/backup.sh
```

---

## Checking your backups

- **In the app:** **Admin → Storage → Backups** shows the last run, how many are
  kept, total size, the recent files, and a warning if the newest backup is more
  than two days old (a sign backups have stopped).
- **On the server:**
  ```bash
  ls -lh /var/backups/foolsboard/
  ```

---

## Restoring (recommended: the guided script)

Restoring **replaces** the current data, so it's a server operation. SSH in and
run:

```bash
sudo /opt/foolsboard/restore.sh
```

It lists your snapshots and asks three things:

1. **Which snapshot?** — type its number.
2. **Database, media, or both?** — `d`, `m`, or `b` (Enter = both).
3. **Confirm** — type `yes`.

It then automatically:

1. Stops the app.
2. **Takes a fresh backup of the current state first** (so the restore itself is reversible).
3. Restores the chosen snapshot (database and/or media).
4. Re-applies database migrations, so an older snapshot still matches the running version.
5. Restarts the app.

**To undo a restore:** run the script again and pick the **newest** snapshot —
that's the safety backup it just took, which rolls you back.

---

## Manual restore (advanced)

Prefer the script above. These are the equivalent steps if you need them.

First, find the database URL (the `pg_*` tools want it **without** the
`+psycopg` part):

```bash
grep '^DATABASE_URL=' /etc/foolsboard/foolsboard.env
sudo systemctl stop foolsboard          # always stop the app first
```

### Database (PostgreSQL)
```bash
PG_URL="postgresql://USER:PASSWORD@localhost:5432"   # from DATABASE_URL, no +psycopg
DB="foolsboard"                                       # the database name
sudo -u postgres psql -c "DROP DATABASE IF EXISTS \"$DB\";"
sudo -u postgres psql -c "CREATE DATABASE \"$DB\" OWNER foolsboard;"
pg_restore --no-owner -d "$PG_URL/$DB" /var/backups/foolsboard/db-<TIMESTAMP>.dump
# bring the schema up to the running version:
sudo -u foolsboard sh -c '. /etc/foolsboard/foolsboard.env; cd /opt/foolsboard/backend; /opt/foolsboard/venv/bin/alembic upgrade head'
```

### Media
```bash
sudo rm -rf /var/lib/foolsboard/storage
sudo tar xzf /var/backups/foolsboard/media-<TIMESTAMP>.tar.gz -C /var/lib/foolsboard
sudo chown -R foolsboard:foolsboard /var/lib/foolsboard/storage
```

Then start the app again:
```bash
sudo systemctl start foolsboard
```

---

## Inspecting a backup without touching production

To peek at a backup's contents safely, restore the dump into a throwaway
database — production is untouched:

```bash
PG_URL="postgresql://USER:PASSWORD@localhost:5432"
sudo -u postgres createdb scratch
pg_restore --no-owner -d "$PG_URL/scratch" /var/backups/foolsboard/db-<TIMESTAMP>.dump
# …inspect with psql…
sudo -u postgres dropdb scratch
```

---

## Off-host copies (disaster recovery)

Copy snapshots to another machine or a NAS so they survive losing this host:

```bash
# from another computer — pull a snapshot:
scp user@<this-host>:/var/backups/foolsboard/db-<TIMESTAMP>.dump .
scp user@<this-host>:/var/backups/foolsboard/media-<TIMESTAMP>.tar.gz .

# or mirror the whole backup directory to a NAS, on a schedule:
rsync -a /var/backups/foolsboard/ /mnt/nas/foolsboard-backups/
```

---

## Configuration

| Setting | Default | How to change |
|---------|---------|---------------|
| Backup directory | `/var/backups/foolsboard` | `FOOLSBOARD_BACKUP_DIR` in the script's environment |
| Retention (days) | `14` | `FOOLSBOARD_BACKUP_RETENTION_DAYS` |

To change retention for the **scheduled** job, add an override:

```bash
sudo systemctl edit foolsboard-backup.service
# add:
#   [Service]
#   Environment=FOOLSBOARD_BACKUP_RETENTION_DAYS=30
```

For a one-off manual run with a different value:

```bash
sudo FOOLSBOARD_BACKUP_RETENTION_DAYS=30 /opt/foolsboard/backup.sh
```
