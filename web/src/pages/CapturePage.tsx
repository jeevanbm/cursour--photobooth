import { useEffect, useState } from 'react'
import { PhotoBooth } from '../components/PhotoBooth'
import { DEFAULT_FRAMES, EVENT_SLUG } from '../config/booth'
import { loadEventFrames, uploadStripAndQueuePrint } from '../lib/captures'

export function CapturePage() {
  const [frames, setFrames] = useState<string[]>([...DEFAULT_FRAMES])
  const [sending, setSending] = useState(false)
  const [lastSent, setLastSent] = useState<string | null>(null)

  useEffect(() => {
    loadEventFrames(EVENT_SLUG).then((paths) => {
      if (paths.length) setFrames(paths)
    })
  }, [])

  const onSendToPrint = async (blob: Blob) => {
    setSending(true)
    try {
      const row = await uploadStripAndQueuePrint(blob)
      setLastSent(`Queued for print · ${row.id.slice(0, 8)}`)
    } finally {
      setSending(false)
    }
  }

  return (
    <div className="page capture-page">
      <header className="site-header">
        <img src="/assets/logo/jiggleduo-logo.png" alt="" width={48} />
        <div>
          <h1>Photo Booth</h1>
          <p className="muted">Capture · Event: {EVENT_SLUG}</p>
        </div>
      </header>
      {lastSent && <p className="success-banner">{lastSent}</p>}
      <PhotoBooth frameOptions={frames} onSendToPrint={onSendToPrint} sending={sending} />
    </div>
  )
}
