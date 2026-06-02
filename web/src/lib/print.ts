import { PRINT_HEIGHT_PX, PRINT_SERVER_URL, PRINT_WIDTH_PX } from '../config/booth'

export async function resizeStripForPrint(imageUrl: string): Promise<Blob> {
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

export async function sendToLocalPrinter(blob: Blob, captureId: string) {
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
