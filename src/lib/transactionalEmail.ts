import type { CreateEmailOptions } from 'resend'
import { getResend } from '@/lib/resendClient'
import { deliverTransactionalEmail } from '@/lib/emailDelivery'

const DEFAULT_REPLY_TO = 'info@slotta.it'

export async function sendTransactionalEmail(
  payload: CreateEmailOptions,
  idempotencyKey: string,
) {
  return deliverTransactionalEmail(
    {
      replyTo: DEFAULT_REPLY_TO,
      ...payload,
    },
    idempotencyKey,
    getResend().emails,
  )
}
