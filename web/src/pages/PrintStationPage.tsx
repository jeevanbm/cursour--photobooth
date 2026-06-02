import { useCallback, useEffect, useRef, useState } from 'react'
import { StripGallery } from '../components/StripGallery'
import {
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
  const processingRef = useRef(false)

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

  return (
    <div className="page station-page">
      <header className="site-header">
        <div>
          <h1>Print station</h1>
          <p className="muted">Strips are saved to Supabase · re-print anytime</p>
        </div>
        <span className={`status-pill ${serverOk ? 'ok' : 'bad'}`}>
          {serverOk === null ? 'Checking printer…' : serverOk ? 'Printer online' : 'Printer offline'}
        </span>
      </header>

      <section className="station-panel station-toolbar">
        <label className="auto-print-toggle">
          <input type="checkbox" checked={autoPrint} onChange={toggleAutoPrint} />
          Auto-print new strips
        </label>
        <button type="button" className="booth-btn" onClick={() => void refreshAll()}>
          Refresh
        </button>
      </section>

      <section className="station-panel">
        <h2>Print queue ({queue.length})</h2>
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
                className="booth-btn"
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

      <section className="station-panel">
        <h2>Saved strips ({gallery.length})</h2>
        <p className="muted">Every strip is stored. Tap to preview, or re-print any time.</p>
        <StripGallery
          strips={gallery}
          printingId={processing}
          onReprint={(row) => void printCapture(row)}
        />
      </section>

      <section className="station-panel">
        <h2>Log</h2>
        <ul className="log-list">
          {log.map((line) => (
            <li key={line}>{line}</li>
          ))}
        </ul>
      </section>
    </div>
  )
}
