// Owned by the goals feature -- this is the one file formatting Goal
// status, not a shared cross-domain lookup (report type and presence
// status each have their own owning feature's label map instead).
export const GOAL_STATUS_LABEL: Record<string, string> = {
  PROPOSED: 'Proposed',
  ACTIVE: 'Active',
  DONE: 'Done',
  DROPPED: 'Dropped',
}
