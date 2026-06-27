# Changelog

## v0.87.1

- fix: On SQLite-backed installs, deleting a node now also removes its connections,
  and deleting a folder unfiles its boards instead of leaving dangling references
  (database foreign-key enforcement was off for SQLite). PostgreSQL was unaffected.


## v0.87.0

- feat: **Board templates.** Right-click a board → **Save as template** (marked with
  a ★); create fresh boards from it via **New board from template**.
- fix: Opening a board directly or making a private copy could error in some cases
  (an internal mismatch) — now fixed and covered by tests.


## v0.86.0

- feat: **Undo now covers content edits.** After you save changes to a node’s
  fields, Ctrl+Z reverts them (Ctrl+Shift+Z redoes) — alongside the existing undo
  for moving, creating, and deleting. If the edit panel is open it updates to match.


## v0.85.5

- feat: **Ctrl/Cmd-K opens workspace search** — jump straight to the Gallery’s
  search to find and open anything across all your boards from the keyboard.


## v0.85.4

- fix: Invite codes that have an expiry no longer error on SQLite-backed installs
  (a timezone comparison only worked on PostgreSQL).


## v0.85.3

- fix: **Export board as image** now works even when one or more nodes are
  expanded (their in-card preview was silently breaking the capture). The export
  shows the base board cards.
- improve: A confirmation toast appears after the board image is downloaded (and a
  clear message if an export ever fails).


## v0.85.2

- fix: The **What’s New** dialog now shows a category icon for documentation
  entries (they were rendering as a plain bullet).


## v0.85.1

- feat: **Toggle the Explorer sidebar with Ctrl/Cmd-B** (also listed under the
  keyboard shortcuts).


## v0.85.0

- feat: **Export a board as an image.** A button in the canvas controls
  (under the zoom/lock) saves the whole board — every card and connection — as a
  high-resolution PNG, named after the board.


## v0.84.6

- docs: Added a **Backups & Restore guide** to the installed package docs
  (`/usr/share/doc/foolsboard/BACKUP-RESTORE.md`) covering automatic/on-demand
  backups, the guided restore script, manual restore, off-host copies, and config.


## v0.84.5

- feat: Added an interactive **restore helper** (`sudo /opt/foolsboard/restore.sh`)
  — lists available backup snapshots, lets you pick one and choose database / media
  / both, takes a safety backup of the current state first, restores, re-applies
  migrations, and restarts the app.


## v0.84.4

- fix: “Run backup now” could fail writing its status file when the previous
  backup was the nightly (root) run. The status file is now written via a
  temp-and-rename, so manual and automatic backups interoperate cleanly.


## v0.84.3

- improve: Folders and categories in the sidebar now **expand and collapse with a
  smooth height animation** instead of snapping open/closed — the rows below glide
  along with them.


## v0.84.2

- feat: **Run backup now** button in Admin → Storage → Backups — triggers an
  immediate database + media backup (the same job the nightly timer runs) and
  refreshes the status when it finishes.
- fix: Added the standard `mobile-web-app-capable` meta tag (the Apple-prefixed
  one is deprecated), clearing a browser console warning.


## v0.84.1

- feat: **Admin → Storage** now shows a **Backups** panel — when the last backup
  ran, the retention window, how many copies are kept, total size, and the recent
  database dumps / media archives. Warns if the latest backup is over 2 days old.


## v0.84.0

- feat: **Automated nightly backups.** The installer now runs a daily backup —
  a full database dump plus an archive of all media — into `/var/backups/foolsboard`,
  keeping the last 14 days (configurable). Previously there were no backups at all;
  this protects your boards and media against disk loss or accidental deletion.


## v0.83.4

- fix: Reverted the frontend code-splitting from v0.83.2/v0.83.3. Measured on the
  deployment network, the whole bundle loads in ~35 ms, so splitting saved nothing
  on initial load while adding a noticeable delay the first time you opened the
  admin panel, gallery, or import/export. Everything is back in one bundle, so
  those surfaces open instantly again.


## v0.83.1

- improve: Saving a node/edge edit now reloads only the server-set timestamp
  instead of re-reading the whole row — lighter on the hot drag/edit path.
- improve: Live-collaboration state (cursors, presence, etc.) for boards you’ve
  navigated away from is now released instead of lingering for the whole session.
- fix: The sidebar no longer keeps expand/collapse state for deleted
  folders/categories in local storage.


## v0.83.0

- improve: The workspace **Gallery** payload is slimmer — it no longer ships each
  node’s coordinates/timestamps/board id or each connection’s metadata, none of
  which the gallery uses. Scales with workspace size; no change to what you see.


## v0.82.3

- fix: Dragging a card from the Gallery’s **Objects** tab now actually drops a
  copy onto the canvas. The drop was being accepted but never created the node,
  so it appeared to do nothing.


## v0.82.2

- fix: Renaming (and copying) media on a **shared board** as a collaborator now
  works. Referencing media was restricted to the board *owner*, so a
  collaborator’s rename self-heal silently failed; collaborators with accepted
  access can now reference media on boards shared with them.


## v0.82.1

- fix: Renaming a **copied** media item now works even for copies made before
  v0.82.0. Such copies shared the original’s asset, so the rename was rejected;
  renaming one now gives it its own asset first (sharing the file), then applies
  the new name.


## v0.82.0

- feat: Drag any card from the Gallery’s **Objects** tab onto the canvas to copy
  it onto the current board (previously only the **Media** tab was draggable).
- fix: Duplicated or pasted **media can now be renamed independently**. Copies
  used to share the original’s asset, so renaming a copy failed the ownership
  check; each copy now gets its own asset row (sharing the stored file).


## v0.81.1

- fix: Dragging a media item from the **Gallery** onto the canvas works again.
  The gallery was fading itself the instant the drag began, which aborted the
  drag mid-start; the fade is now applied a tick later so the drag survives.


## v0.81.0

- feat: The app now reopens the **last board you had open** even in a new
  browser or after clearing the cache — it’s remembered per-user on the server,
  not just in the local browser. (A brand-new account still starts on the empty
  “My first storyboard”.)


## v0.80.1

- fix: The Gallery’s **All boards** view (and the board picker) now includes
  every board — boards not filed in a folder or category were being left out.


## v0.80.0

- feat: Admin → Logs can now be **filtered**. Pick a **user** to see just their
  activity, requests, or errors; filter the Activity log by **action**; and the
  Request log by **status** (2xx / 3xx / 4xx / 5xx). The quick text filter over
  loaded rows still works on top of these.


## v0.79.2

- fix: Boards (and folders) filed into a category no longer **fall out** when you
  open the app in a new browser or the installed app. A load-time cleanup pass
  could wipe category memberships before all boards had finished loading
  (especially shared boards); it has been removed — the explorer already ignores
  any stale entries safely, so nothing is lost.


## v0.79.1

- fix: The app now adapts to narrow / resized windows (e.g. the installed PWA
  window). The top bar wraps its controls instead of overflowing, the canvas
  area shrinks to fit, and the stray window-level horizontal scrollbar is gone.


## v0.79.0

- feat: foolsboard is now an **installable app (PWA)**. Install it from your
  browser (e.g. the install icon in the address bar) for an app-like window in
  your taskbar/dock, and it loads **instantly on repeat visits**. If you lose
  connection, the app shell still opens (live board data needs a connection).


## v0.78.0

- feat: **Undo now covers deletes and new objects.** Deleting objects or
  connections can be reversed with Ctrl+Z (redo with Ctrl+Shift+Z or Ctrl+Y),
  and adding an object is undoable too — on top of moves, copy, cut, paste, and
  duplicate which were already undoable. (A deleted object’s attached media
  files are still removed permanently.)


## v0.77.0

- improve: Images now get a lightweight **preview thumbnail**. The gallery and
  object cards load small WebP previews instead of full-resolution files, so
  media-heavy boards and the gallery open much faster. (Full-size images still
  show on the canvas.) Existing images are upgraded in the background.
- improve: Opening a board you have already viewed — or one a collaborator just
  changed — now revalidates instead of re-downloading the whole board when
  nothing has changed, so navigation and live editing feel snappier.


## v0.76.1

- improve: System tab CPU, memory, and uptime now also report on Windows hosts
  (via the native API), not only Linux — so the dev preview is fully populated
  too.


## v0.76.0

- feat: New Admin → **System** tab with live server vitals — CPU, memory, disk,
  media-storage size, database size, and uptime — plus workspace counts (users,
  boards, objects, media). Auto-refreshes every few seconds. (CPU/memory show on
  the Linux server; values a host cannot provide show as “—”.)


## v0.75.1

- fix: The Storage auto-cleanup field no longer stays disabled when the current
  value fails to load — it now enables once the request settles and shows an
  error instead of silently locking.


## v0.75.0

- feat: Admin → Storage now has an **auto-cleanup** setting — orphaned media is
  removed automatically once it has been unreferenced for a configurable grace
  period (default **90 days**; set 0 to disable). The manual cleanup still
  removes orphans of any age on demand.
- improve: API responses are now **gzip-compressed**, so opening boards, the
  gallery, and lists transfers far less data and loads noticeably faster —
  especially over the internet. (Media is left uncompressed so video seeking
  keeps working.)
- improve: App code bundles are cached by the browser as immutable, removing a
  revalidation round-trip per file on every load.
- improve: Trimmed an unused field from media responses and stopped redundant
  update-checks during reconnects.


## v0.74.3

- feat: The "What's New" changelog is now available any time — open it from the
  logo menu (next to Keyboard Shortcuts), not just after an update.


## v0.74.2

- feat: Admin Panel now has a **Storage** tab — scan for orphaned media files
  (no longer referenced by any object, thumbnail, or avatar) and reclaim the
  space. Scanning is read-only; deletion is confirmed.


## v0.74.1

- improve: Large media uses far less server memory — recompressed video/audio
  and uploaded import bundles now stream to/from disk instead of being held
  whole in RAM, so big files no longer risk exhausting memory.
- improve: Sharing lists and board copies run in a few database queries instead
  of one-per-item.
- improve: Admins can reclaim orphaned media files (a Storage GC action), and
  old raw request logs are pruned automatically so the database stays lean.
- improve: Uploaded/avatar images are guarded against malicious "decompression
  bomb" files that would otherwise spike memory.


## v0.74.0

- improve: Deleting a board, object, or media file now also removes the
  underlying stored files. Previously those files were orphaned on disk and
  storage grew forever; cleanup is dedup-aware so a file shared by other items
  is kept until its last reference is gone.
- improve: The cross-board Gallery loads in a constant 3 database queries
  instead of 3 per board, so it stays fast for large workspaces.
- improve: Media files are now cached by the browser (immutable content), so
  repeat views load instantly and use less bandwidth.
- improve: Added database indexes (media keys, log timestamps) so media deletes
  and the admin log views stay fast as the data grows.


## v0.73.5

- improve: Media and link nodes carry a **purple accent** in the gallery (the
  card's side stripe) and the minimap; their card on the canvas stays neutral
  like every other node.

## v0.73.2

- improve: Every entry in this changelog is now categorized, so the "What's New"
  dialog shows the right icon (feature / fix / improvement) for each one
  throughout the full history.

## v0.73.1

- improve: **Content-Security-Policy is now enforced** (it ran in monitor-only
  mode through v0.73.0 with no violations). The browser now blocks any
  script/resource that isn't from an approved same-origin source, hardening the
  app against injected-code (XSS) attacks.

## v0.73.0

- feat: **"What's New" dialog** — after an update, the first time you open the app
  you get a changelog of what changed, with icons for new features vs. fixes,
  scrollable through the full history.

## v0.72.22

- feat: Drag media onto the canvas from an **expanded card's preview** (a new
  source, alongside the Gallery, an object's Media, and the drawer).
- feat: Press **Esc** to cancel an in-progress drag.
- feat: Zoom the canvas out much further to take in a whole large board.
- fix: Dragging a media tile started the browser's image drag instead of placing
  it — tiles now drag correctly from the panel, drawer, and Gallery.
- fix: Dragging an image file from your computer onto the canvas (and into an
  object's Media) was silently rejected in Chromium; it works reliably now.
- fix: The "Drop to place it on the canvas" overlay no longer sticks after a drop.
- fix: The Gallery now stays open when you cancel a drag instead of closing.

## v0.72.9

- improve: Cleaner **download** and **resize** icons that match the app's style.

## v0.72.6

- feat: **Download media** from anywhere — a canvas node, an object's Media, the
  drawer, the Gallery, and the node right-click menu.

## v0.72.5

- feat: **Resize** image/video/audio nodes by dragging the corner grip.
- fix: A resized video no longer overflows its frame — the node grows with it.
- fix: The media rename box is centered instead of stuck to the left.

## v0.72.3

- feat: Drop a media node onto an object to **file it into that object's Media**
  (duplicates are skipped).
- feat: Standalone media on a board shows **which board it's on** in the Gallery.

## v0.72.1

- feat: **Rename media** from the canvas and the Gallery (on top of the Media
  section and drawer).

## v0.72.0

- feat: **Pink Mode** — a third theme with a vivid pink accent (#F611FF); the
  theme button now cycles Dark → Light → Pink.

## v0.71.3

- fix: Gallery object cards wrap long filenames instead of spilling past the card.
- fix: Gallery link cards no longer collapse into thin squished bars.

## v0.71.2

- fix: Transparent PNG/WebP image nodes show the canvas through them.
- fix: Long media filenames in the Gallery truncate with an ellipsis.
- fix: Wide link thumbnails are no longer cropped to a thin squished slice.

## v0.71.1

- improve: Multi-select highlight now shows clearly on the active board too.

## v0.71.0

- feat: **Multi-select in the explorer** — Cmd/Ctrl-click, Shift-click for a
  range, then drag the whole set to move several boards/folders at once.

## v0.70.2

- feat: **Remove media nodes from the board** — a ✕ badge on hover, plus a
  **Delete** item in the right-click menu (which was missing for every node).
  Both confirm, then delete the node and free its file.

## v0.70.1

- feat: **Drag existing media onto the canvas** to place it as a node — from an
  object's Media section or the Gallery. It references the same file (no
  re-upload).

## v0.70.0

- feat: **Media on the canvas.** Drop an image, video, audio clip, or any file
  onto an empty part of the board and it becomes a standalone node you can drag
  around and connect — images render inline, video/audio get players, files show
  a download card, and a link becomes a link-preview node.

## v0.69.1

- fix: Timestamps saved before the YouTube preview fix (URL but no thumbnail)
  now self-heal — the field re-fetches the preview on open and fills it in.

## v0.69.0

- fix: **YouTube link previews now work** (References and Timestamps): titles and
  thumbnails are fetched via YouTube's oEmbed API, which doesn't hit the
  consent/bot walls that blocked plain scraping.
- feat: An object's expanded card preview now shows its **Timestamps** too (with
  the thumbnail + time), alongside References, fields, and media.

## v0.68.3

- fix: Renaming a media file can no longer change its extension/type — you edit
  only the base name and the original extension is kept.

## v0.68.2

- feat: **Timestamps are link-based** — paste a video link with a time (e.g.
  `youtu.be/…?t=658`) for a rich preview (thumbnail + title) with the time as a
  badge; clicking opens the video at that exact moment.

## v0.68.1

- feat: **Timestamps field** on every object type (alongside References): add time
  markers (free-form time + an optional note).

## v0.68.0

- feat: **Rename media files** — click a media item's filename in an object's
  Media section to rename it (the original extension is kept if you drop it).

## v0.67.3

- fix: Dragging a media item that's already attached to an object no longer pops the
  "Drop to add media" upload overlay. Only real files dragged in from outside the
  app trigger it now (internal drags are detected via dragstart).

## v0.67.2

- fix: The "editing …" status now follows the object's real name. Renaming a
  freshly-created object (default "New object") updates the badge for
  collaborators instead of staying stuck on "New object".

## v0.67.1

- feat: The explorer is now **resizable** — drag its right edge. The width is clamped
  (can't be dragged too narrow) and remembered across sessions.

## v0.67.0

- fix: **No duplicate media.** Adding the same file to a node again (re-upload or
  pulling it from a nearby node) no longer creates a second copy — the node keeps
  one entry per distinct file.

## v0.66.4

- improve: Explorer create inputs now use title-case placeholders ("Board Name", "Folder
  Name", "Category Name").
- fix: On a board shared *with* you, the top-bar Share button is now hidden (it was
  faded/disabled) — matching how Delete is hidden, since you can't share a board
  you don't own.

## v0.66.3

- fix: Remote cursors are now smoothed the same way as nodes (eased toward the latest
  position) instead of via a delayed replay buffer — so a collaborator's cursor
  stays glued to the node they're dragging instead of lagging and swinging
  around. Cursor position also keeps streaming during a node drag (the pane's
  pointer events can otherwise be swallowed mid-drag).

## v0.66.2

- fix: After a shift-drag multi-select, the redundant bounding box React Flow draws
  around the selection is now hidden (each node already shows its own highlight
  ring); the live rubber band is unchanged, and group dragging still works.

## v0.66.1

- fix: Connections now move in lockstep with their nodes during remote drags. Remote
  node positions are eased on a frame loop (instead of a CSS transform
  transition), so React Flow recomputes each node *and its edges* together —
  edges no longer snap ahead while the node glides.

## v0.66.0

- improve: **Jitter buffer for remote cursors.** Other people's cursors now play back from
  a short (~100ms) buffer on a steady animation-frame loop and interpolate
  between samples, so they stay smooth even when packets arrive unevenly (e.g. a
  collaborator on a distant/jittery connection). Cursor position updates no
  longer re-render React each sample.
- fix: Remote selection/edit outlines moved into a viewport-transformed layer, so they
  glide with a dragged node but no longer lag while you pan/zoom.

## v0.65.0

- improve: **Smoother live collaboration.** Other people's cursors, selection/edit
  outlines, and dragged nodes now interpolate between network samples instead of
  snapping, so movement glides instead of looking sluggish. The node you're
  actively dragging stays exactly 1:1 with your pointer. Cursor/position updates
  also stream a bit faster (~30 fps).

## v0.64.4

- fix: A collaborator's selection highlight no longer covers the "✎ editing" badge on
  a node they're editing — the edit-lock outline + badge now paint above the
  selection outline.

## v0.64.3

- fix: Removed the faint outline ring around presence avatars entirely (it showed in
  both themes). Active avatars still pulse in the collaborator's color.

## v0.64.2

- fix: Fixed explorer rows jittering when you **select** an item (most visible with
  shared boards): the reorder animation now only runs when the item order
  actually changes, not on every re-render (selection, presence updates, etc.).

## v0.64.1

- feat: Added a **moving** status badge (four-way-arrows) — shown while a collaborator
  has a Move dialog open (moving a board/folder into a folder/category, or moving
  objects to another board).

## v0.64.0

- feat: **Status badges for what collaborators are doing.** Beyond editing/uploading, a
  collaborator's avatar now shows a badge for: viewing (eye), browsing the
  gallery, merging, importing/exporting, creating, renaming, downloading, and
  away-from-keyboard (after 3 min idle). Active states pulse; viewing/away are
  calm. Admin/settings actions aren't broadcast. New `activity` realtime channel.

## v0.63.1

- improve: The **Create** dialog's "Place in" picker uses themed folder/category line icons
  instead of emoji glyphs (the Select control now supports real icons).
- improve: The **category icon** now shows in the Merge and Move pickers, matching boards
  and folders.

## v0.63.0

- feat: The top-bar **Categories** picker gains an **A→Z / Z→A** sort toggle, matching
  the Folders picker; the order applies to the explorer too. Sorting is now
  natural and case-insensitive (numbers sort 2 before 10) for both folders and
  categories.

## v0.62.2

- fix: Fixed a category showing a non-zero count in **Import/Export** while the
  explorer showed it empty: both now ignore items pointing at a deleted
  board/folder. On load, such dead references are also pruned from the saved
  layout once — so they stop reappearing anywhere.

## v0.62.1

- improve: Made the **Export** tree visually match the **Merge** picker — same panel, rows,
  chevrons, icons, and board rows — so the two dialogs feel uniform with the rest
  of the app.

## v0.62.0

- feat: The **Export** tab is now a navigable tree (like the Merge picker): expand
  categories and folders with a chevron and tick a checkbox at any level —
  category, folder, or individual board. Replaces the old flat grouped lists.

## v0.61.0

- improve: Categories in the explorer now show the **category icon** next to their name,
  matching how boards and folders display their icons.

## v0.60.5

- fix: Dragging a board over an **open folder** now shows only the soft "drop inside"
  highlight — no stray insertion line near its contents. (The line came from the
  folder header's "after" edge sitting just above the folder's first board.)
  Collapsed folders still reorder by their edges; folders still reorder freely.

## v0.60.4

- fix: The drag **insertion line** is now a clean straight bar between rows. It was an
  inset shadow that followed each row's rounded corners, so it curled around the
  corners (especially at the very top/bottom of a list).

## v0.60.3

- fix: Fixed the remaining drag **stutter** (worse with more items / near the bottom):
  the reorder FLIP animation no longer measures every row on each drag-over —
  it's paused during a drag and only animates the real reorder once you drop.
- improve: Softened the drop highlights: the **top list**, **categories**, and **folders**
  now show a faint tint instead of a hard bordered box while dragging onto them.

## v0.60.2

- fix: Dragging items around an **open folder** no longer flashes a stray highlight
  box over the whole top/category area — the folder's body is now its own "drop
  into this folder" zone, and the highlight covers the folder block.

## v0.60.1

- fix: Fixed explorer items still **jittering** while dragging inside a category — the
  per-row drag-leave flickered whenever the cursor crossed onto a child element;
  the indicators are now cleared on drag end instead.

## v0.60.0

- feat: The node **Move** dialog (top bar + right-click) now navigates folders and
  categories to find the destination board, instead of a flat list.
- improve: **Gallery**: the three scope fields sit on one row; Category/Folder start
  empty and the board picker no longer dumps every board — it stays on the
  active board until you pick a category or folder to browse.
- improve: **Import/Export**: the dialog is bounded and scrolls (no more cut-off at the
  bottom), and a new **Everything** toggle exports all categories/folders/boards
  in one click.
- improve: **Merge** picker restyled into a bordered panel with accent checkboxes.

## v0.59.0

- fix: Fixed dragging in the explorer **jittering** while hovering — the reorder hint
  no longer forces a re-render on every drag-over event.
- fix: A category that still listed a **deleted board/folder** showed a phantom count
  and an empty body; the count and contents now only reflect items that exist.
- fix: The **New Category** name box now matches the board/folder inputs (no more
  oversized uppercase text while typing).

## v0.58.0

- feat: **Import/Export now includes categories.** In Export, pick categories
  (alongside folders/boards) — the bundle carries each category's structure.
  Importing recreates those categories, re-linking the freshly imported
  folders/boards. (Bundle format v4; older bundles still import.)

## v0.57.0

- feat: **Gallery** now lets you narrow by **category** and **folder** before picking a
  board, instead of one long flat board list.

## v0.56.0

- feat: **Create Private Copy** now opens a destination picker — choose a folder or
  category for the copy (defaults to the top level / All Boards).
- improve: **Merge** redesigned: navigate your folders and categories to find boards to
  merge in, instead of a flat list. Shared boards are shown faded and can't be
  selected (merging deletes the source).

## v0.55.0

- improve: Top-left Folder and Category pickers now use themed line icons instead of emoji
  glyphs.
- feat: Added **Move to…** to the right-click menu for both boards and folders (folders
  move into a category or to the top level).

## v0.54.0

- feat: **Categories picker in the top bar**, left of the folder picker. Selecting a
  category scopes the folder and board pickers to what's filed in it (its
  folders/boards + boards inside those folders); "All Categories" clears it. You
  can also create/rename/delete categories from here.
- feat: **Move** (top bar) now sends the open board into a folder **or** a category
  (or to the top level).
- feat: **Create** (top bar "+") is now a chooser: make a Board, Folder, or Category,
  and optionally place a new board/folder into a folder or category.

## v0.53.1

- fix: Fixed: users on a plain-HTTP LAN address (not localhost/HTTPS) couldn't create
  Categories, and uploads could fail, because `crypto.randomUUID` is undefined in
  insecure browser contexts. Added a `genId()` fallback.

## v0.53.0

- feat: **Reorderable categories**: drag a category section onto another to move it
  up/down the list. The category body is now a drop target too, so items can be
  filed/reordered by dropping anywhere inside it.
- improve: **Smooth reordering**: rows now glide (FLIP animation) to their new position
  instead of snapping.
- improve: **New board icon** — a small linked-nodes glyph replaces the plain dot, and
  turns accent on the active board.
- improve: **Cleaner category labels**: dropped the wide-tracked uppercase styling for a
  calmer 12px label that sits better with board/folder names.

## v0.52.1

- fix: **Folders no longer nest.** A folder dragged onto another folder now reorders
  (before/after) like any other item, so folders move up and down freely among
  boards. Dropping a **board** onto the middle of a folder still files it inside
  the folder — only folder-into-folder nesting was removed.

## v0.52.0

- feat: **Reorder by dragging**: drop a board or folder onto the top/bottom half of
  another row to place it before/after — within the top list or any category. An
  accent insertion line shows where it'll land. The manual order persists
  per-user (`top` array in the explorer layout). Folders still nest when dropped
  on the middle of another folder.

## v0.51.0

- feat: **Nested folders**: drag a folder onto another folder to nest it inside.
  Folders render recursively in the explorer; dragging a nested folder back onto
  a category or the top un-nests it. Cycles are rejected server-side
  (`PATCH /api/folders/{id}/parent`, new `folders.parent_folder_id` column).

## v0.50.1

- feat: Explorer header now has **three** create buttons: New Board, New Folder, New
  Category.
- feat: **Folders gained board-level actions**: a "+" to create a board inside, Share,
  Rename, Delete — both as hover tools and a right-click context menu.

## v0.50.0

Explorer redesign — user-defined **Categories**:

- feat: The fixed Ungrouped / Shared / Shared-with-me sections are gone. Instead you
  create your own **Categories** — collapsible sections (VSCode Outline/Timeline
  style, expand/collapse with the arrow) — and file folders and boards into them.
- feat: **+ on a category** creates a new folder or board inside it; the header buttons
  add a new Category or a top-level folder.
- feat: **Drag** a board or folder onto a category to file it; drag a board onto a
  folder to move it inside; drag to the top area to uncategorize.
- feat: Boards/folders not in any category sit at the **top** with no header.
- feat: You can categorize **shared boards** too (saved per-user). Layout persists via
  the new per-user categories store.

## v0.49.0

- feat: Explorer: boards you own and have shared out now collect into their own
  **"Shared"** category (shown only when you have some), mirroring "Shared with
  me". They're pulled out of their folders / Ungrouped while shared.

## v0.48.5

- improve: Unified the sharing indicator into a right-aligned **share mark** = presence dot
  + two-person icon, used in the board picker (pill + dropdown) and the file
  explorer:
  - **Owner** (shared out): accent/purple icon, with the dot now *before* the
    icon (flipped).
  - **Recipient** (shared with you): the same icon in **grey**, replacing the
    owner's name (owner still shown on hover).

## v0.48.4

- fix: Restored the drag grip on the left of shared board rows in the picker dropdown
  (it now shows on every row), now that the presence dot moved to the right.

## v0.48.3

- improve: For a recipient, the board picker dropdown now shows the presence dot on the
  **right**, beside the owner's name (instead of on the left), matching the
  owner's layout.

## v0.48.2

- improve: In the board picker dropdown, an owner's shared-out board now shows the
  two-person owner mark (+ presence dot) on the **right** of the row (with the
  drag grip back on the left), instead of on the left.

## v0.48.1

- improve: The owner now sees a presence dot beside the two-person owner mark on their
  shared-out boards (board picker pill + dropdown), matching the recipient view,
  instead of the icon itself recoloring.

## v0.48.0

- fix: **Presence dots now reflect *any* collaborator, not just the owner.** A shared
  board's dot is lit when **anyone** (owner or another sharee) is on that board,
  dimmed when a collaborator is online elsewhere, and dark when none are online —
  so it no longer reads "empty" while two sharees are actively collaborating.
- fix: **Works on the owner's side too:** the two-person owner mark on your shared-out
  boards now pulses/dims/greys with that same presence.
- feat: Backend exposes each board's `member_ids` (owner + accepted collaborators,
  including via shared folders) to drive it.

## v0.47.0

- feat: **Search boxes now support regular expressions.** The node drawer search, the
  board gallery search, and the admin log filters treat your query as a
  case-insensitive regex (e.g. `scene|act`, `ch.*2`, `^intro`). Plain words still
  work as before (they match as a substring), and a half-typed/invalid pattern
  falls back to a plain substring match. Inputs note "Supports regular
  expressions" on hover.

## v0.46.1

- improve: Presence dots now ease smoothly between here/away/offline, and the lit ("here")
  dot softly pulses, instead of snapping between states.

## v0.46.0

- feat: **Shared-board dots now show the owner's live presence.** In the explorer and
  the board picker, a shared board's dot is **lit (with a glow)** when its owner
  is on that board, **dimmed** when they're online but on another board, and
  **dark/grey** when they're offline. Hover for "<owner> is on this board /
  online (another board) / offline".
- feat: Backend broadcasts a lightweight global presence roster (who's online + which
  board) to all clients; boards now expose `owner_id`. Single-process only (a
  multi-worker deploy would need external pub/sub).

## v0.45.1

- improve: Replaced the owner crown with a two-person "users" icon (Feather outline style,
  themed to the accent) on shared-out boards/folders.
- improve: Unshare button tooltip is now just "Unshare".

## v0.45.0

- feat: **Presence avatars now show what each collaborator is doing.** An avatar gains
  a small badge and a pulsing ring when that person is **editing** (✎) or
  **uploading** (↑) a node, and its tooltip says which node — e.g. "Steven —
  editing 'Scene 2'" or "uploading to 'Cover'". Idle viewers show no badge.
- improve: Avatars **pop in when someone joins and pop out when they leave** (smooth
  scale/fade), instead of appearing/vanishing instantly.
- improve: The separate upload-activity chips were folded into the avatars (one place for
  "who's here and what they're up to"). Edit/upload signals now carry the node
  title.

## v0.44.3

- fix: The minimap now paints selected nodes in your highlight color too (was a fixed
  indigo), matching the canvas and the shift-drag box.

## v0.44.2

- improve: The shift-drag selection box (and its minimap mirror) now uses your chosen
  highlight color instead of a fixed indigo.

## v0.44.1

- improve: Reworked the highlight-color picker per feedback:
  - Moved it from Account Settings to a new **Preferences** dialog (profile menu).
  - **Pick any color, always** — the uniqueness lock is gone. If your color
    clashes with a collaborator's, each of you simply sees the *other* in a
    different color (resolved per-viewer on the client); your own stays exactly
    what you chose.
  - The palette now **avoids the object-type colors** (scene/character/dialog/
    event/note/object), so a highlight never looks like a node type.

## v0.44.0

- feat: **Pick your own collaborator color.** Account Settings now has a "Highlight
  color" picker — the color others see for your cursor and selections. Each user
  gets a random color on sign-up; you can change it any time, and colors already
  in use by other users are disabled. Changing it recolors your cursor/highlights
  on everyone's screen live (no refresh).
  - Backend: `users.color` column (migration), assigned on register and
    backfilled for existing users; `GET /api/auth/colors` and
    `PATCH /api/auth/me/color` (validates the palette + uniqueness); the WS hub
    now carries each connection's chosen color and broadcasts changes. Palette
    expanded to 12 colors.

## v0.43.0

- fix: **Selection highlights now match at any zoom.** Remote selection/edit outlines
  scale their border, radius, and glow with the viewport zoom, so a selected node
  looks the same on every screen (just tinted per user) instead of a fixed-width
  ring that drifted from the card at non-100% zoom.
- feat: **Sharing management.** Right-clicking a shared board in the explorer now offers
  **Unshare** and **Create Private Copy** (owner or recipient); a recipient can no
  longer Delete the owner's board — the top bar shows Unshare instead of Delete
  for shared boards. New `DELETE /api/shares/by-board/{id}` (owner unshares for
  all; recipient leaves), pushed live to the other party.
- improve: Renamed **"Make a Private Copy" → "Create Private Copy"**.

## v0.42.1

- improve: Redrew the owner crown as a thin **outline icon** in the same Feather/line style
  as the app's other icons (it was a filled shape that clashed with the theme).

## v0.42.0

- feat: **Explorer: "Shared with me" category.** Boards shared with you now appear in
  their own section in the left explorer (like "Ungrouped"), each showing the
  owner's name; shared folders are flattened into it rather than shown as folders.
- improve: **Consistent selection highlights.** Your own selected node now rings in your
  stable collaborator color (the same one others see for you) instead of the
  node's type color, and remote selection outlines were restyled to match — so a
  selected node looks the same for everyone, just in each user's color.

## v0.41.1

- improve: Refined the shared indicators in the navbar pickers:
  - The owner marker is now a **flat themed crown** (muted-gold SVG) instead of
    the 👑 emoji, so it fits the dark theme.
  - The dot/crown moved to the **right** of the board/folder pill.
  - A recipient now sees the **owner's name** next to the dot (e.g. the board
    Steven shared shows "· Steven"), and on shared rows in the dropdown.

## v0.41.0

- feat: **Shared-item badges in the top navbar.** Boards and folders now show, on the
  left of their picker pill (and in the dropdown lists): a **dot** when the item
  was shared *with* you, or a **👑 crown** when *you own it and have shared it
  out*. Updates live as shares are created/accepted/rejected/removed.
- feat: Backend exposes `shared_out` on boards/folders (owner has ≥1 pending/accepted
  share); creating a share now also pings the owner so their crown appears at once.

## v0.40.1

- improve: Edit-lock polish: a node someone else is editing is now also **non-selectable**,
  so your highlight can't overlap their "editing" name tag.
- fix: Collaborator selection/edit outlines no longer **bleed over the minimap or
  zoom controls** (raised those above the collaborator overlay).

## v0.40.0

Collaborative edit locks (part 1 of the live-editing visibility work):

- feat: **One editor per node.** When you open a node's editor, collaborators see it
  ringed in your color with an **"✎ {you} editing"** tag, and they can't open or
  drag it until you close it. Trying to open a node someone else is editing shows
  a brief "🔒 {name} is editing" notice instead.
- feat: The lock releases when you close the panel, switch nodes, or disconnect
  (handled via the existing presence cleanup — no stuck locks).
- feat: Built on a dedicated low-frequency realtime channel so the canvas reacts to
  lock changes without re-rendering on cursor traffic.

Still to come: per-status activity colors on the presence avatars, owner-side
visibility of who a board is shared with, and locking connections (edges) too.

## v0.39.1

- feat: Share status now distinguishes **"Pending"** (invite still live, unanswered)
  from **"No response"** (the recipient let the countdown run out). Previously an
  unanswered invite showed "No response" right away. Letting the banner lapse now
  records a distinct `lapsed` state and pushes it to the owner live; re-sharing a
  lapsed (or rejected) invite re-offers it.

## v0.39.0

Real-time share invites & status:

- feat: **Invites arrive instantly.** A new share now pushes over the WebSocket to the
  recipient's open tabs the moment it's created, instead of waiting up to 15s for
  the next poll (the poll stays as a 30s fallback for offline tabs).
- feat: **The owner sees responses live.** Accept/reject/remove now push to the owner,
  so the Share dialog updates the recipient's status without a refresh or reopen.
- improve: **Clearer status wording.** A recipient who hasn't answered shows as
  **"No response"** (was the raw "pending"), so doing nothing never reads as
  "Rejected" — only an explicit Reject does.

## v0.38.0

Security hardening pass:

- fix: **Uploaded SVG/HTML can no longer execute as a page.** `/media` now serves
  documents-that-could-run-scripts (svg, html, xml) with `Content-Disposition:
  attachment`, so opening such a URL downloads it instead of running it. They
  still display normally as `<img>`/`<video>`. Also added `X-Content-Type-Options:
  nosniff`, `X-Frame-Options: DENY`, and `Referrer-Policy: no-referrer` site-wide.
- fix: **Reference-link URLs are scheme-checked.** A user-supplied link with a
  `javascript:`/`data:`/`vbscript:` scheme (incl. control-char-obfuscated ones)
  no longer renders as a clickable link — only `http`/`https`/`mailto`/`tel` pass.
- feat: **Login is rate-limited** — 10 failed attempts per IP per 10 minutes returns
  429; a successful sign-in clears the counter.
- feat: **Content-Security-Policy** added in **Report-Only** mode (so it can't break
  anything yet); once verified clean on a deploy it'll switch to enforcing.

Note: JWT verification was reviewed and is sound (always recomputes HS256, so
`alg:none`/algorithm-confusion attacks fail). Put the app behind TLS before any
untrusted-network exposure.

## v0.37.2

- improve: The toast (e.g. "A board can't merge into itself.") now fades and slides away
  on exit instead of vanishing abruptly, mirroring its entrance. Repeated
  identical messages re-trigger it.

## v0.37.1

- improve: The upload-rejection warning now auto-dismisses: it holds for ~5.5s, then fades
  and collapses away with a smooth animation (instead of lingering until the next
  upload).

## v0.37.0

- feat: Upload size limits, by type: images ≤ 5 MB, video ≤ 50 MB, audio ≤ 20 MB, and
  anything else ≤ 50 MB. Enforced server-side (the authoritative check, returning
  413 with a clear message), with a matching client-side pre-check so oversized
  files are rejected instantly — with a red note under the Media header — instead
  of uploading and then failing.

## v0.36.0

- feat: "New version available" prompt. When a newer build is deployed, open tabs now
  show a small top-center banner with a Reload button instead of silently running
  stale code — it never force-reloads, so it can't interrupt your work, and it's
  dismissible. The running bundle knows its build version; the deploy ships a
  version.json, and the app compares them when the collaboration socket
  reconnects (which happens on every deploy), on window focus, and on a slow
  interval. Production only — dev keeps using Vite's hot reload.

## v0.35.3

- improve: Extended the highlighted-name treatment to the Share and Move-to-Folder
  dialogs, so the board/folder name stands out (accent + semibold) there too —
  matching Merge and Delete. (The top-bar Merge dialog already highlighted its
  target.)

## v0.35.2

- improve: Highlight board names (accent color, semibold) in the Merge and Delete
  confirmation dialogs, so it's clear at a glance which board is affected.

## v0.35.1

- feat: Explorer Merge now merges the clicked board *into the active board*: it shows a
  confirmation naming the target (the active board) and warning that the clicked
  board will be deleted afterward. Trying to merge the active board into itself
  shows a brief toast ("A board can't merge into itself.") instead.

## v0.35.0

- feat: The Explorer sidebar can now manage boards, not just open them. Each board row
  has hover actions — Rename (inline), Share, Merge, Delete — and a right-click
  context menu with the same four. Delete still goes through the type-to-confirm
  warning. Owner-only: boards shared with you show no management actions. The
  top-bar Delete now uses the same shared confirm flow.

## v0.34.1

- fix: Picking a Gallery result that lives on another board now pans straight to that
  node (selecting it and opening its panel) after switching boards, instead of
  just opening the board. Connections frame their source node.

## v0.34.0

- feat: The Gallery is now workspace-wide. A scope selector switches between "All
  boards" and any single board (grouped under its folder), so you can browse and
  search every object, media file, link, and connection across the whole
  workspace without first switching boards. Results in "All boards" are tagged
  with the board they live on; picking an item on the current board jumps to it,
  and picking one on another board opens that board. Backed by a single
  GET /api/boards/gallery endpoint over all accessible boards.

## v0.33.3

- improve: Reordered the top-bar board actions so Create is first, then Rename, Move,
  Merge, Share, Delete.

## v0.33.2

- improve: Shortened the top-bar button labels/tooltips to: Rename, Create, Move, Merge,
  Share, Delete, Gallery, Import/Export.

## v0.33.1

- improve: Keep the logo pinned to the far left of the top bar; the Explorer toggle now
  sits to its right.

## v0.33.0

- feat: Added a collapsible left "Explorer" sidebar for organizing folders and boards.
  A toggle button at the top-left slides it in/out (smoothly, remembered across
  reloads). It shows folders as an expandable tree with their boards nested, plus
  an Ungrouped section; click a board to open it, drag a board onto a folder (or
  Ungrouped) to file/unfile it, and create/rename/delete folders inline. The
  existing top-bar pickers still work alongside it.

## v0.32.0

- feat: Import/Export now handles folders, not just boards. The Export tab lists your
  folders alongside boards; selecting a folder exports every board inside it, and
  the bundle remembers the folder structure. Importing such a bundle recreates
  the folders and files the boards back into them. Existing board-only bundles
  still import unchanged (the manifest is versioned, and the folder data is
  optional).

## v0.31.0

- improve: The Debian package now defaults to **PostgreSQL** instead of SQLite. On a fresh
  install it auto-provisions a local Postgres role + database (generated
  password), installs the psycopg driver into the venv, and writes the
  DATABASE_URL into the config. `DATABASE_URL` is still overridable to point at an
  external server or back at SQLite. Added a `scripts/sqlite_to_postgres.py`
  helper to copy an existing SQLite database into Postgres.

## v0.30.1

- fix: Fixed the folders migration to run on SQLite: it added a foreign key with a
  raw `ALTER` (Postgres-only) instead of Alembic batch mode like the project's
  other FK migrations. This blocked a fresh install on the default SQLite
  database. The whole chain now applies cleanly on SQLite and Postgres.

## v0.30.0

- feat: Production packaging. foolsboard can now build as a self-contained Debian
  package (`packaging/build-deb.sh`): one uvicorn service that serves the SPA,
  API, WebSocket, and media on port 9534 — no web server required — backed by
  SQLite by default (DATABASE_URL overridable for Postgres). Installs a systemd
  unit, a service user, config + generated secrets under `/etc/foolsboard`, and
  data under `/var/lib/foolsboard`. The app optionally sits behind a reverse
  proxy (nginx example included). To support this, the backend serves the built
  frontend when `STATIC_DIR` is set.
- fix: Fixed a latent type error (`onMinimapClick`) that broke the production build
  but was invisible in dev.

## v0.29.2

- improve: Polished the Share Board dialog. The Share button now matches the input it sits
  beside (same height and radius, stable width so it doesn't jump to "Sharing…"),
  recipient rows are roomier with the status shown as a color-tinted pill, the
  remove control is a tidy fixed square, and Done is a full-width close button
  instead of a small one stranded in the corner.

## v0.29.1

- improve: Reordered the top-bar board-action icons to a more natural grouping: Rename,
  New, Move to Folder, Merge, Share, Delete (with Make a Private Copy still
  beside Share on boards shared with you).

## v0.29.0

- feat: Collaborator upload activity. When someone uploads media to a board you're both
  on, a chip appears in your top bar — their name in their presence color with an
  animated loading bar — for as long as their upload is in flight, and clears when
  it finishes (or if they leave mid-upload). Completing a batch also nudges the
  board to refresh so the new media shows up. This completes the collaboration
  spec: sharing, presence, live cursors, selections, live editing, and now upload
  visibility.

## v0.28.0

- feat: Live editing on shared boards. Changes a collaborator makes now appear on your
  canvas without a refresh: dragging an object streams its position in real time
  (so you watch it glide), and any structural change — editing an object's
  fields, creating or deleting objects, drawing or removing connections, pasting,
  duplicating, or merging — is signalled over the collaboration socket and pulls
  a fresh graph on the other side. Remote updates preserve your own selection and
  never fight a drag you're in the middle of. Position streaming is throttled and
  graph refetches are debounced to keep traffic light.

## v0.27.0

- feat: Live cursors and selection highlights. On a board you share, you now see other
  collaborators' mouse cursors moving in real time (each labelled with their name
  in their presence color), and the objects they have selected are outlined in
  that same color. Both ride the existing collaboration WebSocket — cursor
  positions are sent in board coordinates so they stay accurate through pan and
  zoom, throttled on the wire and rendered in a pointer-transparent overlay that
  never interferes with your own editing. Cursors and outlines clear when a
  collaborator leaves the board.

## v0.26.0

- feat: Real-time presence — the foundation for live collaboration. A shared
  WebSocket channel (`/api/ws`, authenticated by the same token as the REST API,
  no new dependencies) now tracks who is viewing which board. When others are on
  the board you have open, their colored avatars appear in the top bar and
  update live as people join or leave. Access is re-checked on the socket, so
  you only ever appear on boards you're allowed to see. (Live cursors, field
  edits, and upload activity build on this channel next.)

## v0.25.0

- feat: Sharing & collaboration foundation. You can share a board (top-bar person-plus
  icon) or a folder (⤴ in the folder row) with another user by username or
  email; they get a slide-in notification with a countdown to accept or reject
  (clicking it accepts; letting it time out dismisses it). Accepted boards and
  folders appear in your pickers, marked with a teal "shared" dot, and a folder
  share grants access to every board inside it. Collaborators can open and edit
  the shared board's graph and media, while owner-only actions (rename, delete,
  move, re-share, export) stay locked to the owner. Shared boards also gain a
  "Make a Private Copy" action that duplicates the whole board into a new
  private board you own. (REST foundation; live presence/cursors come next.)

## v0.24.1

- improve: Typography consistency pass: comfortable global line-height plus grayscale
  smoothing/legibility rendering; unified the dialog, panel, and logo titles to
  one weight (700) and tracking (-0.02em); and made the node and panel type
  badges match (700 / 0.06em), converting px letter-spacing to em.

## v0.24.0

- feat: The New Board dialog can now place the board in a folder: pick an existing
  folder or create a new one inline. The folder is optional (labels say so), and
  it defaults to the currently-selected folder.

## v0.23.1

- improve: Title-cased all top-bar button tooltips, and moved the New (+) and Merge
  buttons to the left of the divider (Gallery and Import/Export stay on the
  right).

## v0.23.0

- feat: Organize storyboards into folders. A new Folder picker sits next to the board
  picker (top-left); selecting a folder filters the board list ("All Boards"
  shows everything). Create, rename, delete (boards are kept/unfiled),
  drag-reorder, and A→Z / Z→A sort folders.
- feat: Move a board into a folder two ways: drag a board onto a folder (the folder
  picker auto-opens during a board drag), or use the new folder icon to open a
  "Move to Folder" dialog. New boards inherit the selected folder.
- feat: Backend: folders table + boards.folder_id (migration), folder CRUD + reorder
  endpoints, a board→folder move endpoint, and create-with-folder. Deleting a
  folder is SET NULL, so boards are never lost.

## v0.22.0

- improve: Faster media uploads: dropped files now upload with bounded concurrency (3 at
  a time) instead of one-by-one; the busy state is derived from in-flight
  uploads so it stays correct during parallel uploads.
- improve: Background media re-encodes are capped at 2 concurrent (a semaphore) so a
  burst of video/audio uploads doesn't thrash CPU/GPU.

## v0.21.1

- improve: Title-cased the connection context-menu items (Edit Label…, Insert Node,
  Delete Connection).

## v0.21.0

- improve: "Move to New Board" is now just "Move": right-clicking a selection opens a
  dialog to pick the destination — an existing board, or a new board you name on
  the spot. The canvas switches to the destination after moving.
- fix: Moved objects are placed beside any existing content on the target board
  instead of landing on top of it.

## v0.20.1

- improve: Title-cased the "Move to New Board" context-menu item.

## v0.20.0

- feat: Extract a selection to a new board: select objects, right-click → "Move to new
  board". A new board is created, the objects are moved into it (true move —
  positions, content, links, and attached media preserved; internal edges come
  along, boundary-crossing edges are dropped), and the canvas switches to it.
  Removes that content from the current board. Backed by a new
  POST /api/boards/{id}/absorb endpoint.

## v0.19.0

- improve: Merging boards now consumes the sources: after picking boards, a confirmation
  step warns that they'll be copied into the current board and then permanently
  deleted. On proceed, the content is transferred first and the source boards
  are deleted only if that succeeds (no half-merge data loss).

## v0.18.3

- feat: Any invite code can now be deleted — active, expired, or already used (the
  "already used" guard is removed); every row has a delete button.
- feat: Used codes now show who redeemed them: the row displays the account's username
  and email (resolved server-side), falling back gracefully if that account was
  since deleted.

## v0.18.2

- improve: Admin Users tab: clicking a blocked action on your own row (remove admin /
  suspend / delete) now shows a "by design" banner explaining the self-guard,
  instead of doing nothing. Self-row buttons show a not-allowed cursor.

## v0.18.1

- improve: Title-cased dialog and menu labels: the New/Rename/Delete Storyboard and Merge
  Boards dialogs, the profile menu (Account Settings / Admin Panel / Sign Out)
  and the Account Settings dialog title, and the logo menu's Keyboard Shortcuts.

## v0.18.0

- feat: Invite codes now expire. When generating, pick a lifetime (5/10/30 min, 1 hr,
  1/7/30 days); the code is only redeemable until then (registration rejects
  expired codes). New invite_codes.expires_at column + migration.
- feat: Each code shows a live countdown while active; once it expires (or is used)
  the row shows when it was created and when it expired/was used.
- fix: Select dropdowns now render in a portal, so they're no longer clipped by a
  scrolling container (e.g. the admin panel body).

## v0.17.1

- improve: Roomier Gallery dialog (wider and a touch taller) so more cards fit per row.

## v0.17.0

- feat: New Gallery (top-bar grid icon): a searchable browser of everything on the
  current board, in four tabs — Objects, Media (images/videos/audio/files),
  Links, and Connections — with live counts. Search matches any attribute an
  item carries (titles, types, every content field, filenames, link URLs, edge
  labels). Backed by a new GET /api/boards/{id}/assets endpoint.
- feat: Picking a result navigates the canvas: objects/links/edge-endpoints focus
  (edges frame both nodes). Media opens in the in-place lightbox (image zoom,
  video/audio playback, file download); the owning node name is a separate link
  that jumps to the node.
- feat: Link results render as full-width preview cards (image, title, description,
  site) that open in a new tab; fixed long URLs overflowing their card.
- improve: Logs/gallery sub-tab buttons use a subtle accent-tint hover (replacing the
  off-theme gradient).

## v0.16.1

- improve: Admin user-action buttons are now subtle colour-coded chips that fill with
  their bright set colour on hover (works on the locked self-row too).
- fix: Registration: replaced the browser's native email validation popup with the
  app's themed error (form noValidate), stopped the error from being clipped by
  the card's animated body, and gave it a smooth height-easing reveal. Stripped
  Pydantic's "Value error, " prefix from messages.
- improve: Animated tab switching in the Admin panel (Users/Invites/Logs) and the Logs
  sub-tabs (Activity/Requests/Errors): the contents fade/slide in and the active
  indicators ease.
- improve: Capitalised the "Admin Panel" and "Keyboard Shortcuts" dialog titles.

## v0.16.0

- feat: Reorder the board list by dragging: each row in the board dropdown has a drag
  handle, and the chosen order is saved per user (new boards.position column +
  PATCH /boards/reorder). New boards land at the top; existing boards keep their
  newest-first order until reordered.

## v0.15.5

- improve: Dragging a bundle over the Import dialog now makes the whole dialog a drop
  target: the existing drop box lights up with the accent pulse/glow and a
  dashed accent ring frames the screen (mirroring the side-panel media drop).
- feat: Imports are restricted to .zip bundles — the wrong file type is rejected up
  front (by extension and MIME) on both the browse and drag-drop paths.
- improve: The top-bar action icons are evenly spaced, with a thin divider separating the
  current-board icons (rename, delete) from the workspace icons (new, merge,
  import/export).

## v0.15.4

- improve: The top-bar New board / Merge / Import-Export actions are now themed line
  icons grouped with the rename/delete icons (tooltips + aria-labels retained).
- improve: Import shows the same progress bar as export, and the export progress bar
  dropped its byte counter for a cleaner indeterminate bar.
- improve: The import drag-and-drop target now uses the same accent pulse/glow animation
  as dragging media onto the side panel.

## v0.15.3

- feat: Import / Export storyboards from a new top-bar button. Export bundles the
  selected boards into a .zip (manifest of the board graph plus a media/ folder
  with every attached file, built server-side with stdlib zipfile). Import reads
  such a bundle via a file picker or by dropping it on the dialog's drop zone,
  recreating the boards (with media) as new boards. The app-level file-drag is
  suppressed while a modal is open so a dropped bundle can't be mistaken for a
  media upload.
- feat: The export streams the archive as it's built and shows a live progress bar
  with a running byte count, so large/media-heavy exports show their progress.

## v0.15.2

- feat: Admin panel gained an Errors view: unhandled server exceptions are captured
  with their stack trace (a middleware logs them before the 500), stored in a
  new error_logs table, and shown in Logs > Errors as expandable rows. New
  migration.
- improve: The user-management action buttons are now color-coded: admin (indigo),
  suspend (amber), activate (green), delete (red).

## v0.15.1

- feat: Admin panel (admins only), opened from the profile menu, with tabs: Users
  (list accounts, toggle admin role, suspend/activate, delete — with self and
  last-admin guards), Invites (generate/copy/revoke codes, moved here from the
  standalone dialog), and Logs (the activity stream and the raw request log,
  each with a quick filter and load-more paging). Sign-out is now recorded
  server-side.

## v0.15.0

- feat: Admin + logging backend (UI to follow). Accounts gained an active/suspended
  status (suspended users can't sign in and are dropped mid-session). New
  admin-only endpoints list users, change a user's admin role / active status
  (with self and last-admin guards), and delete users; account creation stays
  invite-only. Full logging: an HTTP middleware records every API request, and a
  curated activity log captures sign-in/out, register, board/object/link/media
  create-delete, invite changes, and admin actions. Log-query endpoints with
  filtering. New migration adds users.is_active and the activity_logs /
  request_logs tables.

## v0.14.6

- feat: New objects are now created untyped instead of defaulting to Notes. An untyped
  object shows a neutral "Object" tag (a lighter gray, distinct from Notes'
  slate) on the card, in the panel header, and on the minimap; the Type dropdown
  starts on a "Choose a type…" placeholder with no type-specific fields until a
  type is picked. Existing objects keep their types.

## v0.14.5

- improve: The "Note" object type now displays as "Notes" (dropdown, panel tag, node-card
  tag) via a display-label mapping. The stored type value stays "note", so no
  migration is needed and existing objects relabel instantly.

## v0.14.4

- improve: Signing in/out now plays a smooth gradient "curtain" transition between the
  login screen and the canvas (covers, swaps underneath, reveals). The gradient
  is built from the theme's surface tokens, so it adapts to dark/light mode. A
  fresh page load with a valid token swaps without the curtain.

## v0.14.3

- fix: Smoothed out the login error: it now lives inside the height-animated card
  body so the card eases open/closed around it (no layout snap), fades with
  opacity only, and no longer bounces because the error isn't cleared and reset
  on every submit attempt.

## v0.14.2

- improve: The login error message now fades and slides in instead of appearing
  instantly, and re-animates on each failed attempt. Respects reduced-motion.

## v0.14.1

- improve: The login screen now animates between Sign In and Register: the card height
  eases between layouts while the changed fields fade/slide in, instead of
  snapping. Respects reduced-motion.

## v0.14.0

- feat: Added user accounts. A Romm-style login/register screen gates the app; the
  first account becomes the admin (no code), everyone after needs a single-use
  invite code (admin generates them from the profile menu). Each user's boards
  are private to them; the first account claims any pre-auth boards.
- feat: Top-right profile menu with avatar (initials fallback) and a dropdown:
  account settings (username/email, profile photo, change password), invite
  codes (admin), and sign out.
- feat: Backend: User + InviteCode models and Board.owner_id (new migration);
  PBKDF2 password hashing + HS256 tokens using only the standard library; every
  board/node/edge/asset/link endpoint now requires auth and enforces ownership.
  Set JWT_SECRET in backend/.env for non-local use.

## v0.13.3

- improve: Faster board load: the last-opened board's graph is now prefetched in parallel
  with the board-list request (using the id saved in localStorage) and consumed
  once by the canvas, removing the list -> graph round-trip waterfall.

## v0.13.2

- improve: Memory: React Flow now only renders nodes within the viewport
  (onlyRenderVisibleElements), so off-screen cards and their decoded images are
  unmounted — keeping memory roughly proportional to what's on screen. Node-card
  preview images are also released when the dropdown collapses (kept mounted only
  while open, plus a short window for the close animation).

## v0.13.1

- feat: The node-card content preview now shows real media thumbnails and link
  preview cards, and clicking a thumbnail opens the full lightbox (image
  zoom/pan, video and audio playback, file download) -- portaled to the body so
  it isn't scaled by the canvas. Capped at 8 thumbnails (a "+N" tile opens the
  lightbox at the rest) and 4 link previews (with a "+N more" line).
- fix: Double-clicking the preview chevron no longer also opens the edit panel.

## v0.13.0

- feat: Node cards now show a chevron on hover that expands an in-card preview of the
  node's content (its type fields, array-field counts, and reference count),
  with a smooth eased height/fade animation. The toggle is isolated from node
  selection/drag and the preview reflects saved content.

## v0.12.1

- improve: Nearby Nodes is now a bottom sheet pinned to the foot of the drawer that
  slides up to take half the height when toggled (smooth animation, no content
  reflow). Added a slider to control how many ranked nodes are shown, and a
  search box that filters across all nodes by their text (title, fields, link
  titles/URLs) to jump straight to a specific node.

## v0.12.0

- feat: The gallery drawer gained a "Nearby nodes" section: browse the galleries of
  linked and spatially-close nodes, select their media and/or reference links,
  and pull them into the node being edited with one button. Media is shared via
  dedup (instant, added to Media); links are added to References. Nearby = linked
  nodes first, then the nearest by canvas distance.

## v0.11.2

- feat: Backend: new POST /nodes/{id}/assets/reference endpoint attaches existing
  media (by asset id) to a node by sharing the stored file (dedup) instead of
  re-uploading. Foundation for pulling a nearby node's media into the node being
  edited; the in-panel UI for it is still to come.

## v0.11.1

- improve: Backfill content hashes for media uploaded before dedup existed, so
  re-uploading already-stored media can deduplicate against it. Runs once on
  startup; best-effort (matches when the stored bytes equal a fresh upload).

## v0.11.0

- feat: Media uploads are now deduplicated by content. Uploading the same file to a
  second node reuses the already-stored (and already-optimized) file instead of
  storing and re-compressing a copy, so it's instant. Assets carry a SHA-256
  content_hash (new migration); file deletion is reference-counted so a shared
  file is only removed when the last node referencing it drops it.

## v0.10.1

- improve: Gave the side panel's References and Media sections more separation, and the
  Save/Delete buttons clear breathing room above and below. The standard form
  fields keep their original spacing.

## v0.10.0

- feat: Added a "References" section to every object kind: paste a link and it renders
  a WhatsApp/Telegram-style preview card (thumbnail, title, description, site),
  with a + to add and a - to remove. Direct image links preview as the image.
  Stored in the node's content JSON (no migration).
- feat: New backend endpoint GET /api/links/preview fetches a URL server-side (to
  dodge CORS) and parses Open Graph / meta tags, using only the standard library
  (urllib + html.parser). Rejects non-http(s) and private/loopback hosts.

## v0.9.5

- fix: Fixed a horizontal scrollbar that briefly flashed and jolted the layout while
  the side panel / gallery drawer slid on and off screen, by clipping the canvas
  wrapper (overflow: hidden). The slide animations are now smooth.

## v0.9.4

- feat: Character objects gained an "Animations" field: a repeatable list of rows,
  each a numeric identifier plus the animation the character performs. Stored in
  the node's content JSON, so no migration is needed.

## v0.9.3

- feat: Esc now also closes the media hover preview, as the first step of the panel's
  Esc cascade (preview → gallery drawer → side panel → clear selection).
- improve: The gallery drawer retracts with a panel-style horizontal slide, tucking
  behind the side panel on Esc/collapse; when the whole panel is dismissed by
  clicking away, the drawer fades out instead of racing the panel, which looks
  much smoother.
- improve: Documented Esc in the keyboard shortcuts dialog and added a Gallery section
  (open viewer, expand/collapse drawer, navigate, Esc).

## v0.9.2

- fix: Recolored Scene objects from indigo to sky-blue so they're distinguishable
  from the purple selection highlight on the minimap (the highlight color is
  unchanged).

## v0.9.1

- feat: The Media section can expand into a retractable drawer that slides out to the
  left of the panel, overlaying the canvas, for browsing all of a node's files
  in a roomy scrollable area. The toggle arrow points left to expand and rotates
  to retract.
- fix: Closing the panel while the gallery is expanded now animates the drawer out in
  sync with the panel instead of having it vanish.
- feat: Esc now cascades: it closes an open lightbox/dialog/dropdown first, then the
  expanded gallery drawer, then the side panel, then clears any node selection.

## v0.9.0

- feat: The shift-drag selection rectangle is now mirrored live on the minimap (drawn
  in flow coordinates against the minimap's viewBox, so it stays aligned through
  pan/zoom and clears on release).

## v0.8.9

- improve: Merged-in content now arrives selected/highlighted (click empty canvas to
  deselect), and selected nodes are highlighted in the minimap (brighter indigo
  + white ring). The dark-mode minimap mask was lightened a little so off-screen
  highlights are visible.

## v0.8.8

- improve: Replaced the panel's native Type `<select>` with a reusable themed, animated
  dropdown (`Select`) that matches the other fields and shows each type's color
  as a dot. Respects reduced-motion.

## v0.8.7

- improve: Replaced the native board-picker `<select>` with a custom themed dropdown that
  matches the rest of the UI (light/dark), animates open and closed, highlights
  the active board, and respects reduced-motion.

## v0.8.6

- fix: the Save/Delete buttons no longer flicker when saving. Save now uses
  an internal guard instead of the shared busy state (so it doesn't flash the
  disabled styling), and button opacity changes transition smoothly.

## v0.8.5

- fix: top-bar buttons (New board, Merge, …) no longer turn near-black on
  hover in light mode — hover now uses a theme-aware `--bg-hover` token.
- improve: Saving an object (Save button or Ctrl/Cmd+S) shows a brief "Saved ✓" toast in
  the panel instead of updating silently. Respects reduced-motion.

## v0.8.4

- improve: Added right padding in the Keyboard shortcuts dialog so the key chips no longer
  crowd the scrollbar.

## v0.8.3

- improve: The edit panel header now shows the object's title and colored type tag once it
  has real content (a non-default title or any filled field); a pristine new
  object still shows "Edit Object".
- feat: **Ctrl/Cmd+S** saves while the panel is open (also listed in the shortcuts
  dialog).

## v0.8.2

- improve: Capitalized the side panel header to "Edit Object".

## v0.8.1

- improve: The Type dropdown now shows capitalized labels (Scene, Character, …) while
  keeping the stored values lowercase.

## v0.8.0

- feat: **Background media optimization** — uploads now return as soon as the file is
  stored, so video/audio appear immediately (playable original, with a thumbnail
  and an "optimizing…" badge). The compressed version is built in the background
  and swaps in automatically when ready. The swap is deferred while the file is
  open in the gallery, so playback is never interrupted (the panel polls for the
  finished version).
- improve: **Faster encodes** — video compression uses GPU decoding (`-hwaccel cuda`) and
  a faster NVENC preset, with automatic fallback (nvenc → libx264) and an
  upload-time check that skips files already in an efficient codec/bitrate.
  Images still compress inline (they're fast).
- feat: **Upload progress** — the panel shows a per-file progress bar during the byte
  transfer, then the "optimizing…" badge while the background pass runs.
- feat: New `processing` flag on assets (migration `c3e8a91f5b22`); a startup safeguard
  clears it if the server restarts mid-encode so nothing sticks on "optimizing".

## v0.7.4

- feat: Media tiles in the object panel now show the file name beneath each tile
  (truncated to two lines, full name still on hover), so audio and other files
  are identifiable at a glance.

## v0.7.3

- feat: The app now reopens the **last board you had open** after a refresh or restart
  (remembered in localStorage), instead of always loading the first board.
- improve: The Keyboard shortcuts dialog shows **Del or Backspace** for Delete selection.

## v0.7.2

- feat: **Media compression on upload** — uploads are recompressed at high quality to
  shrink the storage footprint, keeping the result only when it's actually
  smaller (already-efficient files are left untouched):
  - Images → WebP (animated GIFs → animated WebP) via Pillow.
  - Video → H.264/AAC MP4, audio → Opus/Ogg via ffmpeg.
  - Any encode failure falls back to storing the original, so uploads never
    break. Tunable via config (`image_webp_quality`, `video_crf`, `video_preset`,
    `audio_bitrate`, `compress_media`). Applies to new uploads only.

## v0.7.1

- feat: **Drag-and-drop media** — drag files onto the app to add them. With an object's
  panel open, an accent "Drop to add media" overlay appears and dropping uploads
  to that object (thumbnails generated as usual). With no panel open, a hint
  overlay explains to open an object first, and dropping uploads nothing. Only
  reacts to file drags, and always blocks the browser from opening the file.

## v0.7.0

- feat: **Typed media + gallery** — the object panel now shows media as a grid of
  typed tiles and opens a full-screen gallery on click:
  - Images (incl. animated GIF/WEBP) render in place; hovering shows an enlarged
    preview, and the gallery supports zoom + pan (wheel, drag, buttons, keys).
  - Video and audio show a server-generated thumbnail (a video frame / embedded
    cover art via ffmpeg) with a play badge; the gallery plays them.
  - Any other file shows its extension on a tile and a download card in the
    gallery.
- feat: Gallery supports keyboard navigation (←/→, Esc) and prev/next when a node has
  multiple media.
- feat: Backend: assets gained a `thumbnail_key` (migration `b7f3c1d92a40`); thumbnails
  are generated with ffmpeg on upload, and media type is inferred from the file
  extension when the upload's MIME type is generic.

## v0.6.7

- improve: Removed the top-bar hint sentence and moved its guidance into the Keyboard
  shortcuts dialog, which now also documents the mouse gestures (objects,
  connections, minimap).

## v0.6.6

- fix: the right-click context menu got stuck after its first use (a
  re-render cleared the close timer, wedging it in a "closing" state). The
  listeners now attach once and the timer survives re-renders, so the menu
  reopens reliably.
- improve: The app version is now read from `package.json` through the module graph
  instead of a build-time constant, so it updates on change without a
  dev-server restart.

## v0.6.5

- improve: The object edit panel now slides in from the right when opened and slides back
  out when closed, instead of appearing/vanishing instantly. Respects
  reduced-motion.

## v0.6.4

- improve: The right-click context menu now animates **closed** as well as open (it played
  no exit before), and the logo dropdown eases both open and close. Both respect
  reduced-motion.

## v0.6.3

- improve: The right-click context menu now opens with a quick pop that grows from the
  cursor (fast, with a slight overshoot), and respects reduced-motion.

## v0.6.2

- improve: A single click on an object now just selects it; the editing panel opens on
  double-click instead.

## v0.6.1

- improve: Removed the Delete item from the object right-click menu (deletion stays on
  the Delete/Backspace key, with its confirmation). Duplicate's mnemonic is back
  to `D`.

## v0.6.0

- feat: **Copy / cut / paste / duplicate** — right-click an object (or a multi-select
  box) for a clipboard menu, or use `Ctrl+C/X/V/D`. Menu items have underlined
  keyboard mnemonics. The clipboard persists in `localStorage`, so you can copy
  on one board and paste on another; internal connections come along too.
- feat: **Merge boards** — a `Merge…` button in the top bar opens a dialog to pick one
  or more boards whose content is appended into the current board. Pasted/merged
  content is placed beside what's already there, never on top.
- feat: **Undo / redo** — `Ctrl+Z` / `Ctrl+Shift+Z` (and `Ctrl+Y`) reverse paste, cut,
  duplicate, merge, and object moves.
- feat: **Delete from the keyboard** — `Delete` / `Backspace` removes the selected
  objects *and* connections, always behind the confirmation dialog (which now
  also covers connection-only deletions). A `Delete` item was added to the
  object menu too.
- feat: **Safer board deletion** — deleting a board now requires typing its exact name
  to confirm (pasting allowed).
- feat: **Logo menu** — the foolsboard logo is now a dropdown with a keyboard-shortcut
  reference and the app version pinned at the bottom (version sourced from
  `package.json`).
- improve: **Polish** — themed line icons for the rename/delete board buttons (replacing
  emoji), and themed clipboard menus.

## v0.5.6

- improve: Themed the shift-drag selection box (and the bounding box around selected
  nodes) to use the app's accent color, slightly brighter than the default blue.

## v0.5.5

- feat: **Click the minimap to navigate** — clicking anywhere on the minimap recenters
  the canvas on that spot with a quick animated pan, keeping the current zoom.
  Complements the existing drag-to-pan and scroll-to-zoom on the minimap.

## v0.5.4

- improve: Tuned the dark-mode minimap mask so the current viewport stands out a little
  more clearly against the dimmed surrounding area.

## v0.5.3

- feat: **Light/dark theme toggle** — a new sun/moon button in the top bar switches
  between a dark and a light palette. The choice is saved and restored, defaults
  to your OS preference on first visit, and is applied before first paint so
  there's no flash. Switching plays an animated circular wipe that expands from
  the button (View Transitions API, with an instant fallback and reduced-motion
  support); the icon spins as it swaps.
- improve: **Themed canvas chrome** — the React Flow controls and minimap now match the
  app's palette in both themes instead of rendering bright white.

## v0.5.2

- feat: **Grab a link's endpoint to reposition, reassign, or delete it** — the
  connection pins now live on the edge instead of inside the node card, so a
  drag survives crossing node boundaries. Drag an endpoint along its border to
  move it, onto another node to reassign that end (attaching at the exact point
  you release), or onto empty space to delete the link. While over empty space
  the link follows the cursor as a live preview.
- improve: Removed React Flow's native edge reconnection (the pins now own that
  behaviour). New shared modules: `edgeGeometry` (snap math), `rfMappers`
  (edge mapping), and `boardContext` (board id for custom edges).

## v0.5.1

- improve: **One-shot connection placement** — drawing a link now attaches it to the
  exact point on the target's border where you release the mouse, instead of
  snapping to one of four fixed anchors and requiring a second drag. Release on
  empty space and the link simply vanishes; a small latch margin attaches links
  dropped just outside a node to the nearest border point.
- improve: Border-snap geometry is now shared (`edgeGeometry.ts`) between connection
  creation and pin dragging, so both place points identically.

## v0.5.0

- feat: **Draggable connection points** — links now attach to a precise point on a
  node's border, not a fixed side anchor. With one connection on a side it
  centers automatically; with two or more you can drag each point along the
  border to position it. The offset (side + position) is persisted in
  `edge.data` and restored on reload.
- improve: **Connection dots only when connected** — the little circles now appear only
  where an actual link attaches. The four-sided handles are now invisible "ghost"
  affordances that surface on hover for drawing new links.
- feat: New custom `FloatingEdge` renders each link as a bezier computed from the
  stored border geometry, so the line always meets its draggable point.

## v0.4.0

- feat: **Connect from any side** — every object now has connection handles on all
  four sides, and React Flow runs in loose mode, so a link can start or end on
  any side (top/right/bottom/left), in any direction.
- feat: The side a link attaches to is persisted (in `edge.data`) and restored on
  reload. Links made before this update keep rendering (right→left fallback).

## v0.3.1

- fix: the connection right-click menu opened and instantly closed itself
  (the opening `contextmenu` event bubbled to the menu's own outside-click
  listener). Outside-close listeners are now attached a frame later and ignore
  clicks inside the menu, so the menu stays open and is usable.

## v0.3.0

- feat: **Node card previews** — each card now shows a preview line under the title
  (the first filled type-field, e.g. a character's role or a scene's location).
- feat: **Connection editing** — right-click a link for a context menu:
  - *Edit label…* — annotate the branch (clearable) via the dialog.
  - *Insert node* — splits the connection (A→B becomes A→new→B).
  - *Delete connection*.
- feat: **Reconnect / detach** — drag a link's endpoint onto another node to move it,
  or drop it on empty space to detach it.
- feat: New reusable `ContextMenu`; `PromptDialog` gained an `allowEmpty` option;
  added `updateEdge` API.

## v0.2.1

- improve: The canvas **Delete key** now routes through the confirm dialog whenever
  objects are involved (edge-only deletions stay instant). The panel's Delete
  button remains guarded too — both paths share the same dialog.
- fix: Hardened fire-and-forget deletes against cascade 404s (deleting a node already
  removes its links on the backend).

## v0.2.0

- feat: **Board management** — rename and delete the active board from the top bar,
  using the animated gradient dialogs. Deleting the last board bootstraps a
  fresh one so the workspace is never empty.
- feat: **Per-type node fields** — the context panel now shows structured fields based
  on the object type (e.g. scene → location/time/summary, character →
  role/traits/description). Values live in the node's `content` JSON, so new
  fields need no migration.
- feat: **Delete confirmations** — deleting an object or a board now asks first via a
  gradient-overlay confirm dialog, preventing accidental loss.
- feat: Reusable `PromptDialog` and new `ConfirmDialog` components.

## v0.1.0

- feat: Initial release: infinite-canvas storyboard app.
- feat: Backend: FastAPI + SQLAlchemy 2.0 + Alembic, database-agnostic via
  `DATABASE_URL` (Postgres active, SQLite fallback). CRUD for boards/nodes/edges
  plus media uploads through a pluggable storage backend.
- feat: Frontend: React + Vite + TypeScript + React Flow. Infinite canvas with
  right-click-to-create, edge linking, drag-persist, and a context panel for
  editing objects and managing media.
- feat: Animated gradient-overlay dialog for naming new boards.
