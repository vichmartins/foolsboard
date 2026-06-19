# Changelog

## v0.15.4

- The top-bar New board / Merge / Import-Export actions are now themed line
  icons grouped with the rename/delete icons (tooltips + aria-labels retained).
- Import shows the same progress bar as export, and the export progress bar
  dropped its byte counter for a cleaner indeterminate bar.
- The import drag-and-drop target now uses the same accent pulse/glow animation
  as dragging media onto the side panel.

## v0.15.3

- Import / Export storyboards from a new top-bar button. Export bundles the
  selected boards into a .zip (manifest of the board graph plus a media/ folder
  with every attached file, built server-side with stdlib zipfile). Import reads
  such a bundle via a file picker or by dropping it on the dialog's drop zone,
  recreating the boards (with media) as new boards. The app-level file-drag is
  suppressed while a modal is open so a dropped bundle can't be mistaken for a
  media upload.
- The export streams the archive as it's built and shows a live progress bar
  with a running byte count, so large/media-heavy exports show their progress.

## v0.15.2

- Admin panel gained an Errors view: unhandled server exceptions are captured
  with their stack trace (a middleware logs them before the 500), stored in a
  new error_logs table, and shown in Logs > Errors as expandable rows. New
  migration.
- The user-management action buttons are now color-coded: admin (indigo),
  suspend (amber), activate (green), delete (red).

## v0.15.1

- Admin panel (admins only), opened from the profile menu, with tabs: Users
  (list accounts, toggle admin role, suspend/activate, delete — with self and
  last-admin guards), Invites (generate/copy/revoke codes, moved here from the
  standalone dialog), and Logs (the activity stream and the raw request log,
  each with a quick filter and load-more paging). Sign-out is now recorded
  server-side.

## v0.15.0

- Admin + logging backend (UI to follow). Accounts gained an active/suspended
  status (suspended users can't sign in and are dropped mid-session). New
  admin-only endpoints list users, change a user's admin role / active status
  (with self and last-admin guards), and delete users; account creation stays
  invite-only. Full logging: an HTTP middleware records every API request, and a
  curated activity log captures sign-in/out, register, board/object/link/media
  create-delete, invite changes, and admin actions. Log-query endpoints with
  filtering. New migration adds users.is_active and the activity_logs /
  request_logs tables.

## v0.14.6

- New objects are now created untyped instead of defaulting to Notes. An untyped
  object shows a neutral "Object" tag (a lighter gray, distinct from Notes'
  slate) on the card, in the panel header, and on the minimap; the Type dropdown
  starts on a "Choose a type…" placeholder with no type-specific fields until a
  type is picked. Existing objects keep their types.

## v0.14.5

- The "Note" object type now displays as "Notes" (dropdown, panel tag, node-card
  tag) via a display-label mapping. The stored type value stays "note", so no
  migration is needed and existing objects relabel instantly.

## v0.14.4

- Signing in/out now plays a smooth gradient "curtain" transition between the
  login screen and the canvas (covers, swaps underneath, reveals). The gradient
  is built from the theme's surface tokens, so it adapts to dark/light mode. A
  fresh page load with a valid token swaps without the curtain.

## v0.14.3

- Smoothed out the login error: it now lives inside the height-animated card
  body so the card eases open/closed around it (no layout snap), fades with
  opacity only, and no longer bounces because the error isn't cleared and reset
  on every submit attempt.

## v0.14.2

- The login error message now fades and slides in instead of appearing
  instantly, and re-animates on each failed attempt. Respects reduced-motion.

## v0.14.1

- The login screen now animates between Sign In and Register: the card height
  eases between layouts while the changed fields fade/slide in, instead of
  snapping. Respects reduced-motion.

## v0.14.0

- Added user accounts. A Romm-style login/register screen gates the app; the
  first account becomes the admin (no code), everyone after needs a single-use
  invite code (admin generates them from the profile menu). Each user's boards
  are private to them; the first account claims any pre-auth boards.
- Top-right profile menu with avatar (initials fallback) and a dropdown:
  account settings (username/email, profile photo, change password), invite
  codes (admin), and sign out.
- Backend: User + InviteCode models and Board.owner_id (new migration);
  PBKDF2 password hashing + HS256 tokens using only the standard library; every
  board/node/edge/asset/link endpoint now requires auth and enforces ownership.
  Set JWT_SECRET in backend/.env for non-local use.

## v0.13.3

- Faster board load: the last-opened board's graph is now prefetched in parallel
  with the board-list request (using the id saved in localStorage) and consumed
  once by the canvas, removing the list -> graph round-trip waterfall.

## v0.13.2

- Memory: React Flow now only renders nodes within the viewport
  (onlyRenderVisibleElements), so off-screen cards and their decoded images are
  unmounted — keeping memory roughly proportional to what's on screen. Node-card
  preview images are also released when the dropdown collapses (kept mounted only
  while open, plus a short window for the close animation).

## v0.13.1

- The node-card content preview now shows real media thumbnails and link
  preview cards, and clicking a thumbnail opens the full lightbox (image
  zoom/pan, video and audio playback, file download) -- portaled to the body so
  it isn't scaled by the canvas. Capped at 8 thumbnails (a "+N" tile opens the
  lightbox at the rest) and 4 link previews (with a "+N more" line).
- Double-clicking the preview chevron no longer also opens the edit panel.

## v0.13.0

- Node cards now show a chevron on hover that expands an in-card preview of the
  node's content (its type fields, array-field counts, and reference count),
  with a smooth eased height/fade animation. The toggle is isolated from node
  selection/drag and the preview reflects saved content.

## v0.12.1

- Nearby Nodes is now a bottom sheet pinned to the foot of the drawer that
  slides up to take half the height when toggled (smooth animation, no content
  reflow). Added a slider to control how many ranked nodes are shown, and a
  search box that filters across all nodes by their text (title, fields, link
  titles/URLs) to jump straight to a specific node.

## v0.12.0

- The gallery drawer gained a "Nearby nodes" section: browse the galleries of
  linked and spatially-close nodes, select their media and/or reference links,
  and pull them into the node being edited with one button. Media is shared via
  dedup (instant, added to Media); links are added to References. Nearby = linked
  nodes first, then the nearest by canvas distance.

## v0.11.2

- Backend: new POST /nodes/{id}/assets/reference endpoint attaches existing
  media (by asset id) to a node by sharing the stored file (dedup) instead of
  re-uploading. Foundation for pulling a nearby node's media into the node being
  edited; the in-panel UI for it is still to come.

## v0.11.1

- Backfill content hashes for media uploaded before dedup existed, so
  re-uploading already-stored media can deduplicate against it. Runs once on
  startup; best-effort (matches when the stored bytes equal a fresh upload).

## v0.11.0

- Media uploads are now deduplicated by content. Uploading the same file to a
  second node reuses the already-stored (and already-optimized) file instead of
  storing and re-compressing a copy, so it's instant. Assets carry a SHA-256
  content_hash (new migration); file deletion is reference-counted so a shared
  file is only removed when the last node referencing it drops it.

## v0.10.1

- Gave the side panel's References and Media sections more separation, and the
  Save/Delete buttons clear breathing room above and below. The standard form
  fields keep their original spacing.

## v0.10.0

- Added a "References" section to every object kind: paste a link and it renders
  a WhatsApp/Telegram-style preview card (thumbnail, title, description, site),
  with a + to add and a - to remove. Direct image links preview as the image.
  Stored in the node's content JSON (no migration).
- New backend endpoint GET /api/links/preview fetches a URL server-side (to
  dodge CORS) and parses Open Graph / meta tags, using only the standard library
  (urllib + html.parser). Rejects non-http(s) and private/loopback hosts.

## v0.9.5

- Fixed a horizontal scrollbar that briefly flashed and jolted the layout while
  the side panel / gallery drawer slid on and off screen, by clipping the canvas
  wrapper (overflow: hidden). The slide animations are now smooth.

## v0.9.4

- Character objects gained an "Animations" field: a repeatable list of rows,
  each a numeric identifier plus the animation the character performs. Stored in
  the node's content JSON, so no migration is needed.

## v0.9.3

- Esc now also closes the media hover preview, as the first step of the panel's
  Esc cascade (preview → gallery drawer → side panel → clear selection).
- The gallery drawer retracts with a panel-style horizontal slide, tucking
  behind the side panel on Esc/collapse; when the whole panel is dismissed by
  clicking away, the drawer fades out instead of racing the panel, which looks
  much smoother.
- Documented Esc in the keyboard shortcuts dialog and added a Gallery section
  (open viewer, expand/collapse drawer, navigate, Esc).

## v0.9.2

- Recolored Scene objects from indigo to sky-blue so they're distinguishable
  from the purple selection highlight on the minimap (the highlight color is
  unchanged).

## v0.9.1

- The Media section can expand into a retractable drawer that slides out to the
  left of the panel, overlaying the canvas, for browsing all of a node's files
  in a roomy scrollable area. The toggle arrow points left to expand and rotates
  to retract.
- Closing the panel while the gallery is expanded now animates the drawer out in
  sync with the panel instead of having it vanish.
- Esc now cascades: it closes an open lightbox/dialog/dropdown first, then the
  expanded gallery drawer, then the side panel, then clears any node selection.

## v0.9.0

- The shift-drag selection rectangle is now mirrored live on the minimap (drawn
  in flow coordinates against the minimap's viewBox, so it stays aligned through
  pan/zoom and clears on release).

## v0.8.9

- Merged-in content now arrives selected/highlighted (click empty canvas to
  deselect), and selected nodes are highlighted in the minimap (brighter indigo
  + white ring). The dark-mode minimap mask was lightened a little so off-screen
  highlights are visible.

## v0.8.8

- Replaced the panel's native Type `<select>` with a reusable themed, animated
  dropdown (`Select`) that matches the other fields and shows each type's color
  as a dot. Respects reduced-motion.

## v0.8.7

- Replaced the native board-picker `<select>` with a custom themed dropdown that
  matches the rest of the UI (light/dark), animates open and closed, highlights
  the active board, and respects reduced-motion.

## v0.8.6

- **Fix:** the Save/Delete buttons no longer flicker when saving. Save now uses
  an internal guard instead of the shared busy state (so it doesn't flash the
  disabled styling), and button opacity changes transition smoothly.

## v0.8.5

- **Fix:** top-bar buttons (New board, Merge, …) no longer turn near-black on
  hover in light mode — hover now uses a theme-aware `--bg-hover` token.
- Saving an object (Save button or Ctrl/Cmd+S) shows a brief "Saved ✓" toast in
  the panel instead of updating silently. Respects reduced-motion.

## v0.8.4

- Added right padding in the Keyboard shortcuts dialog so the key chips no longer
  crowd the scrollbar.

## v0.8.3

- The edit panel header now shows the object's title and colored type tag once it
  has real content (a non-default title or any filled field); a pristine new
  object still shows "Edit Object".
- **Ctrl/Cmd+S** saves while the panel is open (also listed in the shortcuts
  dialog).

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
