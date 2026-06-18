# Changelog

## v0.2.0

- **Board management** — rename and delete the active board from the top bar,
  using the animated gradient dialogs. Deleting the last board bootstraps a
  fresh one so the workspace is never empty.
- **Per-type node fields** — the context panel now shows structured fields based
  on the object type (e.g. scene → location/time/summary, character →
  role/traits/description). Values live in the node's `content` JSON, so new
  fields need no migration.
- **Delete confirmations** — deleting an object or a board now asks first via a
  gradient-overlay confirm dialog, preventing accidental loss.
- Reusable `PromptDialog` and new `ConfirmDialog` components.

## v0.1.0

- Initial release: infinite-canvas storyboard app.
- Backend: FastAPI + SQLAlchemy 2.0 + Alembic, database-agnostic via
  `DATABASE_URL` (Postgres active, SQLite fallback). CRUD for boards/nodes/edges
  plus media uploads through a pluggable storage backend.
- Frontend: React + Vite + TypeScript + React Flow. Infinite canvas with
  right-click-to-create, edge linking, drag-persist, and a context panel for
  editing objects and managing media.
- Animated gradient-overlay dialog for naming new boards.
