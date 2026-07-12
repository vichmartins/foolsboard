// Scene Navigator for screenplay mode: a left panel listing every scene heading in
// the document. Click one to jump to it; the scene the caret is in is highlighted.
// Re-reads the doc on every change so it stays in sync.
import { useEffect, useState } from 'react'
import type { Editor } from '@tiptap/react'

interface Props {
  editor: Editor
  onClose: () => void
}

interface SceneRef {
  pos: number // position of the scene paragraph node
  text: string
  num: number
}

export default function ScreenplayNavigator({ editor, onClose }: Props) {
  const [, force] = useState(0)
  useEffect(() => {
    const bump = () => force((n) => n + 1)
    editor.on('update', bump)
    editor.on('selectionUpdate', bump)
    return () => {
      editor.off('update', bump)
      editor.off('selectionUpdate', bump)
    }
  }, [editor])

  const scenes: SceneRef[] = []
  editor.state.doc.descendants((node, pos) => {
    if (node.type.name === 'paragraph' && node.attrs.element === 'scene') {
      scenes.push({ pos, text: node.textContent.trim() || 'Untitled scene', num: scenes.length + 1 })
    }
    return true
  })

  // The scene the caret currently sits in (the last one at or before the selection).
  const from = editor.state.selection.from
  let activeIdx = -1
  scenes.forEach((s, i) => {
    if (s.pos <= from) activeIdx = i
  })

  const jump = (pos: number) => {
    editor
      .chain()
      .focus()
      .setTextSelection(pos + 1) // inside the scene paragraph
      .scrollIntoView()
      .run()
  }

  return (
    <div className="scene-nav">
      <div className="scene-nav__head">
        <span className="scene-nav__title">Scenes</span>
        <span className="scene-nav__count">{scenes.length}</span>
        <button className="scene-nav__close" onClick={onClose} title="Hide scene navigator" aria-label="Hide">
          ×
        </button>
      </div>
      {scenes.length === 0 ? (
        <div className="scene-nav__empty">
          No scenes yet. Start a line with a <b>Scene</b> heading (Ctrl+1) to see it here.
        </div>
      ) : (
        <ul className="scene-nav__list">
          {scenes.map((s, i) => (
            <li key={s.pos}>
              <button
                type="button"
                className={'scene-nav__item' + (i === activeIdx ? ' scene-nav__item--active' : '')}
                onClick={() => jump(s.pos)}
                title={s.text}
              >
                <span className="scene-nav__num">{s.num}</span>
                <span className="scene-nav__text">{s.text}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
