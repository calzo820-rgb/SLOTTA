import type { CreateEmailOptions, CreateEmailResponse } from 'resend'

type EmailSender = {
  send: (
    payload: CreateEmailOptions,
    options: { idempotencyKey: string },
  ) => Promise<CreateEmailResponse>
}

const IDEMPOTENCY_KEY_PATTERN = /^[A-Za-z0-9._:-]{8,256}$/

export class EmailDeliveryError extends Error {
  constructor() {
    super('Transactional email delivery failed')
    this.name = 'EmailDeliveryError'
  }
}

export async function deliverTransactionalEmail(
  payload: CreateEmailOptions,
  idempotencyKey: string,
  sender: EmailSender,
) {
  if (!IDEMPOTENCY_KEY_PATTERN.test(idempotencyKey)) {
    throw new Error('Invalid transactional email idempotency key')
  }

  for (let attempt = 0; attempt < 2; attempt += 1) {
    try {
      const result = await sender.send(payload, { idempotencyKey })
      if (!result.error) return result.data
    } catch {
      // A second call with the same key is safe: Resend deduplicates accepted sends.
    }
  }

  throw new EmailDeliveryError()
}
