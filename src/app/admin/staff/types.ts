export type Staff = {
  id: string
  tenant_id: string
  name: string
  is_active: boolean
  position: number
}

export type StaffAccess = {
  id: string
  tenant_id: string
  user_id: string
  username: string | null
  role: 'owner' | 'staff'
  allowed_pages: string[] | null
  is_active: boolean
}

export type MobileSections = {
  addStaff: boolean
  operators: boolean
  accesses: boolean
}