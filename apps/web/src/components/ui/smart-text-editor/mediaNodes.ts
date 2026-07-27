import { Node, mergeAttributes } from '@tiptap/core'

// No official Tiptap extension covers video/audio (only @tiptap/extension-image
// does) -- these are small custom Node extensions following Tiptap's
// documented custom-node pattern, just enough to embed a src URL with
// native browser controls. One factory, not one hand-copied Node.create()
// per tag: adding a further embeddable media tag later (unlikely, but e.g.
// an <iframe>-based embed) is a one-line call, not a 14-line copy-paste.
function createMediaNode(tag: 'video' | 'audio') {
  return Node.create({
    name: tag,
    group: 'block',
    atom: true,
    addAttributes() {
      return { src: { default: null } }
    },
    parseHTML() {
      return [{ tag }]
    },
    renderHTML({ HTMLAttributes }) {
      return [tag, mergeAttributes(HTMLAttributes, { controls: '' })]
    },
  })
}

export const Video = createMediaNode('video')
export const Audio = createMediaNode('audio')
