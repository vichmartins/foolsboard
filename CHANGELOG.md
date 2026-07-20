# Changelog

## v0.109.18

- polish: The canvas lock control's expand (opening an editable board from a
  template) now reveals in step with the board content — same trigger (once the
  content is ready) and same 0.5s duration/easing — instead of racing ahead of it
  at a faster speed.

## v0.109.17

- fix: The canvas lock control now expands in with a **scale + fade** (its space is
  reserved up front, so the control buttons below it no longer reflow as it grows).
  That reflow was the source of the jerky "pop" when opening an editable board from
  a template; the collapse (opening a template) is unchanged.

## v0.109.16

- fix: The canvas lock control's entrance is now driven by a **CSS keyframe** (the
  same reliable, on-mount mechanism as the board-content reveal) instead of a
  frame-timed transition. The expand when opening an editable board from a template
  no longer pops — both the collapse and the expand are consistently smooth.

## v0.109.15

- fix: The canvas lock control now **expands in smoothly** when opening an editable
  board from a template (it used to pop in). The enter animation now waits a full
  frame for its starting state to paint before animating, so both the collapse and
  the expand are smooth.

## v0.109.14

- fix: Switching from one template to another no longer makes the canvas lock
  button twitch (briefly flash in, then re-collapse). It now only animates when
  the read-only state actually changes between boards, so template → template
  keeps it cleanly hidden.

## v0.109.13

- revert: Reverted all recent video-object changes (custom player, disabled PiP,
  control restyle). Video objects are back to their original native controls.

## v0.109.12

- change: Video objects now use a **custom player** instead of the browser's native
  controls. Every control — play, seek, volume, **picture-in-picture** and
  **fullscreen** — lives inside the video and travels with it, so nothing drifts
  off the object when you pan the board. PiP and fullscreen are back (the native
  PiP overlay that drifted is gone for good).

## v0.109.11

- fix: Disabled the browser's native picture-in-picture button on video objects —
  it's positioned in screen space, so it drifted outside the video while panning
  the board and couldn't be repositioned.
- revert: Restored the media node's remove/download controls to their previous
  look (v0.109.10's in-corner restyle reverted).

## v0.109.10

- polish: A media node's remove (and download) controls now sit **inside** the
  object's top-right corner as themed overlay buttons on a dark scrim (hover-tinted
  to danger/accent), instead of floating outside the corner as badges — so they
  stay put with the object during a pan and look part of it.

## v0.109.9

- fix: While a board's graph is loading, the empty-board hint ("Right-click
  anywhere to create your first object") no longer flashes — the node list is
  briefly empty during the fetch, which made a heavy board momentarily look empty
  instead of loading. The hint now waits until loading finishes.

## v0.109.8

- feature: Boards now show a themed **loading spinner** (accent ring with a soft
  glow) while the graph is fetched, and the content then grows-and-fades in once
  it actually arrives — so slower boards get a proper reveal instead of a blank
  canvas. The spinner is delayed slightly so quick loads never flash it; respects
  reduced-motion.

## v0.109.7

- polish: The board-switch transition is now a more noticeable **grow-and-fade**
  (0.5s) — the contents gently scale up from the canvas centre as they fade in,
  instead of a quick fade. Pan/zoom, background, and controls are unaffected.

## v0.109.6

- polish: Switching boards now **fades the board's contents in** smoothly instead
  of popping every object into place at once. Only the node/edge layer animates
  (the dotted background and controls stay put); respects reduced-motion.

## v0.109.5

- polish: The canvas lock control now animates in **both** directions — it
  collapses when opening a template and expands back in when opening an editable
  board (previously only the collapse animated). A timing fallback keeps the lock
  from ever getting stuck hidden on an editable board.

## v0.109.4

- polish: The canvas lock control now actually **animates** its collapse when you
  open a template (the canvas remounts per board, so it's rendered expanded for
  one frame then transitioned closed), instead of just appearing already-gone. It
  still expands smoothly on Unlock to Edit, and respects reduced-motion.

## v0.109.3

- fix: The canvas lock control now collapses **fully** on a template instead of
  leaving an ~8px gap in the controls stack — its padding/border are collapsed
  along with its height (with border-box, max-height alone couldn't shrink past
  the padding).

## v0.109.2

- fix: **Import now syncs imported categories to the database** (creates the
  category + files its folders/boards), so an imported category is immediately
  consistent and shareable instead of only living in the layout until the next
  save.
- fix: The Export picker no longer offers **shared (not-owned) boards, folders or
  categories** — the server can't export someone else's items, so listing them
  was misleading.

## v0.109.1

- polish: The category (and folder) picker's row actions now use the app's themed
  Share/Rename/Delete icons instead of plain unicode glyphs.
- feature: **Right-clicking a category** in the explorer now opens a context menu
  (New Folder · New Board · Share Category · Rename · Delete); the sidebar row also
  gained a Share button. Shared-with-me categories stay read-through.

## v0.109.0

- feature: **Categories can now be shared**, with full folder parity — share,
  rename, delete, drag-reorder, sort, and drop boards/folders onto them to file.
  Sharing a category grants the recipient the category and everything filed in it
  (its folders and their boards, plus any loose boards); it shows up in their
  explorer with the owner's name, and the owner gets a shared-out crown. Your
  per-user layout is unchanged, so you can still file shared items into your own
  categories. Existing categories are migrated automatically.

## v0.108.14

- polish: The canvas lock control now **collapses/expands smoothly** when a board's
  read-only state changes (e.g. Unlock to Edit) instead of popping out of existence.

## v0.108.13

- polish: The template banner buttons now rest on the bright, saturated accent
  colour and soften to a light accent tint on hover (previously the reverse).

## v0.108.12

- polish: The template banner buttons are now tinted in the theme's accent hue —
  **Create From Template** on a light-purple (accent) fill, **Unlock to Edit** a
  lighter tone of the same colour — deepening on hover instead of going solid.

## v0.108.11

- fix: In the **light theme**, primary buttons now darken slightly on hover
  instead of brightening — the previous brighten washed the accent toward the
  pale background and faded the white label.

## v0.108.10

- revert: Restored the template banner's original **Create From Template / Unlock
  to Edit** button styling (solid primary + neutral), per preference.

## v0.108.9

- polish: The template banner's **Create From Template / Unlock to Edit** buttons
  now use the app's tinted button style (like the admin panel) — soft accent fill
  that goes solid on hover — fixing the washed-out look in the light theme.
- fix: Capitalized the **Move Board** toolbar tooltip.

## v0.108.8

- polish: Move / Create-From-Template picker now uses the app's themed **folder
  and category icons** instead of a stray unicode glyph, for a consistent look.
- polish: Top-bar board dropdown now shows each item's **type icon** on the right
  (board, or a star for a template), alongside the shared indicator.
- change: The sharing indicator now distinguishes **who shares from who receives** —
  one person when you own and shared it out, two people when it's shared with you —
  and only tints accent (purple) while its row is selected.
- change: The **canvas lock** control is hidden for templates (they're already
  read-only, so it did nothing).
- fix: Capitalized the "No Folder / Category (Top Level)" and "No Folder /
  Category" options in the move / new-board pickers.

## v0.108.7

- change: Reordered the template menu (View Objects · Create From Template · Move
  to… · Share Template · Unlock to Edit · Delete).
- change: **Unlock to Edit now asks for confirmation** (from both the menu and the
  banner), explaining it turns the template back into a regular storyboard.
- fix: Top-bar dropdowns now render **above** the template read-only banner instead
  of behind it.

## v0.108.6

- change: The template menu action now reads **Unlock to Edit** (matching the
  banner), instead of "Remove from Templates".
- polish: Setting a board as a template now animates — it slides into the
  Templates section — and the read-only banner smoothly fades/slides in and out
  instead of popping.

## v0.108.5

- polish: A template's star icon now follows the selection state like any board
  (muted when unselected, accent when active) instead of always looking
  highlighted; its hover tooltip shows the board name and marks it a template.
- change: You can now **select/deselect objects** while viewing a read-only
  template (for inspection) — editing stays blocked.
- change: The Share dialog title now reads **Share Template** for a template.

## v0.108.4

- change: In the explorer, a **template board now shows a star icon** (accent) in
  place of the usual board icon, so it reads as a template at a glance, and its
  hover actions drop **Rename** and **Merge** (leaving Share + Delete).

## v0.108.3

- change: On a template, the top-bar **Rename and Merge buttons are now hidden**
  (rather than shown disabled), since neither applies to a read-only template.

## v0.108.2

- change: **Templates are fully locked down.** A template can no longer be renamed
  or merged (those actions are removed from its menu and disabled in the top bar),
  its Duplicate action reads **Create From Template**, and its delete dialog says
  **Delete Template**. In the object drill-in (View Objects) a template's objects
  are read-only too — the right-click menu drops Rename / Duplicate / Delete,
  leaving only Open and Play.

## v0.108.1

- feat: **Sharing a template gives the recipient a template.** The board menu now
  says **Share Template** for a template, and when the recipient accepts, it lands
  in *their* Templates section (read-only) rather than as a plain shared board.
- change: **Duplicating a template is now "Create From Template"** (distinct from a
  plain board's "Create Private Copy").
- polish: Retheme the template read-only banner (proper lock icon, app-styled card,
  Title Case buttons), and make the Templates count use the same muted color as the
  Categories/Folders counts instead of orange.

## v0.108.0

- feat: **Templates are read-only.** A board you've saved as a template now opens
  locked — you can pan, zoom, and view it, but not move, edit, add, or delete
  anything, so a reusable starting point can't be changed by accident. A banner
  offers **Duplicate to use** (a fresh editable copy) or **Remove from Templates to
  edit** (unlock it). Since templates are per-account, this only affects the person
  it's a template for.

## v0.107.2

- change: **Removed team templates / "Publish to Team".** The workspace-wide
  template-publishing feature has been taken out. Your **personal** templates (the
  per-account Templates section) and the plain **Duplicate** action are unchanged.

## v0.107.1

- change: **The Templates and Team Templates sections are now docked, resizable
  panels** (VS Code-style) pinned below the board tree. Each collapses to just a
  header, and when open you can drag its top edge to set a height — which is
  remembered, so re-opening returns to that height. The board tree above scrolls
  independently.

## v0.107.0

- feat: **Team templates.** Publish a board as a workspace-wide template that
  everyone can start from — right-click a board and choose **Publish to Team**.
  Published templates appear in a new **Team Templates** section in the sidebar for
  all users, each with a **Use** button that spins up a fresh copy. Anyone can
  publish; the publisher (or an admin) can remove one.

## v0.106.0

- feat: **Duplicate any board.** Every board's menu now has a plain **Duplicate**
  action (a full private copy — objects, links, and media), no longer tied to
  templates. Previously you had to mark a board as a template just to copy it.
- feat: **Templates section in the explorer.** Your template boards are now
  grouped into a dedicated, collapsible **Templates** section at the bottom of the
  sidebar. They also stay in their normal spot — the section is just a quick way to
  find your reusable starting points.

## v0.105.6

- fix: **Templates are now per-account.** Marking a board as a template used to set
  a board-wide flag, so on a shared board a collaborator saw (and could be confused
  by) a template star they never set. Template status is now stored per user — your
  templates are yours alone. Existing template marks are migrated to each board's
  owner.

## v0.105.5

- chore: Added `scripts/backfill_media_urls.py` — a one-off pass that rewrites a
  media node's cached url/filename to match its live asset, so stored content is
  consistent after a background re-encode (the canvas already resolved this at
  render time; this removes the brief load-time flicker and tidies the data).
- fix: Repaired `scripts/recompress_existing.py`, which was broken against the
  current `compress()` API (it treated the returned temp-file path as bytes) and
  now also deletes the superseded file dedup-safely.

## v0.105.4

- change: **Audio objects now use a custom player** (play button, scrubber, time)
  instead of the browser's native `<audio>` control, which rendered inconsistently
  across browsers (clipped/awkward in some) and was prone to getting stuck in a
  broken state. The new player looks the same everywhere, matches the app's theme,
  and reloads cleanly when a file is swapped.

## v0.105.3

- fix: **Audio/video nodes no longer stay stuck in a broken, collapsed player.**
  When a node briefly rendered a stale/deleted source (before the live asset URL
  resolved) the media element errored, and swapping its `src` to the real file
  didn't recover it — a media element that has failed to load won't reload from a
  `src` change alone. The element is now keyed on its URL, so a changed URL mounts
  a fresh player that loads the current file cleanly.

## v0.105.2

- fix: **Uploaded audio/video is only kept as-is when the browser can actually
  play it.** The "skip re-encode, it's already efficient" check looked at the
  codec but not the container, so an H.264 `.mkv` or an AAC `.m4a` could be stored
  untouched in a container browsers can't play. It now requires a web-playable
  container too (H.264 only inside MP4; VP8/VP9/AV1 inside WebM; MP3/Ogg/WAV audio),
  so anything else is transcoded to MP4 or Ogg-Opus.
- chore: Added `scripts/retranscode_unplayable.py`, a one-off pass that converts
  already-stored media stuck in an unplayable container (run with `--dry-run` to
  preview). Canvas nodes self-heal to the new file on next load.

## v0.105.1

- fix: **Audio/video nodes no longer break after their background re-encode.** A
  media node cached its file's URL at upload time, but audio/video are transcoded
  in the background (e.g. an `.m4a` becomes an `.ogg` and the original is deleted),
  leaving the canvas pointing at a file that no longer exists — the player rendered
  "smooshed" and unplayable, and the name stayed `.m4a`. The canvas now resolves a
  media node's URL/name from the live asset, so it always shows the current file.
  Already-affected nodes fix themselves on the next load — no re-upload needed.
- fix: When a background re-encode finishes it now nudges open boards to refresh,
  so the swapped-in file appears within a moment instead of on the next reload.

## v0.105.0

- feat: **Admins can reset a user's password.** From Admin › Users, "Reset password"
  offers two paths: set a password for them directly (optionally forcing a change on
  next sign-in), or generate a **temporary password** — shown once, copyable — that
  expires in 24 hours and is single-use: the user signs in with it, is required to
  choose a new password, and the temporary one can never be used again.
- feat: **First-run setup.** A brand-new instance greets the first person with a
  themed "set up your foolsboard" flow that creates the administrator account and
  signs them straight in — no invite code, no guessing that a blank invite means
  "first account". Existing installs are unchanged.
- feat: **Forced password change screen.** A user whose password an admin reset is
  held at a matching "choose a new password" card until they set one, then dropped
  into the app.

## v0.104.2

- revert: **Removed the smart scene-heading / extension autocomplete** (v0.104.0).
  Screenplay autocomplete is back to suggesting only values already used in the
  document plus the seed vocab. The Scene Navigator (and its shortcut) stays.

## v0.104.1

- feat: **Shortcut for the Scene Navigator** (`Ctrl+Shift+O` by default, screenplay
  mode only) — fully remappable in the Keyboard Shortcuts dialog, and the toolbar
  toggle's tooltip shows the current binding.

## v0.104.0

- feat: **Smarter screenplay autocomplete.** Scene headings now complete in the
  Celtx prefix → location → time pattern: an empty scene line offers INT./EXT./
  EST., the prefix offers locations you've used before, and ` - ` offers a
  time-of-day list (DAY, NIGHT, CONTINUOUS, LATER…). Character lines also offer the
  (V.O.) / (O.S.) / (CONT'D) extensions once a name is in place.
- feat: **Scene Navigator.** A toggle in the screenplay toolbar opens a left panel
  listing every scene heading, numbered; click to jump to a scene, with the current
  one highlighted and the list kept in sync as you write.

## v0.103.0

- feat: **Drag-and-drop (or paste) images into a document.** Dropped/pasted image
  files upload as assets owned by the doc and insert at the drop point, with a
  drop-zone overlay while dragging. Persists and syncs to collaborators.
- change: **Link and image insertion use in-app dialogs** instead of the browser's
  native prompt, matching the app's look.
- change: **File-drop overlays are unified** — the document uses the same overlay
  as the canvas/drawer/edit window, and all of them now spawn the prompt card with
  a pop-in animation before it pulses.

## v0.102.3

- change: **Video and audio objects now cast the app's object drop shadow**, so
  they match the other cards on the canvas; image objects stay flat (they're just
  the artwork, often transparent).

## v0.102.2

- change: **Document editor toolbar is now three zones** — the Document/Screenplay
  toggle pinned left, the formatting functions centered, and undo/redo pinned right.

## v0.102.1

- feat: **Offline fallback page.** When the installed app (PWA) is opened without a
  connection, it now shows a branded "foolsboard needs a connection" screen that
  auto-reloads the moment you're back online, instead of a broken shell. The
  service worker precaches it (cache bumped to v2). (foolsboard's data is
  server-side, so this is a graceful fallback, not offline editing.)

## v0.102.0

- feat: **Customizable keyboard shortcuts.** Open **Keyboard Shortcuts**, click any
  shortcut, and press a new combo to reassign it — with a conflict warning that
  names the clashing action and a one-click **Replace**. Per-row reset (↺) and a
  **Set to Default** button (with a confirmation) restore defaults. Bindings persist
  locally and drive both the behavior and every hint shown in the app.
- feat: **Switch Document ⇄ Screenplay with `Ctrl+Shift+M`** (works in both modes).
- feat: **Object shortcuts** — Bring to front (`Ctrl+Shift+]`), Send to back
  (`Ctrl+Shift+[`), and Move (`Ctrl+Shift+M`), shown in the object menu.
- change: **Shortcut hints are now consistent app-wide** — every tooltip and menu
  reads its shortcut from the one keymap, so a hint always matches the real binding
  (and updates the moment you remap it).
- change: **Context-menu mnemonics require Alt.** The underlined letters only appear
  and activate while you hold **Alt** (e.g. `Alt+C` for Copy), so stray typing over
  an open menu never triggers them. Shortcut hints in menus are also dimmed so they
  don't look like the `›` submenu arrow.

## v0.101.0

- feat: **More Document-mode formatting** — text **color** and **highlight**
  (swatch palettes), **font size**, and paragraph **alignment** (left / center /
  right / justify). Like the font picker, each applies to the selection, saves
  with the document, syncs live to collaborators, previews on the card, and
  carries into PDF export; all are hidden in Screenplay mode. The color and
  highlight toolbar glyphs were restyled to sit cleanly among the other controls.

## v0.100.0

- feat: **Fonts in Document mode.** A new **Font ▾** picker in the document
  toolbar lets you set the typeface for selected text — Default, Sans Serif,
  Serif, Monospace, plus Arial, Georgia, Times New Roman, Courier New, Verdana,
  Trebuchet MS, Garamond, and Comic Sans MS, each previewed in its own face. The
  choice saves with the document, syncs live to collaborators, shows in the card
  preview, and carries into PDF export. All are system fonts (zero download,
  CSP-safe); Screenplay mode is unaffected and stays in Courier.

## v0.99.2

- change: **Screenplay autocomplete now matches Celtx 1:1.** Suggestions appear
  only in the elements with a repeatable vocabulary — Scene, Character,
  Transition, Shot — and offer only that element's own prior values plus its seed
  list. Free-prose elements (Action, Dialogue, Parenthetical) no longer pop a
  dropdown, and the previous cross-element conversion (typing a known name on an
  Action line to turn it into a Character) has been removed, since Celtx doesn't
  do that.

## v0.99.1

- perf: **Co-editing now uses a compact binary WebSocket protocol.** The Yjs doc
  and cursor channels ride the socket as raw binary frames instead of
  JSON+base64, roughly halving-to-quartering their wire size (~70% smaller per
  message; stacked with v0.99.0's tick batching that's ~85–90% less traffic than
  before during active typing). Every other message stays JSON on the same
  connection. Documents converge byte-identically (verified); an old tab open
  across the upgrade degrades gracefully rather than erroring.

## v0.99.0

- perf: **Real-time co-editing is much leaner on the wire.** Instead of sending
  one WebSocket message per keystroke, local edits are now coalesced and sent as
  a single merged update per ~40ms "tick" (like a game server's tick rate), and
  cursor/selection updates are throttled the same way to their latest state. In a
  fast typing burst that's roughly **5–10× fewer messages and ~70–80% less
  traffic** on the doc channel, with no perceptible change in latency — your own
  edits still apply instantly, and collaborators see changes within ~40ms.
  Documents converge to byte-identical state (unchanged correctness).

## v0.98.3

- fix: **Document export is more robust when pandoc isn't on the service PATH.**
  The converter now locates the pandoc binary via PATH first, then falls back to
  well-known install locations, so DOCX/ODT export works even when the server
  process was launched with an environment that doesn't include pandoc's
  directory. No effect on the packaged Linux deploy (pandoc is always on PATH
  there); this mainly smooths out local/dev machines.

## v0.98.2

- fix: **Document export to Word (.docx) and OpenDocument (.odt) was failing** on
  the server. pandoc's `--sandbox` flag (used as a hardening measure) blocks
  pandoc from reading its own bundled templates in pandoc 3.x, so every DOCX/ODT
  conversion errored out. Removed the flag and instead strip `<img>` tags from the
  HTML before conversion — that closes the same SSRF/local-file-read vector the
  sandbox was guarding against, without breaking output. (Screenplay .docx was
  unaffected — it's built with python-docx, not pandoc.)
- fix: A failed document export now shows an error instead of silently doing
  nothing.

## v0.98.1

- fix: Context-menu submenus (e.g. **Export as ▸**) now reposition to stay on
  screen — they shift up when near the bottom edge and flip side when needed,
  instead of getting clipped.

## v0.98.0

- feat: **Export documents in multiple formats** — PDF, Word (.docx), OpenDocument
  (.odt), and plain text (.txt). Right-click a document (Explorer or canvas) →
  **Export as ▸**, or use the editor's new **Export ▾** dropdown. Screenplays
  exported to .docx keep their industry formatting (Courier, scene/character/
  dialogue indentation, uppercasing).
- ops: **Rotate the JWT signing secret** with `sudo /opt/foolsboard/rotate-jwt.sh`
  (invalidates all sessions — everyone logs in again).

## v0.97.0

Security + reliability audit fixes.

- security: Link previews can no longer be redirected to internal/loopback/LAN
  hosts (SSRF), and are bounded against decompression bombs; import guards its
  manifest size too.
- security: A collaborator's cursor color can no longer inject CSS into your
  document editor. The server refuses to start on the default JWT secret.
- fix: **Merge is bound to its target board** — switching boards mid-merge can no
  longer merge into (and delete) the wrong board.
- fix: **Document autosave** flushes on tab hide/close and at least every ~8s, so
  fast typing or closing the tab no longer loses recent edits.
- fix: Media compression no longer deletes a file still shared by a copied/
  referenced object; "Absorb" no longer removes a target board's own edges.
- fix: The Explorer object list no longer reverts a rename/duplicate/delete when a
  refresh is in flight; a failed board prefetch no longer blanks the canvas; a
  held key no longer mass-creates documents; a stale "jump to object" no longer
  re-fires later.
- fix: Sturdier real-time layer — a malformed message can't drop the connection,
  one stalled peer can't freeze a board, and refreshing in a doc no longer flickers
  duplicate cursors between your own tabs.

## v0.96.4

- improve: **Autocomplete now covers all screenplay elements.** Action, Dialogue,
  and Parenthetical also complete from their previously-used values and can be
  suggested/converted-to from other lines, alongside Character/Scene/Transition/Shot.

## v0.96.3

- improve: **Cross-element screenplay autocomplete now works from any line.** Any
  element can suggest matching Character / Scene / Transition / Shot values
  (tagged with their type); accepting converts the line to that element. The
  current element's own values are still offered first.

## v0.96.2

- improve: **Screenplay autocomplete works cross-element.** Typing a known
  character name on an Action line now suggests it (tagged "Character"); accepting
  fills the name and converts the line to a Character element, so it snaps to the
  right formatting.

## v0.96.1

- fix: **No more ghost cursor/avatar after refreshing in a document.** Refreshing
  while co-editing left your previous connection lingering as a duplicate cursor
  and avatar (for you and others) until it timed out. The reconnected tab now
  clears its own stale connection and tells everyone to drop it immediately.

## v0.96.0

- feat: **Screenplay autocomplete (Celtx-style).** While writing a Character,
  Scene, Transition, or Shot element, a dropdown suggests values you've already
  used in the document (plus built-in transitions, shots, and INT./EXT. prefixes).
  ↑/↓ to navigate, Tab/Enter or click to accept; the element's indentation is
  applied automatically. Free-form Action/Dialogue lines are left alone.

## v0.95.2

- improve: The document context-menu action is now labelled **Export as PDF**
  (was "Download as PDF"), on both the canvas and the Explorer.

## v0.95.1

- fix: **Media survives board import.** Importing a board into another workspace no
  longer loses its images, video, and audio — media nodes are now relinked to the
  freshly-restored files (previously their content still pointed at the source
  workspace's storage keys, so everything showed as missing). Re-import an
  affected bundle to repair a board imported before this fix.

## v0.95.0

- feat: **Expandable Document cards on the canvas.** Document objects now have the
  same hover ▾ chevron as the other object cards — expand it for a scrollable,
  formatted preview of the document (or screenplay) right on the canvas, without
  opening the editor. Double-click still opens the full editor.
- fix: Document cards now match the other object cards' **background color** and
  **drop shadow** (they were using the darker media tone and had no shadow).

## v0.94.0

- feat: **Right-click menu for objects in the Explorer.** In a board's object list,
  right-click any object for **Open**, **Rename** (inline), **Duplicate**,
  **Download** / **Download as PDF**, **Play from Here** (when that board is open),
  and **Delete**. The list and canvas stay in sync as you go.
- feat: **Download documents as PDF.** Documents (and screenplays) can be exported
  to PDF straight from the right-click menu on the canvas and in the Explorer —
  no need to open the editor first. Honors document vs. screenplay formatting.
- improve: **Media download moved to the right-click menu.** The floating download
  button on media cards is gone; right-click a media object for **Download**. The
  download actions sit next to **Play from Here**.
- improve: Closing a document returns you to the canvas with it **centered and
  highlighted**, so a freshly created document is easy to find.
- improve: **Context menus now flip** to stay on screen — they open upward/leftward
  near an edge instead of getting clipped.
- improve: **Consistent typography** — Title Case for buttons, menus, and titles;
  one shared style for every search field; a single source of truth for the app's
  fonts.
- fix: Glob-style search queries (e.g. `*New*`) now work as wildcards.
- fix: The Explorer's object list updates reliably when objects are created,
  renamed, or **deleted** (a delete race could leave stale rows).
- fix: Double-clicking a board in the Explorer no longer spawns a stray document.

## v0.93.1

- fix: **Search boxes handle glob-style queries.** A query that isn't valid regex
  (e.g. `*New*`) is now treated as a forgiving wildcard — `*` matches any run of
  characters and `?` any single character — instead of finding nothing. Valid
  regex still works as full regex.
- fix: **The Explorer's object list refreshes live.** Objects created, renamed, or
  deleted on the canvas (by you or a collaborator) now appear in the board-contents
  drill-in without leaving and re-entering it.

## v0.93.0

- feat: **Browse a board's objects in the Explorer.** Double-click a board (or use
  its right-click **View objects**) to drill into a flat, filterable list of every
  object on it. Click one to jump straight to it on the canvas; the **‹** header
  takes you back to the folder tree.
- improve: **Snappier jump-to-object.** Navigating to an object is now near-instant
  on the board that's already open, instead of a noticeable pause before it pans.
- improve: **Click vs. double-click in the object list.** A single click pans to and
  highlights the object; a double-click also opens its editor (the document overlay
  for docs/screenplays, the edit panel otherwise). Single-clicking again — or another
  object — closes the open edit panel and hands off cleanly.
- improve: The object-list filter supports **full regex**, matching the app's other
  search boxes.

## v0.92.0

- feat: **Real-time co-editing of Documents.** Open a Document with others and see
  their edits appear live, character by character, with each person's cursor and
  selection shown in their chosen colour and labelled with their name. Backed by a
  Yjs CRDT so concurrent edits merge cleanly and the title/mode stay in sync.
- feat: **Live presence in the editor.** A stack of collaborator avatars in the
  document header pulses and shows an icon for what each person is doing —
  ✏️ editing, 👁 viewing, or 💤 away — and animates smoothly as people come and go.
- improve: **Board presence mirrors the editor.** While you're in a Document, the
  canvas activity bar reflects your real status (editing / viewing / away) instead
  of a blanket "editing", so teammates see what you're actually doing.
- improve: Media and Document objects can now be **connected** like story nodes,
  their connection handles reveal on hover, and stay clickable when an image is
  flipped or rotated.
- improve: Document content now renders inside **Playthrough** mode.

## v0.91.0

- feat: **Documents.** A new rich-text Document object you can drop on the canvas
  or attach to work — full-screen editor with headings, bold/italic/underline/
  strike, bullet/numbered/check lists, quotes, code blocks, links, images, and
  tables. Autosaves, syncs to collaborators, and has an editable title.
- feat: **Screenplay mode.** Toggle a Document into Celtx-style script writing —
  Scene/Action/Character/Dialogue/Parenthetical/Transition/Shot elements with
  **Tab** to cycle, **Enter** to auto-advance, Ctrl+1–7 shortcuts, and proper
  Courier formatting. The canvas card shows a SCREENPLAY tag.
- feat: **Export to PDF** for both document and screenplay modes (via the browser’s
  Save-as-PDF, so the text stays selectable and paginated).
- improve: **Keyboard shortcuts shown in tooltips** consistently across the app in
  the (Ctrl+Z) style, plus a shortcut column in the right-click menu.


## v0.90.4

- improve: The image **flip** button now fades in on hover and out again, like the
  resize grip, instead of only appearing when the image is selected.


## v0.90.3

- improve: The image **flip** button returns to its top-left corner and no longer
  changes color when the mirror is active (subtle hover tint only).


## v0.90.2

- feat: **Layer nodes.** Right-click a node → **Bring to front** / **Send to back**
  to control what sits on top when items overlap. The order is saved, syncs to
  collaborators, and is undoable with Ctrl+Z.
- fix: **Delete** in the node right-click menu is red again (it had lost its danger
  styling).
- improve: The image **flip** button now matches the other node badges — a circular
  corner badge that fills with the accent colour when the mirror is active.


## v0.90.1

- feat: **Flip images horizontally (mirror).** Selected image nodes get a flip
  button that mirrors the image left↔right. Works alongside rotation, syncs to
  collaborators, is undoable with Ctrl+Z, and shows in playthrough and exports.


## v0.90.0

- feat: **Rotate images on the canvas.** Select an image and drag the round handle
  above it to any angle — hold **Shift** to snap to 15°, **double-click** the handle
  to reset to its original orientation. Rotation shows on the canvas, in playthrough
  (including the lightbox), and in PNG exports, syncs to collaborators, and is fully
  undoable with Ctrl+Z.
- fix: **Renames now update live.** Renaming a media file on the canvas — and
  editing an object’s fields in the panel — now shows up for collaborators
  immediately instead of only after they refresh.
- improve: **Context-aware drop overlay.** While dragging a file in, the prompt now
  says “Add it to <object>” when you hover the open panel and “place on the canvas”
  otherwise, so it’s clear where the drop will land.


## v0.89.2

- fix: The restore script now runs restic as the foolsboard user (matching the
  backup timer and the app), so the backup repository keeps a single owner —
  restic’s owner-only files mean a cross-user write would otherwise be unreadable.


## v0.89.1

- improve: Backup snapshots in Admin → Storage now use a themed archive icon (in
  the app’s accent color) instead of a raw 📦 emoji.


## v0.89.0

- improve: **Incremental, deduplicated backups (restic).** Instead of a full
  database dump + full media tarball every night, foolsboard now takes a restic
  snapshot — each one a complete, independently-restorable point in time (database
  + media), but only the changed data is stored. The repository is encrypted, and
  the chain is thinned to 7 daily / 6 weekly / 12 monthly snapshots. The restore
  script and Admin → Storage are updated; see BACKUP-RESTORE.md.


## v0.88.12

- improve: Board export now streams each media file into the zip in blocks instead
  of reading the whole file into memory, so exporting boards with large videos no
  longer causes a per-file RAM spike.


## v0.88.11

- improve: Startup banner title now uses the classic “standard” figlet font (violet
  “fools”, near-white “board”).


## v0.88.10

- improve: Startup banner title now uses the bolder “chunky” figlet font (violet
  “fools”, near-white “board”).


## v0.88.9

- improve: New startup banner — the “foolsboard” title rendered in a clean figlet
  font (violet “fools”, near-white “board”). Art is baked in (no runtime
  dependency).


## v0.88.8

- improve: Startup banner is now an ASCII “foolsboard” title (block-shadow letters,
  no separate glyph), in the logo’s violet (“fools”) and near-white (“board”).


## v0.88.7

- improve: Redesigned the startup banner — a line-art lightning-bolt mark (drawn
  with pipes and slashes) beside a letter-spaced “foolsboard” wordmark and a rule,
  in the logo’s violet. Replaces the crude solid-block version.


## v0.88.6

- improve: The startup banner now includes the logo’s angular bolt mark beside the
  ASCII “foolsboard” wordmark (backend dev console + dev frontend).


## v0.88.5

- fix: Restored the backend’s full startup/runtime logs (the previous build trimmed
  too much). All of uvicorn’s lifecycle + request logs are back.
- improve: Real ASCII-art “foolsboard” wordmark banner at startup (backend dev
  console + dev frontend). The big logo prints once at launch; production logs get a
  concise one-line brand marker.


## v0.88.4

- improve: Cleaner, more branded dev startup. The backend banner now has ASCII
  flourishes on both sides, and `python -m app` hides uvicorn’s lifecycle lines
  (“Uvicorn running on…”, the reloader/WatchFiles notices) while keeping request
  logs. The dev frontend no longer prints npm’s “> vite” echo and shows the matching
  banner.


## v0.88.3

- improve: Branded startup banner. The backend prints a “foolsboard” banner when it
  launches — in the dev console and in production logs (plain text there, no color
  codes). The dev frontend shows a matching banner in place of Vite’s. You can now
  start the backend in dev with `python -m app`.


## v0.88.2

- improve: Each canvas control button’s tooltip now shows its keyboard shortcut —
  Zoom in (`+`), Zoom out (`-`), Fit to screen (`F`), Play (`P`), Export (`E`). The
  zoom / fit / lock buttons are now custom-rendered to carry the hints (lock
  behaviour is unchanged); buttons without a shortcut just show their name.


## v0.88.1

- feat: Keyboard shortcuts for the canvas view controls — `+` / `=` zoom in, `-`
  zoom out, `F` fit board to screen, `P` play through the story (from the selected
  object, if any), `E` export as image. Listed under a new “View” group in the
  Keyboard Shortcuts dialog.


## v0.88.0

- feat: **Playthrough mode** — a full-screen reader that walks your board like an
  interactive story. Press the ▶ button in the canvas controls to start. Each
  object becomes a scene; its outgoing connections become the choices (labelled by
  the connection, or by the destination object when a connection has no label); an
  object with no outgoing connection is an ending. Read-only — it never changes the
  board. Number keys pick a path, ← goes back, Esc exits.


## v0.87.5

- improve: Hardened board-bundle import — oversized assets are now rejected up
  front (per-type limits, decompression-bomb safe) and each imported asset records
  its true byte size instead of trusting the bundle’s manifest.
- improve: Orphan-file cleanup now keeps a short safety grace even on a manual
  "GC now", so an in-flight upload can never be swept mid-write.
- improve: Startup maintenance tasks moved to a non-blocking, fault-isolated
  lifespan handler — one failing job no longer affects the others or boot time
  (also removes framework deprecation warnings from the server log).


## v0.87.4

- fix: A malformed `Authorization` token containing non-ASCII characters could
  cause a 500 error (in the request-logging middleware) instead of a clean 401.
  Token decoding is now hardened to reject any malformed token gracefully.


## v0.87.3

- improve: Security hardening — avatar uploads over 5 MB are now rejected up front,
  and password changes are rate-limited (5 failed attempts per 10 min per account)
  to block brute-forcing the current password from a stolen session.


## v0.87.2

- fix: Every entry in the **What’s New** dialog now shows a category icon — detail
  / sub-bullet lines inherit the icon of the item above them instead of rendering
  as a plain dot.


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
