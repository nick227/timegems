interface LoadMoreButtonProps {
  hasNextPage?: boolean
  isFetchingNextPage: boolean
  onClick: () => void
}

export function LoadMoreButton({ hasNextPage, isFetchingNextPage, onClick }: LoadMoreButtonProps) {
  if (!hasNextPage) return null
  return (
    <button
      onClick={onClick}
      disabled={isFetchingNextPage}
      className="w-full py-3 text-sm text-muted-foreground hover:text-foreground transition-colors disabled:opacity-50"
    >
      {isFetchingNextPage ? 'Loading...' : 'Load more'}
    </button>
  )
}
