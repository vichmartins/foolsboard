# foolsboard — commands

Quick reference for running and managing foolsboard in development and production.

## Dev (local machine)

Run the two halves in separate terminals.

**Backend** — from `backend/` (uses the project venv):

```powershell
.\.venv\Scripts\python -m foolsboard
```

Serves `http://127.0.0.1:8000` with auto-reload and the startup banner.
(`python -m app` and `python -m uvicorn app.main:app --reload` also work.)

**Frontend** — from `frontend/`:

```powershell
npm run foolsboard
```

(`npm run dev` is kept as an alias.)

Serves `http://localhost:5173` (plus LAN IPs for multi-device testing). It proxies
`/api` and `/media` to the backend, so start the backend too or you'll see
`http proxy error: ECONNREFUSED` until it's up.

**Backend tests** — from `backend/`:

```powershell
.\.venv\Scripts\python -m pytest
```

**First-time / rebuild setup**

```powershell
# backend (from backend/)
python -m venv .venv
.\.venv\Scripts\python -m pip install -r requirements.txt -r requirements-dev.txt

# frontend (from frontend/)
npm install
```

Tip: `.\.venv\Scripts\Activate.ps1` once, then plain `python -m app` / `pytest` work.

## Prod (Debian VM `10.1.40.45`, public `foolsboard.vicm.me`)

Production runs as a **systemd service** installed from the `.deb`, so it starts on
boot — there's no manual launch command. Manage it over SSH:

```bash
ssh -i ~/.ssh/foolsboard administrator@10.1.40.45

systemctl status foolsboard           # is it running?
sudo systemctl restart foolsboard     # restart
sudo systemctl stop foolsboard        # stop
sudo systemctl start foolsboard       # start
journalctl -u foolsboard -f           # live logs (shows the "foolsboard · ready" line)
curl -s localhost:9534/version.json   # which version is live
```

The app listens on `:9534`. The edge nginx host (`108.72.28.136`) terminates TLS and
reverse-proxies `foolsboard.vicm.me` → the VM.

**Deploying / promoting to prod** is a pipeline (build the frontend → bundle the
backend + dist → `scp` to the VM → `packaging/build-deb.sh` → `apt reinstall` →
verify `version.json`), not a single command. It's run from the local repo as part
of the dev → main promotion flow.
