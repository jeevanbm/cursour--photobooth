type ConfirmDialogProps = {
  open: boolean
  title: string
  message: string
  confirmLabel?: string
  cancelLabel?: string
  variant?: 'danger' | 'default'
  loading?: boolean
  onConfirm: () => void
  onCancel: () => void
}

export function ConfirmDialog({
  open,
  title,
  message,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  variant = 'default',
  loading,
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  if (!open) return null

  return (
    <div
      className="modal-backdrop"
      role="dialog"
      aria-modal="true"
      aria-labelledby="confirm-title"
      onClick={onCancel}
      onKeyDown={(e) => e.key === 'Escape' && onCancel()}
    >
      <div className="modal-card" onClick={(e) => e.stopPropagation()}>
        <h3 id="confirm-title" className="modal-title">
          {title}
        </h3>
        <p className="modal-message">{message}</p>
        <div className="modal-actions">
          <button type="button" className="booth-btn booth-btn-ghost" disabled={loading} onClick={onCancel}>
            {cancelLabel}
          </button>
          <button
            type="button"
            className={`booth-btn ${variant === 'danger' ? 'booth-btn-danger' : 'booth-btn-primary'}`}
            disabled={loading}
            onClick={onConfirm}
          >
            {loading ? 'Please wait…' : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  )
}
