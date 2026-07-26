import { QueryClient, MutationCache } from '@tanstack/react-query'
import { toast } from 'sonner'

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: { retry: 1, staleTime: 30_000 },
  },
  // Global fallback so no mutation ever fails silently. Individual mutations
  // can still show their own toast.success() for positive confirmation, or
  // pass their own onError to override this message for a specific case.
  mutationCache: new MutationCache({
    onError: (error) => {
      toast.error(error instanceof Error ? error.message : 'Something went wrong')
    },
  }),
})
