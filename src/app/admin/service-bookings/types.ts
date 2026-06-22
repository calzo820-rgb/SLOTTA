export type Booking = {
  id: string
  tenant_id: string
  service_id: string
  staff_id?: string | null
  customer_name: string
  customer_phone?: string | null
  customer_email?: string | null
  booking_date: string
  booking_time: string
  note?: string | null
  status: 'pending' | 'confirmed' | 'done' | 'cancelled'
  payment_status: 'unpaid' | 'paid'
  created_at: string
  manager_seen_at?: string | null
  checkout_pending?: boolean | null
}

export type Service = {
  id: string
  name: string
  duration_minutes: number
  price_cents: number
}

export type Staff = {
  id: string
  name: string
  is_active: boolean
}

export type HoursRow = {
  dow: number
  open_time_am: string | null
  close_time_am: string | null
  pm_enabled: boolean | null
  open_time_pm: string | null
  close_time_pm: string | null
  is_closed: boolean | null
}

export type BookingSettings = {
  slot_minutes: number
  lead_minutes: number
  service_staff_count: number
}