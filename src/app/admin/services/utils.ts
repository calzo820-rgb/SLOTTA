import { supabase } from '@/lib/supabaseClient'

export const IMAGE_BUCKET = 'service-images'

export function centsToEuro(cents: number | null | undefined) {
  if (cents === null || cents === undefined) return ''
  return (cents / 100).toFixed(2)
}

export function euroToCents(v: string) {
  const num = parseFloat(v.replace(',', '.'))
  if (isNaN(num)) return 0
  return Math.round(num * 100)
}

export async function uploadImageForTenant(
  file: File,
  tenantId: string,
): Promise<string> {
  const ext = file.name.split('.').pop() || 'jpg'
  const fileName = `${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`
  const path = `${tenantId}/${fileName}`

  const { error: uploadErr } = await supabase.storage
    .from(IMAGE_BUCKET)
    .upload(path, file, {
      cacheControl: '3600',
      upsert: true,
    })

  if (uploadErr) throw uploadErr

  const { data } = supabase.storage.from(IMAGE_BUCKET).getPublicUrl(path)
  return data.publicUrl
}