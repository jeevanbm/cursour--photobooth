/** Default frames (same as cute-photobooth repo). Override per event via Supabase `events` table. */
export const DEFAULT_FRAMES = [
  '/assets/frames/heart-frame.png',
  '/assets/frames/heart-frame-2.png',
  '/assets/frames/heart-frame-3.png',
  '/assets/frames/heart-frame-4.png',
] as const

export const STICKERS = [
  '/assets/stickers/leaf.png',
  '/assets/stickers/sparkles.png',
] as const

/** Photo slot geometry — matches reference frame PNG layout */
/** `ideal` sizes work on phones; exact 953×599 often blocks the camera */
export const VIDEO_CONSTRAINTS = {
  facingMode: 'user' as const,
  width: { ideal: 1280 },
  height: { ideal: 720 },
}
export const SLOT_WIDTH = 953
export const SLOT_HEIGHT = 599

export const PHOTO_SLOTS = [
  { x: 123, y: 78 },
  { x: 123, y: 697 },
  { x: 123, y: 1286 },
  { x: 123, y: 1885 },
] as const

/** DNP 2×6 strip at 300 DPI */
export const PRINT_WIDTH_PX = 600
export const PRINT_HEIGHT_PX = 1800

export const EVENT_SLUG = import.meta.env.VITE_EVENT_SLUG ?? 'default'
export const PRINT_SERVER_URL =
  import.meta.env.VITE_PRINT_SERVER_URL ?? 'http://localhost:3847'
