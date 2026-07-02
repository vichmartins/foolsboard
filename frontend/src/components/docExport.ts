// Shared Document → print/PDF helpers, used by both the doc editor (live content)
// and the explorer's object list (stored content). Rich docs print in a serif
// with 1in margins; screenplays print in Courier with industry element indents.
import { generateHTML } from '@tiptap/core'
import StarterKit from '@tiptap/starter-kit'
import TaskList from '@tiptap/extension-task-list'
import TaskItem from '@tiptap/extension-task-item'
import { TableKit } from '@tiptap/extension-table'
import Image from '@tiptap/extension-image'
import { ScreenplayElement } from './screenplay'
import type { StoryNode } from '../types'

// Schema extensions needed to render a stored doc (content.doc JSON) back to HTML.
// Must cover every node/mark the editor can produce; ScreenplayElement preserves
// the data-element attribute so screenplay formatting still applies. No
// collaboration extensions — this is static, read-only rendering.
export const DOC_RENDER_EXTENSIONS = [
  StarterKit.configure({ heading: { levels: [1, 2, 3] }, link: { openOnClick: false } }),
  TaskList,
  TaskItem.configure({ nested: true }),
  TableKit,
  Image,
  ScreenplayElement,
]

function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c] as string,
  )
}

// Build a standalone, print-ready HTML document for the browser's Save-as-PDF.
export function buildPrintHtml(title: string, bodyHtml: string, isScript: boolean): string {
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

// Print via a hidden iframe rather than window.open — no popup blocker, and it
// works on insecure/LAN contexts too.
export function printHtml(html: string): void {
  const iframe = document.createElement('iframe')
  iframe.setAttribute('aria-hidden', 'true')
  iframe.style.cssText = 'position:fixed;right:0;bottom:0;width:0;height:0;border:0;'
  document.body.appendChild(iframe)
  const win = iframe.contentWindow
  if (!win) {
    iframe.remove()
    return
  }
  win.document.open()
  win.document.write(html)
  win.document.close()
  const cleanup = () => iframe.remove()
  win.onafterprint = cleanup
  window.setTimeout(() => {
    win.focus()
    win.print()
  }, 350)
  window.setTimeout(cleanup, 60000) // fallback if afterprint never fires
}

// Render a stored doc node's content (content.doc JSON) to HTML.
export function docNodeToHtml(node: StoryNode): string {
  const doc = (node.content as { doc?: unknown } | undefined)?.doc
  if (!doc || typeof doc !== 'object') return ''
  try {
    return generateHTML(doc as Record<string, unknown>, DOC_RENDER_EXTENSIONS)
  } catch {
    return ''
  }
}

// Export a stored doc node straight to the print/Save-as-PDF dialog, without
// opening the editor. Honors the node's screenplay vs document mode.
export function exportDocNodePdf(node: StoryNode): void {
  const mode = (node.content as { mode?: string } | undefined)?.mode
  const title = node.title?.trim() || 'Untitled document'
  printHtml(buildPrintHtml(title, docNodeToHtml(node), mode === 'script'))
}
