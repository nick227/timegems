import { useNavigate } from 'react-router-dom'
import { FileQuestion } from 'lucide-react'
import { Button } from '@/components/ui/Button'

export function NotFoundRoute() {
  const navigate = useNavigate()

  return (
    <div className="min-h-[calc(100vh-3.5rem)] flex flex-col items-center justify-center gap-3 px-4 text-center">
      <FileQuestion size={32} className="text-muted-foreground" />
      <h1 className="text-xl font-semibold">Page not found</h1>
      <p className="max-w-xs text-sm text-muted-foreground">
        This link may be outdated, or the page may have moved.
      </p>
      <Button variant="outline" size="sm" onClick={() => navigate('/')}>
        Return to Work
      </Button>
    </div>
  )
}
