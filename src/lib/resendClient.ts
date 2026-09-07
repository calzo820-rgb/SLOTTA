import { Resend } from 'resend'

let cachedClient: Resend | undefined

export function getResend(): Resend {
  if (!cachedClient) {
    const apiKey = process.env.RESEND_API_KEY?.trim()

    if (!apiKey) {
      throw new Error('Missing required server environment variable: RESEND_API_KEY')
    }

    cachedClient = new Resend(apiKey)
  }

  return cachedClient
}
