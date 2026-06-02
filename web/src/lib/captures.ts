import { EVENT_SLUG } from '../config/booth'
import { supabase, type CaptureRow } from './supabase'

const BUCKET = 'strips'

export async function uploadStripAndQueuePrint(
  blob: Blob,
): Promise<CaptureRow> {
  const id = crypto.randomUUID()
  const storagePath = `${EVENT_SLUG}/${id}.png`

  const { error: uploadError } = await supabase.storage
    .from(BUCKET)
    .upload(storagePath, blob, {
      contentType: 'image/png',
      upsert: false,
    })

  if (uploadError) {
    throw new Error(`Upload failed: ${uploadError.message}`)
  }

  const { data: urlData } = supabase.storage.from(BUCKET).getPublicUrl(storagePath)

  const { data, error } = await supabase
    .from('captures')
    .insert({
      id,
      event_slug: EVENT_SLUG,
      storage_path: storagePath,
      public_url: urlData.publicUrl,
      image_url: urlData.publicUrl,
      status: 'pending',
    })
    .select()
    .single()

  if (error) {
    throw new Error(`Queue failed: ${error.message}`)
  }

  return data as CaptureRow
}

export async function markCaptureStatus(
  id: string,
  status: CaptureRow['status'],
  errorMessage?: string,
) {
  const payload: Record<string, unknown> = {
    status,
    error_message: errorMessage ?? null,
  }
  if (status === 'printed') {
    payload.printed_at = new Date().toISOString()
  }

  const { error } = await supabase.from('captures').update(payload).eq('id', id)
  if (error) throw new Error(error.message)
}

export async function fetchPendingCaptures(): Promise<CaptureRow[]> {
  const { data, error } = await supabase
    .from('captures')
    .select('*')
    .eq('status', 'pending')
    .order('created_at', { ascending: true })

  if (error) throw new Error(error.message)
  return (data ?? []) as CaptureRow[]
}

/** All saved strips for this event (newest first). */
export async function fetchCaptureHistory(limit = 60): Promise<CaptureRow[]> {
  const { data, error } = await supabase
    .from('captures')
    .select('*')
    .or(`event_slug.eq.${EVENT_SLUG},event_slug.is.null`)
    .order('created_at', { ascending: false })
    .limit(limit)

  if (error) throw new Error(error.message)
  return (data ?? []) as CaptureRow[]
}

export async function loadEventFrames(slug: string): Promise<string[]> {
  const { data, error } = await supabase
    .from('events')
    .select('frame_paths')
    .eq('slug', slug)
    .eq('is_active', true)
    .maybeSingle()

  if (error || !data?.frame_paths?.length) {
    return []
  }
  return data.frame_paths as string[]
}
