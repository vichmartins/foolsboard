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
import * as api from '../api'
import type { StoryNode } from '../types'
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

// StarterKit v3 already bundles bold/italic/strike, headings, lists, blockquote,
// code/code-block, link, underline, and undo/redo — so we only add the extras.
const EXTENSIONS = [
  StarterKit.configure({
    heading: { levels: [1, 2, 3] },
    link: { openOnClick: false, autolink: true },
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
}

function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c] as string,
  )
}

// Build a standalone, print-ready HTML document for the browser's Save-as-PDF.
// Rich docs print in a serif with 1in margins; screenplays print in Courier with
// industry element indentation (measured from a 1.5in left margin).
function buildPrintHtml(title: string, bodyHtml: string, isScript: boolean): string {
  const page = isScript ? '@page { margin: 1in 1in 1in 1.5in; }' : '@page { margin: 1in; }'
  const shared = `
    * { box-sizing: border-box; }
    body { margin: 0; color: #000; background: #fff; }
    .pdf-title { margin: 0 0 1em; }
    img { max-width: 100%; }`
  const doc = `
    body { font: 12pt/1.6 Georgia, 'Times New Roman', serif; }
    .pdf-title { font-size: 22pt; }
    h1 { font-size: 20pt; margin: .8em 0 .3em; }
    h2 { font-size: 16pt; margin: .8em 0 .3em; }
    h3 { font-size: 13pt; margin: .7em 0 .3em; }
    p { margin: .5em 0; }
    ul, ol { padding-left: 1.5em; }
    blockquote { border-left: 3px solid #999; margin: .6em 0; padding-left: 1em; color: #333; }
    pre { background: #f4f4f4; padding: 10px; border-radius: 4px; font: 10.5pt 'Courier New', monospace; white-space: pre-wrap; }
    code { background: #f4f4f4; padding: 1px 4px; border-radius: 3px; font-family: 'Courier New', monospace; }
    pre code { background: none; padding: 0; }
    a { color: #0645ad; }
    table { border-collapse: collapse; width: 100%; }
    th, td { border: 1px solid #999; padding: 5px 7px; }
    ul[data-type="taskList"] { list-style: none; padding-left: 0; }
    ul[data-type="taskList"] li { display: flex; gap: 6px; }`
  const script = `
    body { font: 12pt/1.5 'Courier New', Courier, monospace; }
    .pdf-title { text-align: center; text-transform: uppercase; }
    p { margin: 0; }
    p[data-element="scene"] { text-transform: uppercase; font-weight: bold; margin-top: 1.2em; }
    p[data-element="action"] { margin-top: .6em; }
    p[data-element="character"] { text-transform: uppercase; margin: .8em 0 0 2.2in; }
    p[data-element="parenthetical"] { margin: 0 0 0 1.6in; }
    p[data-element="dialogue"] { margin: 0 1in 0 1in; }
    p[data-element="transition"] { text-transform: uppercase; text-align: right; margin-top: .8em; }
    p[data-element="shot"] { text-transform: uppercase; margin-top: .6em; }`
  return `<!doctype html><html><head><meta charset="utf-8"><title>${escapeHtml(
    title,
  )}</title><style>${page}${shared}${isScript ? script : doc}</style></head><body><h1 class="pdf-title">${escapeHtml(
    title,
  )}</h1>${bodyHtml}</body></html>`
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

export default function DocEditor({ node, boardId, onClose, onSaved }: Props) {
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

  // Built once: the rich-text extensions + screenplay attribute/keymap layered on.
  const extensions = useMemo(
    () => [
      ...EXTENSIONS,
      ScreenplayElement,
      ScreenplayKeys.configure({ isScript: () => modeRef.current === 'script' }),
    ],
    [],
  )

  const editor = useEditor({
    extensions,
    content: (node.content?.doc as object | undefined) ?? '',
    autofocus: 'end',
  })

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

  // --- Autosave (debounced) -------------------------------------------------
  const saveNow = useCallback(async () => {
    if (!editor) return
    setStatus('saving')
    const content = {
      ...(node.content ?? {}),
      doc: editor.getJSON(),
      text: editor.getText().slice(0, 4000),
      mode,
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
    saveTimer.current = window.setTimeout(() => saveRef.current(), 800)
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
    const html = buildPrintHtml(
      title.trim() || 'Untitled document',
      editor.getHTML(),
      mode === 'script',
    )
    const w = window.open('', '_blank')
    if (!w) return
    w.document.write(html)
    w.document.close()
    w.focus()
    // Give the new window a moment to lay out (and load any images) before printing.
    window.setTimeout(() => w.print(), 350)
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
            schedule()
          }}
        />
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
          <Btn title="Bullet list (Ctrl+Shift+8)" active={editor.isActive('bulletList')} onClick={() => editor.chain().focus().toggleBulletList().run()}>
            <BulletListIcon />
          </Btn>
          <Btn title="Numbered list (Ctrl+Shift+7)" active={editor.isActive('orderedList')} onClick={() => editor.chain().focus().toggleOrderedList().run()}>
            <OrderedListIcon />
          </Btn>
          <Btn title="Checklist (Ctrl+Shift+9)" active={editor.isActive('taskList')} onClick={() => editor.chain().focus().toggleTaskList().run()}>
            <TaskListIcon />
          </Btn>
          <span className="doc-tb__sep" />
          <Btn title="Quote (Ctrl+Shift+B)" active={editor.isActive('blockquote')} onClick={() => editor.chain().focus().toggleBlockquote().run()}>
            <QuoteIcon />
          </Btn>
          <Btn title="Code block (Ctrl+Alt+C)" active={editor.isActive('codeBlock')} onClick={() => editor.chain().focus().toggleCodeBlock().run()}>
            <CodeIcon />
          </Btn>
          <Btn title="Link (Ctrl+Shift+K)" active={editor.isActive('link')} onClick={() => promptLink(editor)}>
            <LinkIcon />
          </Btn>
          <Btn title="Image by URL (Ctrl+Alt+I)" onClick={() => promptImage(editor)}>
            <ImageIcon />
          </Btn>
          <Btn title="Insert table (Ctrl+Alt+T)" onClick={() => editor.chain().focus().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run()}>
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
    </div>
  )
}
