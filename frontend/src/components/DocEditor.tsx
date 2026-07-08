// Full-screen rich-text editor for a "doc" node (TipTap / ProseMirror). Opens
// over the canvas like the Playthrough/Gallery overlays. Phase 1: single editor
// with debounced autosave into node.content ({ doc: JSON, text: preview }); the
// canvas card and search read the preview. Phase 2 will layer Yjs co-editing on
// top of the same content.
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useEditor, EditorContent, type Editor } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import TaskList from '@tiptap/extension-task-list'
import TaskItem from '@tiptap/extension-task-item'
import { TableKit } from '@tiptap/extension-table'
import Image from '@tiptap/extension-image'
import Placeholder from '@tiptap/extension-placeholder'
import { TextStyle, FontFamily, FontSize, Color, BackgroundColor } from '@tiptap/extension-text-style'
import TextAlign from '@tiptap/extension-text-align'
import Collaboration from '@tiptap/extension-collaboration'
import CollaborationCaret from '@tiptap/extension-collaboration-caret'
import * as Y from 'yjs'
import { removeAwarenessStates } from 'y-protocols/awareness'
import * as api from '../api'
import type { StoryNode } from '../types'
import { useAuth } from '../auth'
import { collabColor } from '../collab'
import { WsDocProvider, u8ToB64, b64ToU8 } from './docCollab'
import { exportDocHtmlAs, DOC_EXPORT_FORMATS, type DocExportFormat } from './docExport'
import ContextMenu from './ContextMenu'
import {
  ScreenplayElement,
  ScreenplayKeys,
  SCREEN_ELEMENTS,
  type ScreenEl,
} from './screenplay'
import {
  BulletListIcon,
  OrderedListIcon,
  TaskListIcon,
  QuoteIcon,
  CodeIcon,
  LinkIcon,
  ImageIcon,
  TableIcon,
  UndoIcon,
  RedoIcon,
  AlignLeftIcon,
  AlignCenterIcon,
  AlignRightIcon,
  AlignJustifyIcon,
} from './icons'
import PresenceBar from './PresenceBar'
import ScreenplayAutocomplete from './ScreenplayAutocomplete'
import type { MemberActivity } from '../realtime'

export type DocStatus = 'editing' | 'viewing' | 'afk'

// StarterKit v3 already bundles bold/italic/strike, headings, lists, blockquote,
// code/code-block, link, underline, and undo/redo — so we only add the extras.
const EXTENSIONS = [
  StarterKit.configure({
    heading: { levels: [1, 2, 3] },
    link: { openOnClick: false, autolink: true },
    undoRedo: false, // Collaboration (Yjs) provides history instead
  }),
  TaskList,
  TaskItem.configure({ nested: true }),
  TableKit.configure({ table: { resizable: true } }),
  Image,
  Placeholder.configure({ placeholder: 'Start writing…' }),
  TextStyle, // carries the font-family / size / color marks (Document mode only)
  FontFamily,
  FontSize,
  Color,
  BackgroundColor,
  TextAlign.configure({ types: ['heading', 'paragraph'] }),
]

// Font choices offered in Document mode. All are system font stacks — no web
// fonts are loaded (the strict CSP blocks external font requests anyway). An
// empty value clears the mark (back to the document default). Screenplay mode
// stays locked to Courier and never shows this control.
const DOC_FONTS: { label: string; value: string }[] = [
  { label: 'Default', value: '' },
  { label: 'Sans Serif', value: 'ui-sans-serif, system-ui, Arial, sans-serif' },
  { label: 'Serif', value: 'Georgia, "Times New Roman", serif' },
  { label: 'Monospace', value: 'ui-monospace, "Courier New", monospace' },
  { label: 'Arial', value: 'Arial, Helvetica, sans-serif' },
  { label: 'Georgia', value: 'Georgia, serif' },
  { label: 'Times New Roman', value: '"Times New Roman", Times, serif' },
  { label: 'Courier New', value: '"Courier New", Courier, monospace' },
  { label: 'Verdana', value: 'Verdana, Geneva, sans-serif' },
  { label: 'Trebuchet MS', value: '"Trebuchet MS", Helvetica, sans-serif' },
  { label: 'Garamond', value: 'Garamond, "Times New Roman", serif' },
  { label: 'Comic Sans MS', value: '"Comic Sans MS", cursive' },
]

// Font sizes offered in Document mode (empty value clears back to the default).
const FONT_SIZES: { label: string; value: string }[] = [
  { label: 'Default', value: '' },
  { label: '12', value: '12px' },
  { label: '14', value: '14px' },
  { label: '16', value: '16px' },
  { label: '18', value: '18px' },
  { label: '20', value: '20px' },
  { label: '24', value: '24px' },
  { label: '30', value: '30px' },
  { label: '36', value: '36px' },
]

// Text-color swatches — saturated hues that read on the dark editor surface and
// stay meaningful in the white PDF export.
const TEXT_COLORS = [
  '#ffffff', '#94a3b8', '#ef4444', '#f97316', '#eab308',
  '#22c55e', '#06b6d4', '#3b82f6', '#8b5cf6', '#ec4899',
]

// Highlight (background) swatches — pale marker tones.
const HIGHLIGHT_COLORS = [
  '#fde047', '#fdba74', '#86efac', '#5eead4',
  '#93c5fd', '#d8b4fe', '#f9a8d4', '#e5e7eb',
]

interface Props {
  node: StoryNode
  boardId: string
  onClose: () => void
  onSaved: (updated: StoryNode) => void
  // Report my live status so the board presence bar can mirror it (editing /
  // viewing / away) instead of a blanket "editing" while the editor is open.
  onStatusChange?: (status: DocStatus) => void
}

function Btn({
  onClick,
  active,
  title,
  children,
}: {
  onClick: () => void
  active?: boolean
  title: string
  children: React.ReactNode
}) {
  return (
    <button
      type="button"
      className={'doc-tb__btn' + (active ? ' doc-tb__btn--on' : '')}
      title={title}
      onMouseDown={(e) => e.preventDefault()} // keep editor selection
      onClick={onClick}
    >
      {children}
    </button>
  )
}

// A toolbar button that opens a small popover (font/size/color/highlight menus).
// Closes on outside click or Escape. The trigger keeps the editor selection via
// mousedown-preventDefault; menu contents must do the same on their own buttons.
function ToolbarPopover({
  title,
  trigger,
  minWidth,
  children,
}: {
  title: string
  trigger: React.ReactNode
  minWidth?: number
  children: (close: () => void) => React.ReactNode
}) {
  const [open, setOpen] = useState(false)
  const wrapRef = useRef<HTMLSpanElement>(null)
  useEffect(() => {
    if (!open) return
    const onDown = (e: PointerEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setOpen(false)
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false)
    }
    window.addEventListener('pointerdown', onDown)
    window.addEventListener('keydown', onKey)
    return () => {
      window.removeEventListener('pointerdown', onDown)
      window.removeEventListener('keydown', onKey)
    }
  }, [open])
  return (
    <span className="doc-tb__pop" ref={wrapRef}>
      <button
        type="button"
        className="doc-tb__btn doc-tb__popbtn"
        title={title}
        onMouseDown={(e) => e.preventDefault()}
        onClick={() => setOpen((v) => !v)}
      >
        {trigger}
        <span className="doc-tb__popcaret" aria-hidden="true">▾</span>
      </button>
      {open && (
        <div className="doc-tb__popmenu" style={minWidth ? { minWidth } : undefined}>
          {children(() => setOpen(false))}
        </div>
      )}
    </span>
  )
}

export default function DocEditor({ node, boardId, onClose, onSaved, onStatusChange }: Props) {
  const [title, setTitle] = useState(node.title || 'Untitled document')
  const [status, setStatus] = useState<'idle' | 'saving' | 'saved'>('idle')
  const [closing, setClosing] = useState(false)
  const [mode, setMode] = useState<'doc' | 'script'>(
    node.content?.mode === 'script' ? 'script' : 'doc',
  )
  const savedFlash = useRef<number | null>(null)
  const saveTimer = useRef<number | null>(null)
  // Screenplay keys read the live mode via this ref (the editor is shared).
  const modeRef = useRef(mode)
  useEffect(() => {
    modeRef.current = mode
  }, [mode])

  const { user } = useAuth()

  // Shared Yjs document for this node, seeded from the persisted snapshot, plus a
  // provider that syncs it over the existing WebSocket relay. Built once.
  // Created once via refs so React StrictMode's double render/mount doesn't
  // create or destroy the side-effectful provider (that killed dev sync).
  const ydocRef = useRef<Y.Doc | null>(null)
  if (!ydocRef.current) {
    const d = new Y.Doc()
    const ystate = node.content?.ystate
    if (typeof ystate === 'string' && ystate) {
      try {
        Y.applyUpdate(d, b64ToU8(ystate))
      } catch {
        /* ignore an unreadable snapshot */
      }
    }
    ydocRef.current = d
  }
  const ydoc = ydocRef.current
  const providerRef = useRef<WsDocProvider | null>(null)
  if (!providerRef.current) providerRef.current = new WsDocProvider(node.id, ydoc)
  const provider = providerRef.current

  // Wire the provider to the socket on mount; tear down on unmount — but defer the
  // teardown so a StrictMode remount (which fires the cleanup then re-runs) cancels
  // it. connect()/disconnect() are idempotent.
  const disconnectTimer = useRef<number | null>(null)
  useEffect(() => {
    if (disconnectTimer.current) {
      window.clearTimeout(disconnectTimer.current)
      disconnectTimer.current = null
    }
    provider.connect()
    return () => {
      disconnectTimer.current = window.setTimeout(() => provider.destroy(), 250)
    }
  }, [provider])
  const meColor = user ? user.color ?? collabColor(user.id) : '#888'
  const meName = user?.username || 'Someone'
  const meId = user?.id ?? ''
  const ymeta = useMemo(() => ydoc.getMap('meta'), [ydoc])

  // Collaborative title + mode: kept in the shared doc so concurrent editors don't
  // clobber each other (a plain per-client value would last-write-wins on save).
  useEffect(() => {
    if (ymeta.get('title') === undefined) ymeta.set('title', node.title || 'Untitled document')
    if (ymeta.get('mode') === undefined)
      ymeta.set('mode', node.content?.mode === 'script' ? 'script' : 'doc')
    const adopt = () => {
      const t = ymeta.get('title')
      if (typeof t === 'string') setTitle(t)
      const m = ymeta.get('mode')
      if (m === 'doc' || m === 'script') {
        modeRef.current = m
        setMode(m)
      }
    }
    adopt()
    ymeta.observe(adopt)
    return () => ymeta.unobserve(adopt)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ymeta])

  // Who else is in this doc (from Yjs awareness), so idle collaborators are shown
  // even before they place a cursor.
  const [peers, setPeers] = useState<
    { key: string; name: string; color: string; status: DocStatus }[]
  >([])
  useEffect(() => {
    const aw = provider.awareness
    aw.setLocalStateField('user', { id: meId, name: meName, color: meColor })
    if (!aw.getLocalState()?.docStatus) aw.setLocalStateField('docStatus', 'viewing')
    const refresh = () => {
      // One avatar per distinct person (dedupe by user id, collapse extra tabs /
      // stale reloaded clients). Prefer an "active" status if any of a person's
      // connections is editing.
      const byPerson = new Map<string, { name: string; color: string; status: DocStatus }>()
      // Any awareness state that claims to be ME but isn't my current connection is
      // either a ghost from a prior tab/refresh or a live second tab of mine. Never
      // show it as a peer. Only actively *remove* it (which also broadcasts, clearing
      // it for everyone) once it's gone stale — a live tab heartbeats, so this won't
      // fight it into a remove/re-add flicker; a dead ghost stops updating and is
      // reaped here (or by Yjs's ~30s timeout as a backstop).
      const GHOST_STALE_MS = 20_000
      const meta = (aw as unknown as { meta?: Map<number, { lastUpdated: number }> }).meta
      const myGhosts: number[] = []
      aw.getStates().forEach((state, clientId) => {
        if (clientId === aw.clientID) return // skip my own connection
        const s = state as {
          user?: { id?: string; name: string; color: string }
          docStatus?: DocStatus
        }
        const u = s.user
        if (!u?.name) return
        if (meId && u.id === meId) {
          const last = meta?.get(clientId)?.lastUpdated ?? 0
          if (Date.now() - last > GHOST_STALE_MS) myGhosts.push(clientId)
          return
        }
        const key = u.id || `c${clientId}`
        const status: DocStatus =
          s.docStatus === 'editing' || s.docStatus === 'afk' ? s.docStatus : 'viewing'
        const prev = byPerson.get(key)
        // Editing wins over viewing wins over afk when a person has >1 connection.
        const rank = (x: DocStatus) => (x === 'editing' ? 2 : x === 'viewing' ? 1 : 0)
        if (!prev || rank(status) > rank(prev.status)) {
          byPerson.set(key, { name: u.name, color: u.color || '#888', status })
        }
      })
      if (myGhosts.length) removeAwarenessStates(aw, myGhosts, 'local')
      setPeers([...byPerson.entries()].map(([key, v]) => ({ key, ...v })))
    }
    aw.on('change', refresh)
    refresh()
    return () => aw.off('change', refresh)
  }, [provider, meName, meColor, meId])

  // Broadcast my own status: editing while typing (decays after a pause), away
  // after idle / window blur, viewing otherwise — like the canvas presence.
  const myStatusRef = useRef<DocStatus>('viewing')
  const setMyStatus = useCallback(
    (s: DocStatus) => {
      if (myStatusRef.current === s) return
      myStatusRef.current = s
      provider.awareness.setLocalStateField('docStatus', s)
      onStatusChange?.(s) // mirror to the board presence bar
    },
    [provider, onStatusChange],
  )
  // Report the initial status once so the canvas shows "viewing" (not a stale
  // "editing") the moment the editor opens.
  useEffect(() => {
    onStatusChange?.(myStatusRef.current)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])
  const editDecay = useRef<number | null>(null)
  useEffect(() => {
    let afk = 0
    const bump = () => {
      if (myStatusRef.current === 'afk') setMyStatus('viewing')
      window.clearTimeout(afk)
      afk = window.setTimeout(() => setMyStatus('afk'), 60000)
    }
    const onBlur = () => setMyStatus('afk')
    const evs = ['pointermove', 'keydown', 'pointerdown']
    evs.forEach((e) => window.addEventListener(e, bump, { passive: true }))
    window.addEventListener('blur', onBlur)
    bump()
    return () => {
      window.clearTimeout(afk)
      evs.forEach((e) => window.removeEventListener(e, bump))
      window.removeEventListener('blur', onBlur)
    }
  }, [setMyStatus])

  // Built once: rich-text + screenplay layer + Yjs collaboration & live carets.
  const extensions = useMemo(
    () => [
      ...EXTENSIONS,
      ScreenplayElement,
      ScreenplayKeys.configure({ isScript: () => modeRef.current === 'script' }),
      Collaboration.configure({ document: ydoc }),
      CollaborationCaret.configure({
        provider,
        user: { id: meId, name: meName, color: meColor },
        render: (u: { name: string; color: string }) => {
          const caret = document.createElement('span')
          caret.className = 'collaboration-carets__caret'
          // Assign via CSSOM, not setAttribute('style', …): a collaborator's color
          // comes from untrusted awareness, and a raw style string would let them
          // inject extra CSS declarations (a fixed-position overlay, a beacon url…).
          // The CSSOM setter drops anything that isn't a valid color.
          caret.style.borderColor = u.color
          const label = document.createElement('div')
          label.className = 'collaboration-carets__label'
          label.style.backgroundColor = u.color
          label.textContent = u.name
          caret.appendChild(label)
          return caret
        },
      }),
    ],
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  )

  const editor = useEditor({ extensions, autofocus: 'end' })

  // First collaborative open of a legacy doc (no ystate): seed the shared Yjs doc
  // from the saved rich text once — after a beat, so a live peer's state wins.
  useEffect(() => {
    if (!editor) return
    const hadYstate = typeof node.content?.ystate === 'string' && !!node.content?.ystate
    if (hadYstate || !node.content?.doc) return
    const t = window.setTimeout(() => {
      const frag = ydoc.getXmlFragment('default')
      const metaMap = ydoc.getMap('meta')
      if (frag.length === 0 && !metaMap.get('seeded')) {
        metaMap.set('seeded', true)
        editor.commands.setContent(node.content!.doc as object)
      }
    }, 500)
    return () => window.clearTimeout(t)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editor])

  // Force the toolbar to reflect the current selection's active marks/nodes.
  const [, setTick] = useState(0)
  useEffect(() => {
    if (!editor) return
    const bump = () => setTick((t) => t + 1)
    editor.on('transaction', bump)
    return () => {
      editor.off('transaction', bump)
    }
  }, [editor])

  // Typing marks me "editing" (decays back to viewing after a short pause).
  useEffect(() => {
    if (!editor) return
    const onUpdate = () => {
      setMyStatus('editing')
      if (editDecay.current) window.clearTimeout(editDecay.current)
      editDecay.current = window.setTimeout(() => setMyStatus('viewing'), 2500)
    }
    editor.on('update', onUpdate)
    return () => {
      editor.off('update', onUpdate)
      if (editDecay.current) window.clearTimeout(editDecay.current)
    }
  }, [editor, setMyStatus])

  // --- Autosave (debounced) -------------------------------------------------
  const maxSaveTimer = useRef<number | null>(null)
  const saveNow = useCallback(async () => {
    if (!editor) return
    if (saveTimer.current) {
      window.clearTimeout(saveTimer.current)
      saveTimer.current = null
    }
    if (maxSaveTimer.current != null) {
      window.clearTimeout(maxSaveTimer.current)
      maxSaveTimer.current = null
    }
    setStatus('saving')
    const content = {
      ...(node.content ?? {}),
      doc: editor.getJSON(),
      text: editor.getText().slice(0, 4000),
      mode,
      ystate: u8ToB64(Y.encodeStateAsUpdate(ydoc)),
    }
    try {
      const updated = await api.updateNode(boardId, node.id, {
        title: title.trim() || 'Untitled document',
        content,
      })
      onSaved(updated)
      setStatus('saved')
      if (savedFlash.current) window.clearTimeout(savedFlash.current)
      savedFlash.current = window.setTimeout(() => setStatus('idle'), 1500)
    } catch {
      setStatus('idle')
    }
  }, [editor, boardId, node, title, onSaved, mode])

  // Keep the latest saveNow in a ref so the debounce timer always calls the
  // current closure (title/editor changes) without re-scheduling.
  const saveRef = useRef(saveNow)
  useEffect(() => {
    saveRef.current = saveNow
  })
  const schedule = useCallback(() => {
    if (saveTimer.current) window.clearTimeout(saveTimer.current)
    saveTimer.current = window.setTimeout(() => saveRef.current(), 1200)
    // Cap the debounce so continuous typing still persists at least every ~8s
    // (otherwise a fast typist's work only lives in the unsaved Yjs state).
    if (maxSaveTimer.current == null) {
      maxSaveTimer.current = window.setTimeout(() => saveRef.current(), 8000)
    }
  }, [])
  // Best-effort flush when the tab is hidden/closed, so work isn't lost if the
  // window goes away between debounced saves.
  useEffect(() => {
    const flush = () => {
      if (saveTimer.current || maxSaveTimer.current != null) void saveRef.current()
    }
    const onVis = () => {
      if (document.visibilityState === 'hidden') flush()
    }
    window.addEventListener('pagehide', flush)
    document.addEventListener('visibilitychange', onVis)
    return () => {
      window.removeEventListener('pagehide', flush)
      document.removeEventListener('visibilitychange', onVis)
    }
  }, [])

  useEffect(() => {
    if (!editor) return
    const onUpdate = () => schedule()
    editor.on('update', onUpdate)
    return () => {
      editor.off('update', onUpdate)
    }
  }, [editor, schedule])

  // Save on close / unmount (flush any pending debounce first).
  const close = useCallback(() => {
    if (saveTimer.current) window.clearTimeout(saveTimer.current)
    setClosing(true) // play the exit animation
    void saveRef.current()
    window.setTimeout(onClose, 190)
  }, [onClose])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault()
        close()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => {
      window.removeEventListener('keydown', onKey)
      if (saveTimer.current) window.clearTimeout(saveTimer.current)
      if (maxSaveTimer.current != null) window.clearTimeout(maxSaveTimer.current)
      if (savedFlash.current) window.clearTimeout(savedFlash.current)
    }
  }, [close])

  const promptLink = (ed: Editor) => {
    const prev = ed.getAttributes('link').href as string | undefined
    const url = window.prompt('Link URL', prev ?? 'https://')
    if (url === null) return
    if (url === '') ed.chain().focus().extendMarkRange('link').unsetLink().run()
    else ed.chain().focus().extendMarkRange('link').setLink({ href: url }).run()
  }
  const promptImage = (ed: Editor) => {
    const url = window.prompt('Image URL')
    if (url) ed.chain().focus().setImage({ src: url }).run()
  }

  // Switch between rich-document and screenplay modes (same content, different
  // formatting + keymap). Entering script mode labels an unmarked line as a scene.
  const switchMode = (m: 'doc' | 'script') => {
    if (m === mode) return
    modeRef.current = m
    setMode(m)
    ymeta.set('mode', m) // sync the mode to collaborators
    if (m === 'script' && editor && !editor.getAttributes('paragraph').element) {
      editor.chain().focus().updateAttributes('paragraph', { element: 'scene' }).run()
    }
    schedule()
  }
  const curEl = (editor?.getAttributes('paragraph').element as ScreenEl | undefined) ?? null

  // Document-mode text-style controls (font, size, color, highlight). Each applies
  // a mark to the current selection; the popover items keep the editor selection
  // via mousedown-preventDefault. All are hidden in screenplay mode.
  const curFont = (editor?.getAttributes('textStyle').fontFamily as string | undefined) || ''
  const curFontLabel = DOC_FONTS.find((f) => f.value === curFont)?.label ?? 'Font'
  const curSize = (editor?.getAttributes('textStyle').fontSize as string | undefined) || ''
  const curSizeLabel = FONT_SIZES.find((s) => s.value === curSize)?.label ?? 'Size'
  const curColor = (editor?.getAttributes('textStyle').color as string | undefined) || ''
  const curHighlight = (editor?.getAttributes('textStyle').backgroundColor as string | undefined) || ''
  const applyFont = (value: string) => {
    if (!editor) return
    const c = editor.chain().focus()
    if (value) c.setFontFamily(value).run()
    else c.unsetFontFamily().run()
  }
  const applySize = (value: string) => {
    if (!editor) return
    const c = editor.chain().focus()
    if (value) c.setFontSize(value).run()
    else c.unsetFontSize().run()
  }
  const applyColor = (value: string) => {
    if (!editor) return
    const c = editor.chain().focus()
    if (value) c.setColor(value).run()
    else c.unsetColor().run()
  }
  const applyHighlight = (value: string) => {
    if (!editor) return
    const c = editor.chain().focus()
    if (value) c.setBackgroundColor(value).run()
    else c.unsetBackgroundColor().run()
  }

  // Export the live editor content in the chosen format (PDF prints; DOCX/ODT/TXT
  // download — screenplays get industry-formatted .docx).
  const [exportMenu, setExportMenu] = useState<{ x: number; y: number } | null>(null)
  const exportAs = (format: DocExportFormat) => {
    if (!editor) return
    void exportDocHtmlAs(editor.getHTML(), title, format, mode === 'script')
  }

  return (
    <div
      className={
        'doc-editor' +
        (closing ? ' doc-editor--closing' : '') +
        (mode === 'script' ? ' doc-editor--script' : '')
      }
      role="dialog"
      aria-label="Document editor"
      onKeyDown={(e) => {
        // Extra shortcuts for toolbar actions TipTap doesn't bind by default.
        // Keyed on e.code so Shift/AltGr character remapping can't break them.
        if (!editor || !(e.ctrlKey || e.metaKey)) return
        if (e.shiftKey && !e.altKey && e.code === 'Digit9') {
          e.preventDefault()
          editor.chain().focus().toggleTaskList().run()
        } else if (e.shiftKey && !e.altKey && e.code === 'KeyK') {
          e.preventDefault()
          promptLink(editor)
        } else if (e.altKey && !e.shiftKey && e.code === 'KeyI') {
          e.preventDefault()
          promptImage(editor)
        } else if (e.altKey && !e.shiftKey && e.code === 'KeyT') {
          e.preventDefault()
          editor.chain().focus().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run()
        }
      }}
    >
      <div className="doc-editor__bar">
        <input
          className="doc-editor__title"
          value={title}
          placeholder="Untitled document"
          onChange={(e) => {
            setTitle(e.target.value)
            ymeta.set('title', e.target.value)
            schedule()
          }}
        />
        {/* Always mounted (even with no peers) so PresenceBar can animate the last
            collaborator out instead of vanishing when the list empties. */}
        <div className="doc-peers">
          <PresenceBar
            members={peers.map(
              (p): MemberActivity => ({
                id: p.key,
                username: p.name,
                color: p.color,
                status: p.status === 'afk' ? 'away' : p.status,
              }),
            )}
          />
        </div>
        <span className="doc-editor__status">
          {status === 'saving' ? 'Saving…' : status === 'saved' ? 'Saved' : ''}
        </span>
        <button
          className="btn"
          onClick={(e) => {
            const r = (e.currentTarget as HTMLElement).getBoundingClientRect()
            setExportMenu(exportMenu ? null : { x: r.left, y: r.bottom + 4 })
          }}
          title="Export the document (PDF, Word, OpenDocument, or text)"
        >
          Export ▾
        </button>
        <button className="btn btn--primary doc-editor__done" onClick={close} title="Close (Esc)">
          Done
        </button>
      </div>

      {exportMenu && (
        <ContextMenu
          x={exportMenu.x}
          y={exportMenu.y}
          items={DOC_EXPORT_FORMATS.map((f) => ({
            label: f.label,
            onClick: () => exportAs(f.format),
          }))}
          onClose={() => setExportMenu(null)}
        />
      )}

      {editor && (
        <div className="doc-tb">
          <div className="doc-mode" role="tablist" aria-label="Editor mode">
            <button
              className={'doc-mode__btn' + (mode === 'doc' ? ' doc-mode__btn--on' : '')}
              onClick={() => switchMode('doc')}
              title="Rich-text document"
            >
              Document
            </button>
            <button
              className={'doc-mode__btn' + (mode === 'script' ? ' doc-mode__btn--on' : '')}
              onClick={() => switchMode('script')}
              title="Celtx-style screenplay"
            >
              Screenplay
            </button>
          </div>
          <span className="doc-tb__sep" />
          {mode === 'script' ? (
            <>
              {SCREEN_ELEMENTS.map(({ el, label, key }) => (
                <Btn
                  key={el}
                  title={`${label} (Ctrl+${key})`}
                  active={curEl === el}
                  onClick={() => editor.chain().focus().updateAttributes('paragraph', { element: el }).run()}
                >
                  <span className="doc-tb__el">{label}</span>
                </Btn>
              ))}
              <span className="doc-tb__hint">Tab cycles · Enter advances</span>
            </>
          ) : (
            <>
          <ToolbarPopover
            title="Font"
            minWidth={190}
            trigger={
              <span className="doc-tb__fontname" style={{ fontFamily: curFont || undefined }}>
                {curFontLabel}
              </span>
            }
          >
            {(close) => (
              <ul className="doc-tb__optlist" role="listbox">
                {DOC_FONTS.map((f) => (
                  <li key={f.label}>
                    <button
                      type="button"
                      role="option"
                      aria-selected={curFont === f.value}
                      className={'doc-tb__opt' + (curFont === f.value ? ' doc-tb__opt--on' : '')}
                      style={{ fontFamily: f.value || undefined }}
                      onMouseDown={(e) => e.preventDefault()}
                      onClick={() => {
                        applyFont(f.value)
                        close()
                      }}
                    >
                      {f.label}
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </ToolbarPopover>
          <ToolbarPopover
            title="Font size"
            minWidth={84}
            trigger={<span className="doc-tb__sizeval">{curSizeLabel}</span>}
          >
            {(close) => (
              <ul className="doc-tb__optlist" role="listbox">
                {FONT_SIZES.map((s) => (
                  <li key={s.label}>
                    <button
                      type="button"
                      role="option"
                      aria-selected={curSize === s.value}
                      className={'doc-tb__opt' + (curSize === s.value ? ' doc-tb__opt--on' : '')}
                      onMouseDown={(e) => e.preventDefault()}
                      onClick={() => {
                        applySize(s.value)
                        close()
                      }}
                    >
                      {s.label}
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </ToolbarPopover>
          <span className="doc-tb__sep" />
          <Btn title="Bold (Ctrl+B)" active={editor.isActive('bold')} onClick={() => editor.chain().focus().toggleBold().run()}>
            <b className="doc-tb__glyph">B</b>
          </Btn>
          <Btn title="Italic (Ctrl+I)" active={editor.isActive('italic')} onClick={() => editor.chain().focus().toggleItalic().run()}>
            <i className="doc-tb__glyph">I</i>
          </Btn>
          <Btn title="Underline (Ctrl+U)" active={editor.isActive('underline')} onClick={() => editor.chain().focus().toggleUnderline().run()}>
            <u className="doc-tb__glyph">U</u>
          </Btn>
          <Btn title="Strikethrough (Ctrl+Shift+S)" active={editor.isActive('strike')} onClick={() => editor.chain().focus().toggleStrike().run()}>
            <s className="doc-tb__glyph">S</s>
          </Btn>
          <ToolbarPopover
            title="Text color"
            trigger={
              <span className="doc-tb__colorglyph" style={{ borderBottomColor: curColor || 'currentColor' }}>
                A
              </span>
            }
          >
            {(close) => (
              <div className="doc-tb__swatches">
                <button
                  type="button"
                  className="doc-tb__swatch doc-tb__swatch--reset"
                  title="Default"
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => {
                    applyColor('')
                    close()
                  }}
                >
                  ✕
                </button>
                {TEXT_COLORS.map((c) => (
                  <button
                    key={c}
                    type="button"
                    className={'doc-tb__swatch' + (curColor === c ? ' doc-tb__swatch--on' : '')}
                    style={{ background: c }}
                    title={c}
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => {
                      applyColor(c)
                      close()
                    }}
                  />
                ))}
              </div>
            )}
          </ToolbarPopover>
          <ToolbarPopover
            title="Highlight"
            trigger={
              <span
                className="doc-tb__hlglyph"
                style={curHighlight ? { background: curHighlight, color: '#1f2937' } : undefined}
              >
                A
              </span>
            }
          >
            {(close) => (
              <div className="doc-tb__swatches">
                <button
                  type="button"
                  className="doc-tb__swatch doc-tb__swatch--reset"
                  title="None"
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => {
                    applyHighlight('')
                    close()
                  }}
                >
                  ✕
                </button>
                {HIGHLIGHT_COLORS.map((c) => (
                  <button
                    key={c}
                    type="button"
                    className={'doc-tb__swatch' + (curHighlight === c ? ' doc-tb__swatch--on' : '')}
                    style={{ background: c }}
                    title={c}
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => {
                      applyHighlight(c)
                      close()
                    }}
                  />
                ))}
              </div>
            )}
          </ToolbarPopover>
          <span className="doc-tb__sep" />
          <Btn title="Heading 1 (Ctrl+Alt+1)" active={editor.isActive('heading', { level: 1 })} onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()}>
            <span className="doc-tb__h">H1</span>
          </Btn>
          <Btn title="Heading 2 (Ctrl+Alt+2)" active={editor.isActive('heading', { level: 2 })} onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}>
            <span className="doc-tb__h">H2</span>
          </Btn>
          <Btn title="Heading 3 (Ctrl+Alt+3)" active={editor.isActive('heading', { level: 3 })} onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}>
            <span className="doc-tb__h">H3</span>
          </Btn>
          <span className="doc-tb__sep" />
          <Btn title="Align Left (Ctrl+Shift+L)" active={editor.isActive({ textAlign: 'left' })} onClick={() => editor.chain().focus().setTextAlign('left').run()}>
            <AlignLeftIcon />
          </Btn>
          <Btn title="Align Center (Ctrl+Shift+E)" active={editor.isActive({ textAlign: 'center' })} onClick={() => editor.chain().focus().setTextAlign('center').run()}>
            <AlignCenterIcon />
          </Btn>
          <Btn title="Align Right (Ctrl+Shift+R)" active={editor.isActive({ textAlign: 'right' })} onClick={() => editor.chain().focus().setTextAlign('right').run()}>
            <AlignRightIcon />
          </Btn>
          <Btn title="Justify (Ctrl+Shift+J)" active={editor.isActive({ textAlign: 'justify' })} onClick={() => editor.chain().focus().setTextAlign('justify').run()}>
            <AlignJustifyIcon />
          </Btn>
          <span className="doc-tb__sep" />
          <Btn title="Bullet List (Ctrl+Shift+8)" active={editor.isActive('bulletList')} onClick={() => editor.chain().focus().toggleBulletList().run()}>
            <BulletListIcon />
          </Btn>
          <Btn title="Numbered List (Ctrl+Shift+7)" active={editor.isActive('orderedList')} onClick={() => editor.chain().focus().toggleOrderedList().run()}>
            <OrderedListIcon />
          </Btn>
          <Btn title="Checklist (Ctrl+Shift+9)" active={editor.isActive('taskList')} onClick={() => editor.chain().focus().toggleTaskList().run()}>
            <TaskListIcon />
          </Btn>
          <span className="doc-tb__sep" />
          <Btn title="Quote (Ctrl+Shift+B)" active={editor.isActive('blockquote')} onClick={() => editor.chain().focus().toggleBlockquote().run()}>
            <QuoteIcon />
          </Btn>
          <Btn title="Code Block (Ctrl+Alt+C)" active={editor.isActive('codeBlock')} onClick={() => editor.chain().focus().toggleCodeBlock().run()}>
            <CodeIcon />
          </Btn>
          <Btn title="Link (Ctrl+Shift+K)" active={editor.isActive('link')} onClick={() => promptLink(editor)}>
            <LinkIcon />
          </Btn>
          <Btn title="Image by URL (Ctrl+Alt+I)" onClick={() => promptImage(editor)}>
            <ImageIcon />
          </Btn>
          <Btn title="Insert Table (Ctrl+Alt+T)" onClick={() => editor.chain().focus().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run()}>
            <TableIcon />
          </Btn>
            </>
          )}
          <span className="doc-tb__sep" />
          <Btn title="Undo (Ctrl+Z)" onClick={() => editor.chain().focus().undo().run()}>
            <UndoIcon />
          </Btn>
          <Btn title="Redo (Ctrl+Shift+Z)" onClick={() => editor.chain().focus().redo().run()}>
            <RedoIcon />
          </Btn>
        </div>
      )}

      <div className="doc-editor__scroll">
        <EditorContent className="doc-editor__content" editor={editor} />
      </div>
      <ScreenplayAutocomplete editor={editor} active={mode === 'script'} />
    </div>
  )
}
