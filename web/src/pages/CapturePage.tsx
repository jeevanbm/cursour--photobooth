import { useEffect, useState } from 'react'
import { AppShell } from '../components/AppShell'
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
      setLastSent(`Strip saved · ${row.id.slice(0, 8).toUpperCase()} — sent to print station`)
    } finally {
      setSending(false)
    }
  }

  return (
    <AppShell
      badge={`Event · ${EVENT_SLUG}`}
      title="Capture"
      subtitle="Select a frame to begin the timed photo session."
    >
      {lastSent && (
        <div className="toast toast-success" role="status">
          {lastSent}
        </div>
      )}
      <PhotoBooth frameOptions={frames} onSendToPrint={onSendToPrint} sending={sending} />
    </AppShell>
  )
}
