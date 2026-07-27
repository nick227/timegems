import { getApiClient } from '@timegems/sdk'
import { createLinkMention } from './createLinkMention'
import type { MentionItem } from './MentionList'

async function fetchPeopleMentions(teamId: string, query: string): Promise<MentionItem[]> {
  if (!query.trim()) return []
  const { data } = await getApiClient().GET('/teams/{teamId}/members', {
    params: { path: { teamId }, query: { q: query, limit: 5 } },
  })
  return (data?.data ?? []).map((user) => ({ id: user.id, label: user.name }))
}

// `@name` -> a real link to that person's page, scoped to the given team.
// There's no "list all tenant members" endpoint (only team-scoped or
// platform-admin-scoped) -- V1 only offers people-mentions when the current
// context has a team (e.g. the note's project belongs to one); no team
// means no people-mention suggestions, a disclosed limitation rather than
// a new "all tenant members" endpoint duplicating the team-membership model.
export function createPeopleMention(teamId: string) {
  return createLinkMention({
    name: 'peopleMention',
    char: '@',
    fetchItems: (query) => fetchPeopleMentions(teamId, query),
    buildHref: (item) => `/users/${item.id}`,
  })
}
