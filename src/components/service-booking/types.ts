export type TenantInfo = {
  id: string
  name: string
  slug: string
  logo_url?: string | null
  address?: string | null
  contact_email?: string | null
  phone?: string | null
  whatsapp_phone?: string | null
  instagram_url?: string | null
  website_url?: string | null

  stripe_connect_charges_enabled?: boolean | null
  stripe_connect_payouts_enabled?: boolean | null
}

export type Service = {
  id: string
  name: string
  description?: string | null
  duration_minutes: number
  price_cents: number
  image_url?: string | null
}

export type StaffMember = {
  id: string
  name: string
  is_active: boolean
  position: number
}

export type Props = {
  tenant: TenantInfo
  services: Service[]
}

export type StaffHoursRow = {
  staff_id: string
  dow: number
  open_time_am?: string | null
  close_time_am?: string | null
  pm_enabled?: boolean | null
  open_time_pm?: string | null
  close_time_pm?: string | null
  is_closed?: boolean | null
}

export type Closure = {
  id: string
  staff_id: string | null
  closure_type: 'salon' | 'staff'
  start_date: string
  end_date: string
  all_day: boolean
  start_time: string | null
  end_time: string | null
}

export type StaffSelectionMode = 'client_choice' | 'auto_only'

export type PaymentModeDefault = 'online' | 'in_person' | 'client_choice'

export type PaymentModeEffective = 'online' | 'in_person'
