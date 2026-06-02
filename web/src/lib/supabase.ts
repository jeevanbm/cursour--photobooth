import { createClient } from '@supabase/supabase-js'

const url = import.meta.env.VITE_SUPABASE_URL
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

if (!url || !anonKey) {
  console.warn(
    'Missing VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY. Copy web/.env.example to web/.env.local',
  )
}

export const supabase = createClient(url ?? '', anonKey ?? '')

export type CaptureRow = {
  id: string
  created_at: string
  event_slug: string | null
  storage_path: string | null
  public_url: string | null
  image_url?: string | null
  status: 'pending' | 'printing' | 'printed' | 'failed'
  printed_at: string | null
  error_message: string | null
}

export function captureImageUrl(row: CaptureRow): string | null {
  return row.public_url ?? row.image_url ?? null
}
