export const STAFF_DOW_ORDER = [1, 2, 3, 4, 5, 6, 0]

export const STAFF_DOW_LABEL: Record<number, string> = {
  1: 'Lun',
  2: 'Mar',
  3: 'Mer',
  4: 'Gio',
  5: 'Ven',
  6: 'Sab',
  0: 'Dom',
}

export const ACCESS_PAGES = [
  { key: 'services', label: 'Servizi' },
  { key: 'bookings', label: 'Prenotazioni' },
  { key: 'calendar', label: 'Calendario' },
  { key: 'hours', label: 'Orari & capacità' },
  { key: 'closures', label: 'Ferie / chiusure' },
] as const