<div align="center">

<img src=".github/logo.svg" alt="foolsboard" width="120" height="120" />

# foolsboard

**An infinite-canvas storyboard for branching storylines.**

Drop objects on a canvas — characters, scenes, dialog, events, notes, rich-text
documents & screenplays — link them into an idea map, attach media to each, and
play through your story by following the branches. Real-time co-editing, per-object
media, and a Celtx-style screenplay mode. Self-hosted.

<sub>Think *Miro / tldraw* meets *Trello*, built for narrative. · [Changelog](CHANGELOG.md)</sub>

</div>

---

## ✨ Highlights

- **Infinite canvas** of connectable objects with branching links.
- **Rich media** per object — images, video, audio, files, and link previews.
- **Documents & screenplays** — a rich-text editor with a Celtx-style script mode,
  element autocomplete, and PDF export.
- **Real-time co-editing** with live cursors and presence.
- **Playthrough mode** — read the story by walking the connections.
- **Organize** with folders, categories, an Explorer sidebar, a workspace-wide
  gallery, sharing, and templates.
- **Self-hosted** — one Debian package serves the app, API, WebSocket, and media on
  a single port, backed by a local PostgreSQL that installs itself. Nightly backups.

## 🚀 Install (Debian / Ubuntu)

foolsboard ships as a single self-contained `.deb`. On a Debian/Ubuntu server:

```bash
# 1. Build the package (needs dpkg-deb; Node only if the frontend isn't prebuilt)
packaging/build-deb.sh

# 2. Install it — auto-provisions PostgreSQL, config, media, and the service
sudo apt install ./build/foolsboard_<version>_all.deb
```

Then open **http://\<host\>:9534** (allow TCP 9534 through the firewall if needed).

The installer creates a `foolsboard` system user, a local Postgres database, a random
JWT secret, media storage under `/var/lib/foolsboard`, and a running
`foolsboard.service`. **The first account to register becomes the admin;** everyone
after signs up with an invite code the admin generates.

Manage it with systemd, and upgrade by installing a newer `.deb` (config + data are
preserved):

```bash
systemctl status foolsboard      # health
journalctl -u foolsboard -f      # logs
systemctl restart foolsboard     # restart
```

Full packaging, backup/restore, and reverse-proxy notes live in
[`packaging/README.md`](packaging/README.md).

## 🛠️ Develop

<details>
<summary>Run the frontend + backend locally</summary>

**Backend** (from `backend/`):

```bash
python -m venv .venv
.venv/bin/pip install -r requirements.txt -r requirements-postgres.txt
cp .env.example .env          # set DATABASE_URL (Postgres, or sqlite:///./foolsboard.db)
.venv/bin/alembic upgrade head
.venv/bin/python -m uvicorn app.main:app --reload      # http://127.0.0.1:8000
```

**Frontend** (from `frontend/`):

```bash
npm install
npm run dev      # http://localhost:5173  (proxies /api → the backend)
```

</details>

## Stack

| Layer | Choice |
|---|---|
| Frontend | React 19 · Vite · TypeScript · React Flow · TipTap · Yjs |
| Backend | FastAPI · SQLAlchemy 2 · Alembic |
| Database | PostgreSQL (SQLite for zero-install dev) |
| Media | Pluggable storage (local disk) |
| Packaging | Self-contained Debian `.deb` (systemd + auto-provisioned Postgres) |

<div align="center"><sub>Built for narrative. See the <a href="CHANGELOG.md">changelog</a> for what's new.</sub></div>
