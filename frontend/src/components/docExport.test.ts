import { describe, it, expect } from 'vitest'
import { docNodeToHtml } from './docExport'
import type { StoryNode } from '../types'

// A Document-mode font choice is stored as a TextStyle fontFamily mark; the export
// / card-preview render path must carry it through to HTML (DOC_RENDER_EXTENSIONS
// has to include TextStyle + FontFamily).
describe('docExport font marks', () => {
  it('renders a font-family choice into the exported HTML', () => {
    const node = {
      content: {
        doc: {
          type: 'doc',
          content: [
            {
              type: 'paragraph',
              content: [
                {
                  type: 'text',
                  marks: [{ type: 'textStyle', attrs: { fontFamily: 'Georgia, serif' } }],
                  text: 'Fancy',
                },
                { type: 'text', text: ' plain' },
              ],
            },
          ],
        },
      },
    } as unknown as StoryNode

    const html = docNodeToHtml(node)
    expect(html).toMatch(/font-family/i)
    expect(html).toContain('Georgia')
    expect(html).toContain('plain')
  })
})
