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
import Collaboration from '@tiptap/extension-collaboration'
import CollaborationCaret from '@tiptap/extension-collaboration-caret'
import * as Y from 'yjs'
import * as api from '../api'
import type { StoryNode } from '../types'
import { useAuth } from '../auth'
import { collabColor } from '../collab'
import { WsDocProvider, u8ToB64, b64ToU8 } from './docCollab'
import { buildPrintHtml, printHtml } from './docExport'
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
      aw.getStates().forEach((state, clientId) => {
        if (clientId === aw.clientID) return // skip my own connection
        const s = state as {
          user?: { id?: string; name: string; color: string }
          docStatus?: DocStatus
        }
        const u = s.user
        if (!u?.name) return
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
          caret.setAttribute('style', `border-color:${u.color}`)
          const label = document.createElement('div')
          label.className = 'collaboration-carets__label'
          label.setAttribute('style', `background-color:${u.color}`)
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
  const saveNow = useCallback(async () => {
    if (!editor) return
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

  // Export to PDF via the browser's print dialog (Save as PDF) — real selectable
  // text, paginated, styled for paper per the current mode.
  const exportPdf = () => {
    if (!editor) return
    printHtml(buildPrintHtml(title.trim() || 'Untitled document', editor.getHTML(), mode === 'script'))
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
        <button className="btn" onClick={exportPdf} title="Export to PDF (opens your print dialog — choose Save as PDF)">
          Export PDF
        </button>
        <button className="btn btn--primary doc-editor__done" onClick={close} title="Close (Esc)">
          Done
        </button>
      </div>

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
