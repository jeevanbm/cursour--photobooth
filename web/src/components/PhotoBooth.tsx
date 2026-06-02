import { useCallback, useEffect, useRef, useState } from 'react'
import Webcam from 'react-webcam'
import {
  DEFAULT_FRAMES,
  PHOTO_SLOTS,
  SLOT_HEIGHT,
  SLOT_WIDTH,
  STICKERS,
  VIDEO_CONSTRAINTS,
} from '../config/booth'

type PlacedPhoto = {
  img: HTMLImageElement
  slotIndex: number
  scale: number
  offsetX: number
  offsetY: number
}

type PlacedSticker = {
  img: HTMLImageElement
  x: number
  y: number
}

export type PhotoBoothProps = {
  frameOptions: string[]
  onSendToPrint: (blob: Blob) => Promise<void>
  sending?: boolean
}

export function PhotoBooth({ frameOptions, onSendToPrint, sending }: PhotoBoothProps) {
  const webcamRef = useRef<Webcam>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const frameImgRef = useRef<HTMLImageElement | null>(null)

  const [selectedFrame, setSelectedFrame] = useState<string | null>(null)
  const [mode, setMode] = useState<'photo' | 'decorate'>('photo')
  const [photos, setPhotos] = useState<PlacedPhoto[]>([])
  const [photoCount, setPhotoCount] = useState(0)
  const [canTakePhoto, setCanTakePhoto] = useState(true)
  const [draggingPhoto, setDraggingPhoto] = useState<number | null>(null)
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 })
  const [countdown, setCountdown] = useState<number | null>(null)
  const [stickers, setStickers] = useState<PlacedSticker[]>([])
  const [draggingSticker, setDraggingSticker] = useState<number | null>(null)
  const [selectedSticker, setSelectedSticker] = useState<number | null>(null)
  const [sendError, setSendError] = useState<string | null>(null)

  const drawCanvas = useCallback(() => {
    const canvas = canvasRef.current
    const frameImg = frameImgRef.current
    if (!canvas || !frameImg) return

    const ctx = canvas.getContext('2d')
    if (!ctx) return

    canvas.width = frameImg.width
    canvas.height = frameImg.height
    ctx.clearRect(0, 0, canvas.width, canvas.height)

    photos.forEach((p) => {
      const slot = PHOTO_SLOTS[p.slotIndex]
      const drawW = p.img.width * p.scale
      const drawH = p.img.height * p.scale
      const dx = slot.x + p.offsetX
      const dy = slot.y + p.offsetY

      ctx.save()
      ctx.beginPath()
      ctx.rect(slot.x, slot.y, SLOT_WIDTH, SLOT_HEIGHT)
      ctx.clip()
      ctx.drawImage(p.img, dx, dy, drawW, drawH)
      ctx.restore()
    })

    ctx.drawImage(frameImg, 0, 0, frameImg.width, frameImg.height)

    stickers.forEach((s, i) => {
      ctx.drawImage(s.img, s.x, s.y, 150, 150)
      if (i === selectedSticker) {
        ctx.strokeStyle = '#ff7aa2'
        ctx.lineWidth = 4
        ctx.strokeRect(s.x, s.y, 150, 150)
      }
    })
  }, [photos, stickers, selectedSticker])

  useEffect(() => {
    if (!selectedFrame) return
    const img = new Image()
    img.src = selectedFrame
    img.onload = () => {
      frameImgRef.current = img
      drawCanvas()
    }
  }, [selectedFrame, drawCanvas])

  useEffect(() => {
    drawCanvas()
  }, [drawCanvas, photos, stickers, photoCount])

  const addPhoto = (img: HTMLImageElement) => {
    if (photoCount >= 4) return

    const scale = SLOT_WIDTH / img.width
    const drawH = img.height * scale
    const offsetY = drawH > SLOT_HEIGHT ? (SLOT_HEIGHT - drawH) / 2 : 0

    setPhotos((p) => [
      ...p,
      { img, slotIndex: photoCount, scale, offsetX: 0, offsetY },
    ])
    setCanTakePhoto(true)
    setPhotoCount((c) => {
      const next = c + 1
      if (next === 4) setMode('decorate')
      return next
    })
  }

  const takePhotoNow = () => {
    const src = webcamRef.current?.getScreenshot()
    if (!src) return
    const img = new Image()
    img.src = src
    img.onload = () => addPhoto(img)
  }

  const capturePhoto = () => {
    if (!canTakePhoto || countdown !== null) return
    setCanTakePhoto(false)
    setCountdown(3)
    let current = 3
    const interval = setInterval(() => {
      current -= 1
      if (current === 0) {
        clearInterval(interval)
        setCountdown(null)
        takePhotoNow()
      } else {
        setCountdown(current)
      }
    }, 1000)
  }

  const uploadPhoto = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = () => {
      const img = new Image()
      img.src = reader.result as string
      img.onload = () => addPhoto(img)
    }
    reader.readAsDataURL(file)
    e.target.value = ''
  }

  const redoLastPhoto = () => {
    if (!photos.length) return
    setPhotos((p) => p.slice(0, -1))
    setPhotoCount((c) => Math.max(0, c - 1))
    setCanTakePhoto(true)
    setMode('photo')
  }

  const handleBack = () => {
    if (mode === 'decorate') {
      setMode('photo')
      setCanTakePhoto(false)
      setStickers([])
      setSelectedSticker(null)
    } else {
      setSelectedFrame(null)
      setPhotos([])
      setPhotoCount(0)
      setStickers([])
      setSelectedSticker(null)
      setMode('photo')
      setCanTakePhoto(true)
    }
  }

  const getCoords = (e: React.MouseEvent | React.TouchEvent) => {
    const canvas = canvasRef.current!
    const r = canvas.getBoundingClientRect()
    const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX
    const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY
    return {
      x: (clientX - r.left) * (canvas.width / r.width),
      y: (clientY - r.top) * (canvas.height / r.height),
    }
  }

  const handlePointerDown = (e: React.MouseEvent | React.TouchEvent) => {
    const { x, y } = getCoords(e)
    if (mode === 'photo') {
      for (let i = photos.length - 1; i >= 0; i--) {
        const p = photos[i]
        const slot = PHOTO_SLOTS[p.slotIndex]
        const w = p.img.width * p.scale
        const h = p.img.height * p.scale
        if (
          x >= slot.x + p.offsetX &&
          x <= slot.x + p.offsetX + w &&
          y >= slot.y + p.offsetY &&
          y <= slot.y + p.offsetY + h
        ) {
          setDraggingPhoto(i)
          setDragOffset({ x: x - slot.x - p.offsetX, y: y - slot.y - p.offsetY })
          return
        }
      }
    }
    if (mode === 'decorate') {
      for (let i = stickers.length - 1; i >= 0; i--) {
        const s = stickers[i]
        if (x >= s.x && x <= s.x + 150 && y >= s.y && y <= s.y + 150) {
          setDraggingSticker(i)
          setSelectedSticker(i)
          setDragOffset({ x: x - s.x, y: y - s.y })
          return
        }
      }
    }
  }

  const handlePointerMove = (e: React.MouseEvent | React.TouchEvent) => {
    const { x, y } = getCoords(e)
    if (draggingPhoto !== null && mode === 'photo') {
      setPhotos((prev) => {
        const updated = [...prev]
        const p = { ...updated[draggingPhoto] }
        const slot = PHOTO_SLOTS[p.slotIndex]
        const w = p.img.width * p.scale
        const h = p.img.height * p.scale
        p.offsetX = Math.min(Math.max(x - slot.x - dragOffset.x, SLOT_WIDTH - w), 0)
        p.offsetY = Math.min(Math.max(y - slot.y - dragOffset.y, SLOT_HEIGHT - h), 0)
        updated[draggingPhoto] = p
        return updated
      })
    }
    if (draggingSticker !== null && mode === 'decorate') {
      setStickers((s) => {
        const u = [...s]
        u[draggingSticker] = {
          ...u[draggingSticker],
          x: x - dragOffset.x,
          y: y - dragOffset.y,
        }
        return u
      })
    }
  }

  const handlePointerUp = () => {
    setDraggingPhoto(null)
    setDraggingSticker(null)
  }

  const addSticker = (src: string) => {
    const img = new Image()
    img.src = src
    img.onload = () => setStickers((s) => [...s, { img, x: 400, y: 100 }])
  }

  useEffect(() => {
    const handleKeyDown = (ev: KeyboardEvent) => {
      if (
        (ev.key === 'Delete' || ev.key === 'Backspace') &&
        selectedSticker != null &&
        mode === 'decorate'
      ) {
        setStickers((s) => s.filter((_, i) => i !== selectedSticker))
        setSelectedSticker(null)
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [selectedSticker, mode])

  const canvasToBlob = (): Promise<Blob> =>
    new Promise((resolve, reject) => {
      canvasRef.current?.toBlob(
        (b) => (b ? resolve(b) : reject(new Error('Could not export image'))),
        'image/png',
      )
    })

  const sendToPrint = async () => {
    setSendError(null)
    try {
      const blob = await canvasToBlob()
      await onSendToPrint(blob)
      setSelectedFrame(null)
      setPhotos([])
      setPhotoCount(0)
      setStickers([])
      setMode('photo')
      setCanTakePhoto(true)
    } catch (err) {
      setSendError(err instanceof Error ? err.message : 'Send failed')
    }
  }

  const frames = frameOptions.length ? frameOptions : [...DEFAULT_FRAMES]

  return (
    <div className="booth">
      <div className="booth-top">
        {selectedFrame && (
          <button type="button" className="booth-btn booth-back" onClick={handleBack}>
            ← Back
          </button>
        )}
        <h2 className="booth-title">
          {!selectedFrame
            ? 'Select a frame'
            : mode === 'photo'
              ? 'Smile :)'
              : 'Decorate your strip'}
        </h2>
      </div>

      {!selectedFrame ? (
        <div className="frame-picker">
          {frames.map((src) => (
            <button
              key={src}
              type="button"
              className="frame-thumb-btn"
              onClick={() => setSelectedFrame(src)}
            >
              <img src={src} alt="" className="frame-thumb" />
            </button>
          ))}
        </div>
      ) : (
        <div className="booth-row">
          <div className="booth-controls">
            {mode === 'photo' && (
              <>
                <div className="webcam-wrap">
                  <Webcam
                    audio={false}
                    ref={webcamRef}
                    screenshotFormat="image/png"
                    videoConstraints={VIDEO_CONSTRAINTS}
                    mirrored
                    className="webcam"
                  />
                  {countdown != null && <div className="countdown">{countdown}</div>}
                </div>
                <div className="btn-row">
                  {canTakePhoto && (
                    <>
                      <button type="button" className="booth-btn" onClick={capturePhoto}>
                        Take photo
                      </button>
                      <label className="booth-btn booth-upload">
                        Upload
                        <input type="file" accept="image/*" hidden onChange={uploadPhoto} />
                      </label>
                    </>
                  )}
                  {photoCount > 0 && (
                    <button type="button" className="booth-btn" onClick={redoLastPhoto}>
                      ⟳ Redo
                    </button>
                  )}
                </div>
                <p className="photo-progress">{photoCount} / 4 photos</p>
              </>
            )}
            {mode === 'decorate' && (
              <div className="sticker-bar">
                {STICKERS.map((src) => (
                  <button key={src} type="button" onClick={() => addSticker(src)}>
                    <img src={src} alt="" width={50} />
                  </button>
                ))}
              </div>
            )}
          </div>

          <div className="strip-preview">
            <canvas
              ref={canvasRef}
              className="strip-canvas"
              onMouseDown={handlePointerDown}
              onMouseMove={handlePointerMove}
              onMouseUp={handlePointerUp}
              onMouseLeave={handlePointerUp}
              onTouchStart={handlePointerDown}
              onTouchMove={handlePointerMove}
              onTouchEnd={handlePointerUp}
            />
            {mode === 'decorate' && (
              <div className="btn-row center">
                <button
                  type="button"
                  className="booth-btn booth-btn-primary"
                  disabled={sending}
                  onClick={sendToPrint}
                >
                  {sending ? 'Sending…' : 'Print strip'}
                </button>
              </div>
            )}
            {sendError && <p className="error">{sendError}</p>}
          </div>
        </div>
      )}
    </div>
  )
}
