import { useState } from 'react'
import { captureImageUrl, type CaptureRow } from '../lib/supabase'

function formatTime(iso: string) {
  return new Date(iso).toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  })
}

type StripGalleryProps = {
  strips: CaptureRow[]
  printingId: string | null
  onReprint: (row: CaptureRow) => void
}

export function StripGallery({ strips, printingId, onReprint }: StripGalleryProps) {
  const [preview, setPreview] = useState<CaptureRow | null>(null)

  if (!strips.length) {
    return <p className="muted">No strips saved yet. Capture on iPad/phone to add some.</p>
  }

  return (
    <>
      <div className="gallery-grid">
        {strips.map((row) => {
          const url = captureImageUrl(row)
          return (
            <article key={row.id} className="gallery-card">
              <button
                type="button"
                className="gallery-thumb-btn"
                onClick={() => url && setPreview(row)}
                disabled={!url}
              >
                {url ? (
                  <img src={url} alt="" className="gallery-thumb" />
                ) : (
                  <span className="gallery-missing">No image</span>
                )}
              </button>
              <div className="gallery-meta">
                <time dateTime={row.created_at}>{formatTime(row.created_at)}</time>
                <span className={`status-badge status-${row.status}`}>{row.status}</span>
              </div>
              <button
                type="button"
                className="booth-btn booth-btn-small"
                disabled={!url || printingId === row.id}
                onClick={() => onReprint(row)}
              >
                {printingId === row.id ? 'Printing…' : 'Re-print'}
              </button>
            </article>
          )
        })}
      </div>

      {preview && captureImageUrl(preview) && (
        <div
          className="gallery-modal"
          role="dialog"
          aria-modal="true"
          onClick={() => setPreview(null)}
          onKeyDown={(e) => e.key === 'Escape' && setPreview(null)}
        >
          <div className="gallery-modal-inner" onClick={(e) => e.stopPropagation()}>
            <img src={captureImageUrl(preview)!} alt="" className="gallery-modal-img" />
            <p className="muted">{formatTime(preview.created_at)}</p>
            <div className="btn-row center">
              <button
                type="button"
                className="booth-btn"
                disabled={printingId === preview.id}
                onClick={() => onReprint(preview)}
              >
                Re-print
              </button>
              <button type="button" className="booth-btn" onClick={() => setPreview(null)}>
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
