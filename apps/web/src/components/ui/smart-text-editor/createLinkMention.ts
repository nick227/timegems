import { Extension } from '@tiptap/core'
import { ReactRenderer } from '@tiptap/react'
import { PluginKey } from '@tiptap/pm/state'
import type { EditorView } from '@tiptap/pm/view'
import Suggestion from '@tiptap/suggestion'
import { MentionList, type MentionItem, type MentionListHandle } from './MentionList'

interface CreateLinkMentionOptions {
  /** Unique extension name (also used as the plugin key). */
  name: string
  /** Trigger character, e.g. '#' for projects, '@' for people. */
  char: string
  /** Live-search fetcher; called (debounced) as the user types after the trigger char. */
  fetchItems: (query: string) => Promise<MentionItem[]>
  /** Builds the target route for the selected item, e.g. `/projects/${id}`. */
  buildHref: (item: MentionItem) => string
}

/**
 * Mentions render as real hyperlinks (a text run with a `link` mark),
 * not a custom "mention chip" node -- that's what "autofill as hyperlinks"
 * actually asked for, and it means mentioned text stays plain, copyable,
 * editable text rather than an opaque atomic node.
 *
 * Built directly on the lower-level `@tiptap/suggestion` utility rather
 * than `@tiptap/extension-mention`'s Node type, since we don't want its
 * node-based rendering/serialization -- just the trigger-char/live-search/
 * popup behavior, applied as a plain ProseMirror plugin.
 */
export function createLinkMention({ name, char, fetchItems, buildHref }: CreateLinkMentionOptions) {
  // Each mention trigger (project '#', people '@') needs its own plugin key --
  // ProseMirror rejects two plugins that share one when both are active in
  // the same editor at once. Exposed on the returned extension (below) so
  // SmartTextEditor's own Enter-key handling can check whether a suggestion
  // popup is currently open before treating Enter as "submit".
  const pluginKey = new PluginKey(name)

  // The Suggestion plugin's own handleKeyDown (confirms the highlighted
  // popup item on Enter) is just one more ProseMirror plugin prop, while
  // SmartTextEditor's Enter-to-submit is registered as a *direct* EditorView
  // prop, which ProseMirror always checks before any plugin's props --
  // deferring (returning false) from there isn't enough on its own, because
  // plugin resolution order isn't guaranteed to reach this Suggestion
  // plugin before, say, StarterKit's own base Enter keymap (which would
  // just insert a newline and swallow the event first). So this plugin's
  // handleKeyDown is captured here and called *directly* from
  // SmartTextEditor when a suggestion popup is active, bypassing plugin
  // order entirely instead of hoping for the right resolution order.
  let handleSuggestionKeyDown: (view: EditorView, event: KeyboardEvent) => boolean = () => false

  const extension = Extension.create({
    name,

    addProseMirrorPlugins() {
      const plugin = Suggestion({
        editor: this.editor,
        char,
        pluginKey,
        debounce: 200,
        items: ({ query }) => fetchItems(query),
        command: ({ editor, range, props }) => {
          const item = props as MentionItem
          editor
            .chain()
            .focus()
            .insertContentAt(range, [
              { type: 'text', marks: [{ type: 'link', attrs: { href: buildHref(item) } }], text: item.label },
              { type: 'text', text: ' ' },
            ])
            .run()
        },
        render: () => {
          let component: ReactRenderer<MentionListHandle> | undefined
          let unmount: (() => void) | undefined

          return {
            onStart: (props) => {
              component = new ReactRenderer(MentionList, { props, editor: props.editor })
              unmount = props.mount?.(component.element as HTMLElement)
            },
            onUpdate: (props) => {
              component?.updateProps(props)
            },
            onKeyDown: (props) => {
              if (props.event.key === 'Escape') {
                unmount?.()
                return true
              }
              return component?.ref?.onKeyDown(props) ?? false
            },
            onExit: () => {
              unmount?.()
              component?.destroy()
            },
          }
        },
      })

      handleSuggestionKeyDown = (view, event) => plugin.props.handleKeyDown?.call(plugin, view, event) === true

      return [plugin]
    },
  })

  return Object.assign(extension, { pluginKey, handleSuggestionKeyDown: (view: EditorView, event: KeyboardEvent) => handleSuggestionKeyDown(view, event) })
}
