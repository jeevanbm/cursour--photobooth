import { useCallback, useEffect, useRef, useState } from 'react'
import { AppShell } from '../components/AppShell'
import { StripGallery } from '../components/StripGallery'
import {
  deleteCapture,
  fetchCaptureHistory,
  fetchPendingCaptures,
  markCaptureStatus,
} from '../lib/captures'
import { resizeStripForPrint, sendToLocalPrinter } from '../lib/print'
import { captureImageUrl, supabase, type CaptureRow } from '../lib/supabase'
import { PRINT_SERVER_URL } from '../config/booth'

const AUTO_PRINT_KEY = 'photobooth-auto-print'

function loadAutoPrintPreference(): boolean {
  const stored = localStorage.getItem(AUTO_PRINT_KEY)
  if (stored === 'false') return false
  return true
}

export function PrintStationPage() {
  const [queue, setQueue] = useState<CaptureRow[]>([])
  const [gallery, setGallery] = useState<CaptureRow[]>([])
  const [processing, setProcessing] = useState<string | null>(null)
  const [serverOk, setServerOk] = useState<boolean | null>(null)
  const [log, setLog] = useState<string[]>([])
  const [autoPrint, setAutoPrint] = useState(loadAutoPrintPreference)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const processingRef = useRef(false)

  const stats = {
    total: gallery.length,
    printed: gallery.filter((r) => r.status === 'printed').length,
    pending: gallery.filter((r) => r.status === 'pending').length,
    failed: gallery.filter((r) => r.status === 'failed').length,
  }

  const appendLog = (msg: string) =>
    setLog((l) => [`${new Date().toLocaleTimeString()} — ${msg}`, ...l].slice(0, 20))

  const refreshGallery = useCallback(async () => {
    try {
      const rows = await fetchCaptureHistory()
      setGallery(rows)
    } catch (e) {
      appendLog(e instanceof Error ? e.message : 'Gallery refresh failed')
    }
  }, [])

  const refreshQueue = useCallback(async () => {
    try {
      const rows = await fetchPendingCaptures()
      setQueue(rows)
    } catch (e) {
      appendLog(e instanceof Error ? e.message : 'Queue refresh failed')
    }
  }, [])

  const refreshAll = useCallback(async () => {
    await Promise.all([refreshQueue(), refreshGallery()])
  }, [refreshQueue, refreshGallery])

  useEffect(() => {
    void refreshAll()
    fetch(`${PRINT_SERVER_URL}/health`)
      .then((r) => setServerOk(r.ok))
      .catch(() => setServerOk(false))
  }, [refreshAll])

  useEffect(() => {
    localStorage.setItem(AUTO_PRINT_KEY, autoPrint ? 'true' : 'false')
  }, [autoPrint])

  useEffect(() => {
    const channel = supabase
      .channel('print-station')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'captures' },
        (payload) => {
          const row = payload.new as CaptureRow
          setGallery((g) => [row, ...g.filter((r) => r.id !== row.id)])
          if (row.status === 'pending') {
            setQueue((q) => [...q, row])
            appendLog(`Saved ${row.id.slice(0, 8)}`)
          }
        },
      )
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'captures' },
        (payload) => {
          const row = payload.new as CaptureRow
          setGallery((g) => g.map((r) => (r.id === row.id ? row : r)))
          if (row.status !== 'pending') {
            setQueue((q) => q.filter((r) => r.id !== row.id))
          }
        },
      )
      .on(
        'postgres_changes',
        { event: 'DELETE', schema: 'public', table: 'captures' },
        (payload) => {
          const row = payload.old as CaptureRow
          setGallery((g) => g.filter((r) => r.id !== row.id))
          setQueue((q) => q.filter((r) => r.id !== row.id))
        },
      )
      .subscribe()

    return () => {
      void supabase.removeChannel(channel)
    }
  }, [])

  const printCapture = useCallback(
    async (row: CaptureRow, options: { fromQueue?: boolean } = {}) => {
      const imageUrl = captureImageUrl(row)
      if (!imageUrl) {
        appendLog(`Missing image URL for ${row.id}`)
        return
      }
      if (processingRef.current) return
      processingRef.current = true
      setProcessing(row.id)
      try {
        if (row.status === 'pending') {
          await markCaptureStatus(row.id, 'printing')
        }
        const blob = await resizeStripForPrint(imageUrl)
        await sendToLocalPrinter(blob, row.id)
        await markCaptureStatus(row.id, 'printed')
        setQueue((q) => q.filter((r) => r.id !== row.id))
        setGallery((g) =>
          g.map((r) =>
            r.id === row.id
              ? { ...r, status: 'printed', printed_at: new Date().toISOString() }
              : r,
          ),
        )
        appendLog(
          options.fromQueue
            ? `Printed ${row.id.slice(0, 8)}`
            : `Re-printed ${row.id.slice(0, 8)}`,
        )
      } catch (e) {
        const msg = e instanceof Error ? e.message : 'Print failed'
        await markCaptureStatus(row.id, 'failed', msg)
        setQueue((q) => q.filter((r) => r.id !== row.id))
        appendLog(`Failed: ${msg}`)
        void refreshGallery()
      } finally {
        processingRef.current = false
        setProcessing(null)
      }
    },
    [refreshGallery],
  )

  useEffect(() => {
    if (!autoPrint || processing || !queue.length || serverOk === false) return
    void printCapture(queue[0], { fromQueue: true })
  }, [queue, processing, serverOk, autoPrint, printCapture])

  const toggleAutoPrint = () => {
    setAutoPrint((v) => {
      appendLog(v ? 'Auto-print off — print from gallery' : 'Auto-print on')
      return !v
    })
  }

  const handleDelete = useCallback(
    async (row: CaptureRow) => {
      setDeletingId(row.id)
      try {
        await deleteCapture(row)
        setGallery((g) => g.filter((r) => r.id !== row.id))
        setQueue((q) => q.filter((r) => r.id !== row.id))
        appendLog(`Deleted ${row.id.slice(0, 8)}`)
      } catch (e) {
        appendLog(e instanceof Error ? e.message : 'Delete failed')
        throw e
      } finally {
        setDeletingId(null)
      }
    },
    [],
  )

  const printerLabel =
    serverOk === null ? 'Checking…' : serverOk ? 'Printer online' : 'Printer offline'

  return (
    <AppShell
      badge="Laptop · DNP 2×6"
      title="Print station"
      subtitle="Queue, archive, and re-print every strip from your event."
    >
      <div className="station-header-row">
        <span className={`status-pill ${serverOk ? 'ok' : serverOk === false ? 'bad' : ''}`}>
          {printerLabel}
        </span>
      </div>

      <div className="stats-grid">
        <div className="stat-card">
          <span className="stat-value">{stats.total}</span>
          <span className="stat-label">Total saved</span>
        </div>
        <div className="stat-card">
          <span className="stat-value">{stats.printed}</span>
          <span className="stat-label">Printed</span>
        </div>
        <div className="stat-card">
          <span className="stat-value">{stats.pending}</span>
          <span className="stat-label">Pending</span>
        </div>
        <div className="stat-card">
          <span className="stat-value">{stats.failed}</span>
          <span className="stat-label">Failed</span>
        </div>
      </div>

      <section className="panel station-toolbar">
        <label className="auto-print-toggle">
          <input type="checkbox" checked={autoPrint} onChange={toggleAutoPrint} />
          Auto-print new strips
        </label>
        <button type="button" className="booth-btn booth-btn-secondary" onClick={() => void refreshAll()}>
          Refresh
        </button>
      </section>

      <section className="panel">
        <h2 className="section-title">Print queue <span className="count">({queue.length})</span></h2>
        {!autoPrint && (
          <p className="muted">Auto-print is off. New strips appear in the gallery — print from there.</p>
        )}
        {processing && <p className="muted">Printing {processing.slice(0, 8)}…</p>}
        <ul className="queue-list">
          {queue.map((row) => (
            <li key={row.id}>
              {captureImageUrl(row) && (
                <img src={captureImageUrl(row)!} alt="" className="queue-thumb" />
              )}
              <span>{row.id.slice(0, 8)}</span>
              <button
                type="button"
                className="booth-btn booth-btn-secondary"
                disabled={!!processing}
                onClick={() => printCapture(row, { fromQueue: true })}
              >
                Print now
              </button>
            </li>
          ))}
        </ul>
        {!queue.length && autoPrint && (
          <p className="muted">Waiting for new strips from capture device…</p>
        )}
      </section>

      <section className="panel">
        <h2 className="section-title">Saved strips <span className="count">({gallery.length})</span></h2>
        <p className="section-desc">Every strip is stored. Tap to preview, or re-print any time.</p>
        <StripGallery
          strips={gallery}
          printingId={processing}
          deletingId={deletingId}
          onReprint={(row) => void printCapture(row)}
          onDelete={handleDelete}
        />
      </section>

      <section className="panel panel-log">
        <h2 className="section-title">Activity log</h2>
        <ul className="log-list">
          {log.map((line) => (
            <li key={line}>{line}</li>
          ))}
        </ul>
      </section>
    </AppShell>
  )
}
