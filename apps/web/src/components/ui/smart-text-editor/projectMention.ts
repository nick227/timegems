import { getApiClient } from '@timegems/sdk'
import { createLinkMention } from './createLinkMention'
import type { MentionItem } from './MentionList'

async function fetchProjectMentions(query: string): Promise<MentionItem[]> {
  if (!query.trim()) return []
  const { data } = await getApiClient().GET('/projects', {
    params: { query: { q: query, limit: 5 } },
  })
  return (data?.data ?? []).map((project) => ({ id: project.id, label: project.name }))
}

// `#project-name` -> a real link to that project's page. Uses the SDK client
// directly (not the `useProjects` hook) since this runs inside a ProseMirror
// plugin callback, outside React's render tree.
export const projectMention = createLinkMention({
  name: 'projectMention',
  char: '#',
  fetchItems: fetchProjectMentions,
  buildHref: (item) => `/projects/${item.id}`,
})
