export type HoursRow = {
  dow: number // 0=Dom ... 6=Sab
  open_time_am: string
  close_time_am: string
  pm_enabled: boolean
  open_time_pm: string
  close_time_pm: string
  is_closed: boolean
}

export type Settings = {
  slot_minutes: string
  lead_minutes: string
  timezone: string
  service_staff_count: string
  payment_mode_default: 'online' | 'in_person' | 'client_choice'
  staff_assign_mode: 'first_free' | 'round_robin'
  staff_selection_mode: 'client_choice' | 'auto_only'
}

export type MobileSections = {
  rules: boolean
  weeklyHours: boolean
}