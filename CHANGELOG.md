# Changelog

## v0.5.2

- **Grab a link's endpoint to reposition, reassign, or delete it** — the
  connection pins now live on the edge instead of inside the node card, so a
  drag survives crossing node boundaries. Drag an endpoint along its border to
  move it, onto another node to reassign that end (attaching at the exact point
  you release), or onto empty space to delete the link. While over empty space
  the link follows the cursor as a live preview.
- Removed React Flow's native edge reconnection (the pins now own that
  behaviour). New shared modules: `edgeGeometry` (snap math), `rfMappers`
  (edge mapping), and `boardContext` (board id for custom edges).

## v0.5.1

- **One-shot connection placement** — drawing a link now attaches it to the
  exact point on the target's border where you release the mouse, instead of
  snapping to one of four fixed anchors and requiring a second drag. Release on
  empty space and the link simply vanishes; a small latch margin attaches links
  dropped just outside a node to the nearest border point.
- Border-snap geometry is now shared (`edgeGeometry.ts`) between connection
  creation and pin dragging, so both place points identically.

## v0.5.0

- **Draggable connection points** — links now attach to a precise point on a
  node's border, not a fixed side anchor. With one connection on a side it
  centers automatically; with two or more you can drag each point along the
  border to position it. The offset (side + position) is persisted in
  `edge.data` and restored on reload.
- **Connection dots only when connected** — the little circles now appear only
  where an actual link attaches. The four-sided handles are now invisible "ghost"
  affordances that surface on hover for drawing new links.
- New custom `FloatingEdge` renders each link as a bezier computed from the
  stored border geometry, so the line always meets its draggable point.

## v0.4.0

- **Connect from any side** — every object now has connection handles on all
  four sides, and React Flow runs in loose mode, so a link can start or end on
  any side (top/right/bottom/left), in any direction.
- The side a link attaches to is persisted (in `edge.data`) and restored on
  reload. Links made before this update keep rendering (right→left fallback).

## v0.3.1

- **Fix:** the connection right-click menu opened and instantly closed itself
  (the opening `contextmenu` event bubbled to the menu's own outside-click
  listener). Outside-close listeners are now attached a frame later and ignore
  clicks inside the menu, so the menu stays open and is usable.

## v0.3.0

- **Node card previews** — each card now shows a preview line under the title
  (the first filled type-field, e.g. a character's role or a scene's location).
- **Connection editing** — right-click a link for a context menu:
  - *Edit label…* — annotate the branch (clearable) via the dialog.
  - *Insert node* — splits the connection (A→B becomes A→new→B).
  - *Delete connection*.
- **Reconnect / detach** — drag a link's endpoint onto another node to move it,
  or drop it on empty space to detach it.
- New reusable `ContextMenu`; `PromptDialog` gained an `allowEmpty` option;
  added `updateEdge` API.

## v0.2.1

- The canvas **Delete key** now routes through the confirm dialog whenever
  objects are involved (edge-only deletions stay instant). The panel's Delete
  button remains guarded too — both paths share the same dialog.
- Hardened fire-and-forget deletes against cascade 404s (deleting a node already
  removes its links on the backend).

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
