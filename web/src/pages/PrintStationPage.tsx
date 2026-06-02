import { useCallback, useEffect, useRef, useState } from 'react'
import { PRINT_HEIGHT_PX, PRINT_SERVER_URL, PRINT_WIDTH_PX } from '../config/booth'
import { fetchPendingCaptures, markCaptureStatus } from '../lib/captures'
import { supabase, type CaptureRow } from '../lib/supabase'

async function resizeStripForPrint(imageUrl: string): Promise<Blob> {
  const img = await new Promise<HTMLImageElement>((resolve, reject) => {
    const el = new Image()
    el.crossOrigin = 'anonymous'
    el.onload = () => resolve(el)
    el.onerror = () => reject(new Error('Failed to load strip image'))
    el.src = imageUrl
  })

  const canvas = document.createElement('canvas')
  canvas.width = PRINT_WIDTH_PX
  canvas.height = PRINT_HEIGHT_PX
  const ctx = canvas.getContext('2d')!
  ctx.fillStyle = '#fff'
  ctx.fillRect(0, 0, canvas.width, canvas.height)
  ctx.drawImage(img, 0, 0, PRINT_WIDTH_PX, PRINT_HEIGHT_PX)

  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (b) => (b ? resolve(b) : reject(new Error('Resize failed'))),
      'image/png',
    )
  })
}

async function sendToLocalPrinter(blob: Blob, captureId: string) {
  const form = new FormData()
  form.append('image', blob, `${captureId}.png`)
  form.append('captureId', captureId)

  const res = await fetch(`${PRINT_SERVER_URL}/print`, {
    method: 'POST',
    body: form,
  })
  if (!res.ok) {
    const text = await res.text()
    throw new Error(text || `Print server error ${res.status}`)
  }
}

export function PrintStationPage() {
  const [queue, setQueue] = useState<CaptureRow[]>([])
  const [processing, setProcessing] = useState<string | null>(null)
  const [serverOk, setServerOk] = useState<boolean | null>(null)
  const [log, setLog] = useState<string[]>([])
  const processingRef = useRef(false)

  const appendLog = (msg: string) =>
    setLog((l) => [`${new Date().toLocaleTimeString()} — ${msg}`, ...l].slice(0, 20))

  const refreshQueue = useCallback(async () => {
    try {
      const rows = await fetchPendingCaptures()
      setQueue(rows)
    } catch (e) {
      appendLog(e instanceof Error ? e.message : 'Queue refresh failed')
    }
  }, [])

  useEffect(() => {
    refreshQueue()
    fetch(`${PRINT_SERVER_URL}/health`)
      .then((r) => setServerOk(r.ok))
      .catch(() => setServerOk(false))
  }, [refreshQueue])

  useEffect(() => {
    const channel = supabase
      .channel('print-station')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'captures' },
        (payload) => {
          const row = payload.new as CaptureRow
          if (row.status === 'pending') {
            setQueue((q) => [...q, row])
            appendLog(`New capture ${row.id.slice(0, 8)}`)
          }
        },
      )
      .subscribe()

    return () => {
      void supabase.removeChannel(channel)
    }
  }, [])

  const processCapture = useCallback(
    async (row: CaptureRow) => {
      if (!row.public_url) {
        appendLog(`Missing image URL for ${row.id}`)
        return
      }
      if (processingRef.current) return
      processingRef.current = true
      setProcessing(row.id)
      try {
        await markCaptureStatus(row.id, 'printing')
        const blob = await resizeStripForPrint(row.public_url)
        await sendToLocalPrinter(blob, row.id)
        await markCaptureStatus(row.id, 'printed')
        setQueue((q) => q.filter((r) => r.id !== row.id))
        appendLog(`Printed ${row.id.slice(0, 8)}`)
      } catch (e) {
        const msg = e instanceof Error ? e.message : 'Print failed'
        await markCaptureStatus(row.id, 'failed', msg)
        setQueue((q) => q.filter((r) => r.id !== row.id))
        appendLog(`Failed: ${msg}`)
      } finally {
        processingRef.current = false
        setProcessing(null)
      }
    },
    [],
  )

  useEffect(() => {
    if (processing || !queue.length || serverOk === false) return
    void processCapture(queue[0])
  }, [queue, processing, serverOk, processCapture])

  return (
    <div className="page station-page">
      <header className="site-header">
        <div>
          <h1>Print station</h1>
          <p className="muted">Run on laptop · DNP 2×6 · {PRINT_SERVER_URL}</p>
        </div>
        <span className={`status-pill ${serverOk ? 'ok' : 'bad'}`}>
          {serverOk === null ? 'Checking printer…' : serverOk ? 'Printer online' : 'Printer offline'}
        </span>
      </header>

      <section className="station-panel">
        <h2>Queue ({queue.length})</h2>
        {processing && <p className="muted">Printing {processing.slice(0, 8)}…</p>}
        <ul className="queue-list">
          {queue.map((row) => (
            <li key={row.id}>
              {row.public_url && (
                <img src={row.public_url} alt="" className="queue-thumb" />
              )}
              <span>{row.id.slice(0, 8)}</span>
              <button
                type="button"
                className="booth-btn"
                disabled={!!processing}
                onClick={() => processCapture(row)}
              >
                Print now
              </button>
            </li>
          ))}
        </ul>
        {!queue.length && <p className="muted">Waiting for captures from iPad/phone…</p>}
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
