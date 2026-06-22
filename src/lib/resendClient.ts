// src/lib/resendClient.ts
import { Resend } from 'resend'

if (!process.env.RESEND_API_KEY) {
  console.warn('RESEND_API_KEY non impostata (.env.local)')
}

export const resend = new Resend(process.env.RESEND_API_KEY || '')