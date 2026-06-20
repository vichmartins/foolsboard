# Packaging foolsboard

foolsboard ships as a self-contained Debian package. The installed app runs as a
single `uvicorn` worker that serves the **SPA, API, WebSocket, and media** on one
port (default **9534**) — no web server required. It uses a **local PostgreSQL**
database, auto-provisioned on install; `DATABASE_URL` is overridable to point at
an external server (or SQLite) without code changes.

## Build the .deb

Run on a Debian/Linux host with `dpkg-deb` (the frontend is bundled prebuilt; if
`frontend/dist` is missing the script builds it with `npm`, which then needs Node):

```bash
packaging/build-deb.sh
# -> build/foolsboard_<version>_all.deb
```

The version is read from `frontend/package.json`.

## Install / upgrade

```bash
sudo apt install ./build/foolsboard_<version>_all.deb      # resolves deps (python3-venv, ffmpeg)
# or: sudo dpkg -i ... ; sudo apt-get -f install
```

On install the package:
1. creates a `foolsboard` system user,
2. auto-provisions a local Postgres role + database `foolsboard` (generated password),
3. writes `/etc/foolsboard/foolsboard.env` (DATABASE_URL + a random `JWT_SECRET`) and `/var/lib/foolsboard` (media),
4. builds a virtualenv at `/opt/foolsboard/venv` and installs the Python deps (incl. psycopg),
5. runs `alembic upgrade head`,
6. enables and starts `foolsboard.service`.

To migrate data from an old SQLite database into Postgres, see
`/opt/foolsboard/backend/scripts/sqlite_to_postgres.py`.

Then browse to `http://<host>:9534`. Open TCP **9534** on the firewall if needed.

## Layout

| Path | Purpose |
|------|---------|
| `/opt/foolsboard/backend` | FastAPI source |
| `/opt/foolsboard/frontend/dist` | built SPA (served by the app) |
| `/opt/foolsboard/venv` | Python virtualenv |
| `/etc/foolsboard/foolsboard.env` | config + secrets (preserved on upgrade) |
| `/var/lib/foolsboard/` | SQLite database + uploaded media |
| `/lib/systemd/system/foolsboard.service` | the service unit |

## Manage

```bash
systemctl status foolsboard
journalctl -u foolsboard -f
systemctl restart foolsboard
```

## Reverse proxy (optional)

The app stands alone, but you can place it behind a proxy: set
`FOOLSBOARD_HOST=127.0.0.1` in `/etc/foolsboard/foolsboard.env`, restart, and
point the proxy at `http://127.0.0.1:9534`. An nginx example is in
`/usr/share/doc/foolsboard/` once finalized.

## Remove

```bash
sudo apt remove foolsboard      # stops + disables the service, keeps data
sudo apt purge  foolsboard      # also drops the venv (data in /var/lib is kept)
```

## Roadmap

- **Docker** image: the same single-process model maps cleanly to one container
  running uvicorn on 9534 with `/var/lib/foolsboard` as a volume.
