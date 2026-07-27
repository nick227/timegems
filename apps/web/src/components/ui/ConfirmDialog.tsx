import { Dialog } from './Dialog'
import { Button } from './Button'

interface ConfirmDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  title: string
  description?: string
  confirmLabel?: string
  cancelLabel?: string
  destructive?: boolean
  loading?: boolean
  onConfirm: () => void
}

export function ConfirmDialog({
  open,
  onOpenChange,
  title,
  description,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  destructive = false,
  loading = false,
  onConfirm,
}: ConfirmDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange} title={title} description={description}>
      <div className="flex justify-end gap-2 pt-1">
        <Button size="sm" variant="ghost" onClick={() => onOpenChange(false)}>
          {cancelLabel}
        </Button>
        <Button size="sm" variant={destructive ? 'destructive' : 'default'} loading={loading} onClick={onConfirm}>
          {confirmLabel}
        </Button>
      </div>
    </Dialog>
  )
}
