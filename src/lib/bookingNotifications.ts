type BookingNotificationState = {
  status: string | null
  payment_status: string | null
  manager_seen_at?: string | null
  checkout_pending?: boolean | null
}

export function requiresManagerAction(booking: BookingNotificationState) {
  return booking.status === 'pending' && booking.checkout_pending !== true
}

export function shouldAutoAcknowledgePaidBooking(
  booking: BookingNotificationState,
) {
  return (
    booking.status === 'confirmed' &&
    booking.payment_status === 'paid' &&
    booking.manager_seen_at == null &&
    booking.checkout_pending !== true
  )
}
