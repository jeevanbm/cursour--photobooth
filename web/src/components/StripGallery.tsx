import { useMemo, useState } from 'react'
import { captureImageUrl, type CaptureRow } from '../lib/supabase'
import { ConfirmDialog } from './ConfirmDialog'

function formatTime(iso: string) {
  return new Date(iso).toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  })
}

type StatusFilter = 'all' | CaptureRow['status']

type StripGalleryProps = {
  strips: CaptureRow[]
  printingId: string | null
  deletingId: string | null
  onReprint: (row: CaptureRow) => void
  onDelete: (row: CaptureRow) => Promise<void>
}

export function StripGallery({
  strips,
  printingId,
  deletingId,
  onReprint,
  onDelete,
}: StripGalleryProps) {
  const [preview, setPreview] = useState<CaptureRow | null>(null)
  const [query, setQuery] = useState('')
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all')
  const [pendingDelete, setPendingDelete] = useState<CaptureRow | null>(null)

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    return strips.filter((row) => {
      if (statusFilter !== 'all' && row.status !== statusFilter) return false
      if (!q) return true
      return row.id.toLowerCase().includes(q) || row.created_at.includes(q)
    })
  }, [strips, query, statusFilter])

  const handleConfirmDelete = async () => {
    if (!pendingDelete) return
    await onDelete(pendingDelete)
    if (preview?.id === pendingDelete.id) setPreview(null)
    setPendingDelete(null)
  }

  if (!strips.length) {
    return (
      <div className="empty-state">
        <span className="empty-icon" aria-hidden>
          ◫
        </span>
        <p>No strips saved yet</p>
        <p className="muted">Captures from the booth will appear here automatically.</p>
      </div>
    )
  }

  return (
    <>
      <div className="gallery-toolbar">
        <input
          type="search"
          className="input-search"
          placeholder="Search by ID or date…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          aria-label="Search strips"
        />
        <select
          className="input-select"
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value as StatusFilter)}
          aria-label="Filter by status"
        >
          <option value="all">All status</option>
          <option value="pending">Pending</option>
          <option value="printed">Printed</option>
          <option value="printing">Printing</option>
          <option value="failed">Failed</option>
        </select>
        <span className="gallery-count">
          {filtered.length} of {strips.length}
        </span>
      </div>

      {filtered.length === 0 ? (
        <p className="muted">No strips match your filters.</p>
      ) : (
        <div className="gallery-grid">
          {filtered.map((row) => {
            const url = captureImageUrl(row)
            const busy = printingId === row.id || deletingId === row.id
            return (
              <article key={row.id} className={`gallery-card ${busy ? 'is-busy' : ''}`}>
                <button
                  type="button"
                  className="gallery-thumb-btn"
                  onClick={() => url && setPreview(row)}
                  disabled={!url}
                >
                  {url ? (
                    <img src={url} alt="" className="gallery-thumb" loading="lazy" />
                  ) : (
                    <span className="gallery-missing">No image</span>
                  )}
                  <span className="gallery-card-overlay">Preview</span>
                </button>
                <div className="gallery-meta">
                  <code className="gallery-id">{row.id.slice(0, 8)}</code>
                  <time dateTime={row.created_at}>{formatTime(row.created_at)}</time>
                  <span className={`status-badge status-${row.status}`}>{row.status}</span>
                </div>
                <div className="gallery-actions">
                  <button
                    type="button"
                    className="booth-btn booth-btn-primary booth-btn-small"
                    disabled={!url || busy}
                    onClick={() => onReprint(row)}
                  >
                    {printingId === row.id ? 'Printing…' : 'Re-print'}
                  </button>
                  <button
                    type="button"
                    className="booth-btn booth-btn-danger booth-btn-small"
                    disabled={busy}
                    onClick={() => setPendingDelete(row)}
                  >
                    {deletingId === row.id ? 'Deleting…' : 'Delete'}
                  </button>
                </div>
              </article>
            )
          })}
        </div>
      )}

      {preview && captureImageUrl(preview) && (
        <div
          className="gallery-modal"
          role="dialog"
          aria-modal="true"
          onClick={() => setPreview(null)}
          onKeyDown={(e) => e.key === 'Escape' && setPreview(null)}
        >
          <div className="gallery-modal-inner" onClick={(e) => e.stopPropagation()}>
            <button type="button" className="modal-close" onClick={() => setPreview(null)} aria-label="Close">
              ×
            </button>
            <img src={captureImageUrl(preview)!} alt="" className="gallery-modal-img" />
            <div className="gallery-modal-meta">
              <code>{preview.id}</code>
              <span className="muted">{formatTime(preview.created_at)}</span>
            </div>
            <div className="btn-row center">
              <button
                type="button"
                className="booth-btn booth-btn-primary"
                disabled={printingId === preview.id || deletingId === preview.id}
                onClick={() => onReprint(preview)}
              >
                Re-print
              </button>
              <button
                type="button"
                className="booth-btn booth-btn-danger"
                disabled={printingId === preview.id || deletingId === preview.id}
                onClick={() => setPendingDelete(preview)}
              >
                Delete
              </button>
              <button type="button" className="booth-btn booth-btn-ghost" onClick={() => setPreview(null)}>
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      <ConfirmDialog
        open={!!pendingDelete}
        title="Delete this strip?"
        message="This removes the image from storage permanently. You cannot undo this action."
        confirmLabel="Delete strip"
        variant="danger"
        loading={!!deletingId}
        onConfirm={() => void handleConfirmDelete()}
        onCancel={() => setPendingDelete(null)}
      />
    </>
  )
}
