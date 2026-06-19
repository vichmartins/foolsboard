# Changelog

## v0.8.2

- Capitalized the side panel header to "Edit Object".

## v0.8.1

- The Type dropdown now shows capitalized labels (Scene, Character, …) while
  keeping the stored values lowercase.

## v0.8.0

- **Background media optimization** — uploads now return as soon as the file is
  stored, so video/audio appear immediately (playable original, with a thumbnail
  and an "optimizing…" badge). The compressed version is built in the background
  and swaps in automatically when ready. The swap is deferred while the file is
  open in the gallery, so playback is never interrupted (the panel polls for the
  finished version).
- **Faster encodes** — video compression uses GPU decoding (`-hwaccel cuda`) and
  a faster NVENC preset, with automatic fallback (nvenc → libx264) and an
  upload-time check that skips files already in an efficient codec/bitrate.
  Images still compress inline (they're fast).
- **Upload progress** — the panel shows a per-file progress bar during the byte
  transfer, then the "optimizing…" badge while the background pass runs.
- New `processing` flag on assets (migration `c3e8a91f5b22`); a startup safeguard
  clears it if the server restarts mid-encode so nothing sticks on "optimizing".

## v0.7.4

- Media tiles in the object panel now show the file name beneath each tile
  (truncated to two lines, full name still on hover), so audio and other files
  are identifiable at a glance.

## v0.7.3

- The app now reopens the **last board you had open** after a refresh or restart
  (remembered in localStorage), instead of always loading the first board.
- The Keyboard shortcuts dialog shows **Del or Backspace** for Delete selection.

## v0.7.2

- **Media compression on upload** — uploads are recompressed at high quality to
  shrink the storage footprint, keeping the result only when it's actually
  smaller (already-efficient files are left untouched):
  - Images → WebP (animated GIFs → animated WebP) via Pillow.
  - Video → H.264/AAC MP4, audio → Opus/Ogg via ffmpeg.
  - Any encode failure falls back to storing the original, so uploads never
    break. Tunable via config (`image_webp_quality`, `video_crf`, `video_preset`,
    `audio_bitrate`, `compress_media`). Applies to new uploads only.

## v0.7.1

- **Drag-and-drop media** — drag files onto the app to add them. With an object's
  panel open, an accent "Drop to add media" overlay appears and dropping uploads
  to that object (thumbnails generated as usual). With no panel open, a hint
  overlay explains to open an object first, and dropping uploads nothing. Only
  reacts to file drags, and always blocks the browser from opening the file.

## v0.7.0

- **Typed media + gallery** — the object panel now shows media as a grid of
  typed tiles and opens a full-screen gallery on click:
  - Images (incl. animated GIF/WEBP) render in place; hovering shows an enlarged
    preview, and the gallery supports zoom + pan (wheel, drag, buttons, keys).
  - Video and audio show a server-generated thumbnail (a video frame / embedded
    cover art via ffmpeg) with a play badge; the gallery plays them.
  - Any other file shows its extension on a tile and a download card in the
    gallery.
- Gallery supports keyboard navigation (←/→, Esc) and prev/next when a node has
  multiple media.
- Backend: assets gained a `thumbnail_key` (migration `b7f3c1d92a40`); thumbnails
  are generated with ffmpeg on upload, and media type is inferred from the file
  extension when the upload's MIME type is generic.

## v0.6.7

- Removed the top-bar hint sentence and moved its guidance into the Keyboard
  shortcuts dialog, which now also documents the mouse gestures (objects,
  connections, minimap).

## v0.6.6

- **Fix:** the right-click context menu got stuck after its first use (a
  re-render cleared the close timer, wedging it in a "closing" state). The
  listeners now attach once and the timer survives re-renders, so the menu
  reopens reliably.
- The app version is now read from `package.json` through the module graph
  instead of a build-time constant, so it updates on change without a
  dev-server restart.

## v0.6.5

- The object edit panel now slides in from the right when opened and slides back
  out when closed, instead of appearing/vanishing instantly. Respects
  reduced-motion.

## v0.6.4

- The right-click context menu now animates **closed** as well as open (it played
  no exit before), and the logo dropdown eases both open and close. Both respect
  reduced-motion.

## v0.6.3

- The right-click context menu now opens with a quick pop that grows from the
  cursor (fast, with a slight overshoot), and respects reduced-motion.

## v0.6.2

- A single click on an object now just selects it; the editing panel opens on
  double-click instead.

## v0.6.1

- Removed the Delete item from the object right-click menu (deletion stays on
  the Delete/Backspace key, with its confirmation). Duplicate's mnemonic is back
  to `D`.

## v0.6.0

- **Copy / cut / paste / duplicate** — right-click an object (or a multi-select
  box) for a clipboard menu, or use `Ctrl+C/X/V/D`. Menu items have underlined
  keyboard mnemonics. The clipboard persists in `localStorage`, so you can copy
  on one board and paste on another; internal connections come along too.
- **Merge boards** — a `Merge…` button in the top bar opens a dialog to pick one
  or more boards whose content is appended into the current board. Pasted/merged
  content is placed beside what's already there, never on top.
- **Undo / redo** — `Ctrl+Z` / `Ctrl+Shift+Z` (and `Ctrl+Y`) reverse paste, cut,
  duplicate, merge, and object moves.
- **Delete from the keyboard** — `Delete` / `Backspace` removes the selected
  objects *and* connections, always behind the confirmation dialog (which now
  also covers connection-only deletions). A `Delete` item was added to the
  object menu too.
- **Safer board deletion** — deleting a board now requires typing its exact name
  to confirm (pasting allowed).
- **Logo menu** — the foolsboard logo is now a dropdown with a keyboard-shortcut
  reference and the app version pinned at the bottom (version sourced from
  `package.json`).
- **Polish** — themed line icons for the rename/delete board buttons (replacing
  emoji), and themed clipboard menus.

## v0.5.6

- Themed the shift-drag selection box (and the bounding box around selected
  nodes) to use the app's accent color, slightly brighter than the default blue.

## v0.5.5

- **Click the minimap to navigate** — clicking anywhere on the minimap recenters
  the canvas on that spot with a quick animated pan, keeping the current zoom.
  Complements the existing drag-to-pan and scroll-to-zoom on the minimap.

## v0.5.4

- Tuned the dark-mode minimap mask so the current viewport stands out a little
  more clearly against the dimmed surrounding area.

## v0.5.3

- **Light/dark theme toggle** — a new sun/moon button in the top bar switches
  between a dark and a light palette. The choice is saved and restored, defaults
  to your OS preference on first visit, and is applied before first paint so
  there's no flash. Switching plays an animated circular wipe that expands from
  the button (View Transitions API, with an instant fallback and reduced-motion
  support); the icon spins as it swaps.
- **Themed canvas chrome** — the React Flow controls and minimap now match the
  app's palette in both themes instead of rendering bright white.

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
