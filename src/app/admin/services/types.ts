export type ServiceRow = {
  id: string
  tenant_id: string
  name: string
  description?: string | null
  duration_minutes: number
  price_cents: number
  image_url?: string | null
  is_active: boolean
}

export type ToastType = 'success' | 'error' | 'info'

export type ToastState = { type: ToastType; message: string } | null