import { useState } from 'react'
import { useTimeSummary, useTeams } from '@timegems/sdk'
import { Card, CardContent } from '@/components/ui/Card'
import { Skeleton } from '@/components/ui/Skeleton'
import { EmptyState } from '@/components/ui/EmptyState'
import { cn } from '@/lib/utils'
import { BarChart3 } from 'lucide-react'

type Period = 'day' | 'month' | 'year'
type Scope = 'individual' | 'team'

function todayISO() {
  return new Date().toISOString().slice(0, 10)
}

function formatDuration(totalSeconds: number) {
  const h = Math.floor(totalSeconds / 3600)
  const m = Math.floor((totalSeconds % 3600) / 60)
  if (h === 0) return `${m}m`
  return `${h}h ${m}m`
}

const PERIODS: { value: Period; label: string }[] = [
  { value: 'day', label: 'Daily' },
  { value: 'month', label: 'Monthly' },
  { value: 'year', label: 'Yearly' },
]

export function ViewsPage() {
  const [period, setPeriod] = useState<Period>('day')
  const [scope, setScope] = useState<Scope>('individual')
  const [teamId, setTeamId] = useState<string | undefined>(undefined)
  const { data: teamsData } = useTeams()
  const teams = teamsData?.pages.flatMap((p) => p.data) ?? []

  const { data, isLoading } = useTimeSummary({ period, date: todayISO(), scope, teamId })

  return (
    <div className="max-w-xl mx-auto px-4 py-6 space-y-4">
      <h1 className="text-xl font-semibold">Views</h1>

      <div className="flex gap-1 rounded-lg bg-surface p-1 w-fit">
        {PERIODS.map((p) => (
          <button
            key={p.value}
            onClick={() => setPeriod(p.value)}
            className={cn(
              'px-3 py-1.5 rounded text-sm font-medium transition-colors',
              period === p.value ? 'bg-accent text-accent-foreground' : 'text-muted-foreground hover:text-foreground',
            )}
          >
            {p.label}
          </button>
        ))}
      </div>

      <div className="flex gap-1 rounded-lg bg-surface p-1 w-fit">
        <button
          onClick={() => setScope('individual')}
          className={cn(
            'px-3 py-1.5 rounded text-sm font-medium transition-colors',
            scope === 'individual' ? 'bg-accent text-accent-foreground' : 'text-muted-foreground hover:text-foreground',
          )}
        >
          You
        </button>
        <button
          onClick={() => setScope('team')}
          className={cn(
            'px-3 py-1.5 rounded text-sm font-medium transition-colors',
            scope === 'team' ? 'bg-accent text-accent-foreground' : 'text-muted-foreground hover:text-foreground',
          )}
        >
          Team
        </button>
      </div>

      {scope === 'team' && (
        <div className="flex flex-wrap gap-2">
          {teams.map((team: any) => (
            <button
              key={team.id}
              onClick={() => setTeamId(team.id)}
              className={cn(
                'px-3 py-1 rounded-full text-sm border transition-colors',
                teamId === team.id ? 'bg-accent text-accent-foreground border-accent' : 'border-border text-muted-foreground',
              )}
            >
              {team.name}
            </button>
          ))}
        </div>
      )}

      {scope === 'team' && !teamId ? (
        <EmptyState icon={BarChart3} title="Pick a team" description="Select a team above to see its rollup." />
      ) : isLoading ? (
        <Skeleton className="h-40 w-full" />
      ) : !data?.data || data.data.entries.length === 0 ? (
        <EmptyState icon={BarChart3} title="Nothing tracked yet" description="Stopped sessions in this period will show up here." />
      ) : (
        <div className="space-y-2">
          <p className="text-sm text-muted-foreground">
            Total: <span className="font-medium text-foreground">{formatDuration(data.data.totalDurationSec)}</span>
          </p>
          {data.data.entries.map((entry: any, i: number) => (
            <Card key={i}>
              <CardContent className="py-3 flex items-center justify-between">
                <span className="text-sm font-medium">{entry.projectName ?? 'No project'}</span>
                <span className="text-sm text-muted-foreground">{formatDuration(entry.durationSec)}</span>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}
