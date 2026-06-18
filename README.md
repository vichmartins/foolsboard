# foolsboard

An infinite-canvas storyboard app for building **branching storylines**. Create
objects (characters, scenes, dialog, events, ...), link them into an idea map,
and attach rich media to each one. Think *Miro / tldraw* meets *Trello*, built
for narrative.

## Stack

| Layer        | Choice                                          |
|--------------|-------------------------------------------------|
| Frontend     | React + Vite + TypeScript + React Flow          |
| Backend      | FastAPI (async JSON API)                         |
| ORM          | SQLAlchemy 2.0 (database-agnostic)               |
| Migrations   | Alembic                                          |
| Database     | Postgres (active); SQLite for zero-install dev   |
| Media        | Pluggable storage (local disk now, S3 later)    |

## Why it's portable

Nothing in the app code names a specific database. Models use portable column
types (UUID, JSON, timestamps via `func.now()`), and the connection string lives
only in `.env`. Switching databases is a one-line change followed by
`alembic upgrade head`.

## Run it (Windows)

**Backend** (from `backend/`):

```powershell
py -m venv .venv
.\.venv\Scripts\python.exe -m pip install -r requirements.txt -r requirements-postgres.txt
copy .env.example .env          # then set DATABASE_URL (see below)
.\.venv\Scripts\alembic.exe upgrade head
.\.venv\Scripts\python.exe -m uvicorn app.main:app --reload
```

**Frontend** (from `frontend/`):

```powershell
npm install
npm run dev      # http://localhost:5173  (proxies /api -> backend)
```

- API: http://127.0.0.1:8000 · Swagger: http://127.0.0.1:8000/docs
- Health: http://127.0.0.1:8000/api/health (reports the active DB dialect)

## Database

Active connection (in `.env`):

```
DATABASE_URL=postgresql+psycopg://foolsboard:<password>@127.0.0.1:5432/foolsboard
```

> Use `127.0.0.1`, not `localhost` — on this Windows + Postgres 18 setup
> `localhost` resolves to IPv6 `::1`, which `pg_hba.conf` handles differently.

One-time Postgres provisioning (as the `postgres` superuser):

```sql
CREATE ROLE foolsboard LOGIN PASSWORD '...';
CREATE DATABASE foolsboard OWNER foolsboard;
ALTER SCHEMA public OWNER TO foolsboard;   -- needed for table creation on PG 15+
```

To fall back to SQLite, point `DATABASE_URL` at `sqlite:///./foolsboard.db` and
re-run `alembic upgrade head`.

## API surface

| Method | Path                                   | Purpose                         |
|--------|----------------------------------------|---------------------------------|
| GET    | `/api/health`                          | Liveness + active DB dialect    |
| GET/POST | `/api/boards`                        | List / create boards            |
| GET/PATCH/DELETE | `/api/boards/{id}`           | Read / update / delete a board  |
| GET    | `/api/boards/{id}/graph`               | Whole board (nodes + edges)     |
| GET/POST | `/api/boards/{id}/nodes`             | List / create nodes             |
| PATCH/DELETE | `/api/boards/{id}/nodes/{nid}`   | Update / delete a node          |
| GET/POST | `/api/boards/{id}/edges`             | List / create edges             |
| PATCH/DELETE | `/api/boards/{id}/edges/{eid}`   | Update / delete an edge         |
| GET/POST | `/api/nodes/{id}/assets`             | List / upload media             |
| DELETE | `/api/nodes/{id}/assets/{aid}`         | Delete media                    |

## Project layout

```
backend/
  app/
    config.py        # env-driven settings
    database.py      # engine, session, Base
    storage.py       # pluggable media storage
    schemas.py       # Pydantic request/response models
    models/          # Board, Node, Edge, Asset
    routers/         # boards, nodes, edges, assets
  alembic/           # migrations
frontend/
  src/
    api.ts           # typed REST client
    components/      # Canvas, StoryNodeCard, ContextPanel
```

## Status

- [x] Backend: data model, CRUD API, media upload, migrations
- [x] Frontend: React Flow canvas, right-click-create, edges, context panel
- [x] Postgres: provisioned and active
- [x] Board management: create / rename / delete (animated dialogs)
- [x] Per-type structured node fields (scene/character/dialog/event/note)
- [x] Delete confirmations (gradient overlay)
- [ ] Auth (when needed)

See [CHANGELOG](CHANGELOG.md) for version history.
```
