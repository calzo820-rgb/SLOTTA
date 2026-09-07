import type { CreateEmailOptions } from 'resend'
import { getResend } from '@/lib/resendClient'
import { deliverTransactionalEmail } from '@/lib/emailDelivery'

export async function sendTransactionalEmail(
  payload: CreateEmailOptions,
  idempotencyKey: string,
) {
  return deliverTransactionalEmail(payload, idempotencyKey, getResend().emails)
}
