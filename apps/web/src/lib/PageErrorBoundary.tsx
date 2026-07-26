import { Component, type ReactNode } from 'react'
import { EmptyState } from '@/components/ui/EmptyState'
import { AlertTriangle } from 'lucide-react'

export class PageErrorBoundary extends Component<{ children: ReactNode }, { error: Error | null }> {
  state = { error: null }
  static getDerivedStateFromError(error: Error) {
    return { error }
  }
  render() {
    if (this.state.error) {
      return (
        <EmptyState
          icon={AlertTriangle}
          title="Something went wrong"
          description="Try refreshing the page."
          action={{ label: 'Refresh', onClick: () => window.location.reload() }}
        />
      )
    }
    return this.props.children
  }
}
