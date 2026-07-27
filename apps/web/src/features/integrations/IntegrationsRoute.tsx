import { Card, CardContent } from '@/components/ui/Card'
import { PageHeader } from '@/components/ui/PageHeader'
import { CheckCircle2, Circle } from 'lucide-react'

// V1 has no dedicated /integrations endpoint -- Google is connected by
// definition (it's the only auth method), and Discord/GitHub/Google Docs
// cross-posting are V2 (see docs/roadmap.md). This page is an honest static
// status display, not a stub -- there's nothing to fetch yet.
export function IntegrationsRoute() {
  return (
    <div className="max-w-xl mx-auto px-4 py-6 space-y-3">
      <PageHeader title="Integrations" />

      <Card>
        <CardContent className="py-3 flex items-center gap-3">
          <CheckCircle2 size={18} className="text-primary" />
          <div>
            <p className="text-sm font-medium">Google</p>
            <p className="text-xs text-muted-foreground">Connected — this is how you signed in</p>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="py-3 flex items-center gap-3">
          <Circle size={18} className="text-muted-foreground" />
          <div>
            <p className="text-sm font-medium">Discord</p>
            <p className="text-xs text-muted-foreground">Not connected — coming in V2</p>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="py-3 flex items-center gap-3">
          <Circle size={18} className="text-muted-foreground" />
          <div>
            <p className="text-sm font-medium">GitHub</p>
            <p className="text-xs text-muted-foreground">Not connected — coming in V2</p>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
