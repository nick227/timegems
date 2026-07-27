import type { components } from '@timegems/sdk'
import { Button } from '@/components/ui/Button'
import { RichTextView } from '@/components/ui/RichTextView'
import { ComplexityPicker } from './ComplexityPicker'
import { GOAL_STATUS_LABEL } from '../lib/statusLabel'

type Goal = components['schemas']['Goal']

interface GoalCardProps {
  goal: Goal
  projectName?: string | null
  onUpdateStatus: (status: Goal['status']) => void
  onNudgeProgress: (delta: number) => void
  updating: boolean
}

function hours(sec: number) {
  return Math.round((sec / 3600) * 10) / 10
}

export function GoalCard({ goal, projectName, onUpdateStatus, onNudgeProgress, updating }: GoalCardProps) {
  const loggedHours = hours(goal.loggedSec ?? 0)
  const progressPercent = goal.progressPercent ?? 0

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between gap-2">
        <p className="text-sm font-medium">{goal.title}</p>
        <span className="text-xs uppercase text-muted-foreground shrink-0">{GOAL_STATUS_LABEL[goal.status]}</span>
      </div>

      {projectName && <p className="text-xs text-muted-foreground">{projectName}</p>}

      <RichTextView html={goal.description} className="text-sm text-muted-foreground" />

      <div className="flex items-center gap-3 text-xs text-muted-foreground">
        <ComplexityPicker value={goal.complexityScore} size="sm" />
        <span>
          {loggedHours}h logged{goal.estimatedHours != null ? ` / ${goal.estimatedHours}h estimated` : ''}
        </span>
      </div>

      {(goal.status === 'ACTIVE' || goal.status === 'DONE') && (
        <div className="space-y-1">
          <div className="h-2 w-full rounded-full bg-muted overflow-hidden">
            <div
              className="h-full rounded-full bg-foreground transition-all"
              style={{ width: `${Math.min(100, progressPercent)}%` }}
            />
          </div>
          <p className="text-xs text-muted-foreground">{progressPercent}% complete</p>
        </div>
      )}

      <div className="flex flex-wrap gap-2 pt-1">
        {goal.status === 'PROPOSED' && (
          <>
            <Button size="sm" loading={updating} onClick={() => onUpdateStatus('ACTIVE')}>
              Approve
            </Button>
            <Button size="sm" variant="outline" loading={updating} onClick={() => onUpdateStatus('DROPPED')}>
              Drop
            </Button>
          </>
        )}
        {goal.status === 'ACTIVE' && (
          <>
            <Button size="sm" variant="outline" loading={updating} disabled={progressPercent <= 0} onClick={() => onNudgeProgress(-10)}>
              -10%
            </Button>
            <Button size="sm" variant="outline" loading={updating} disabled={progressPercent >= 100} onClick={() => onNudgeProgress(10)}>
              +10%
            </Button>
            <Button size="sm" variant="outline" loading={updating} onClick={() => onUpdateStatus('DONE')}>
              Mark done
            </Button>
          </>
        )}
      </div>
    </div>
  )
}
