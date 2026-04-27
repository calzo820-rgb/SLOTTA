// src/app/api/send-confirmation-email/route.ts
import { NextResponse } from 'next/server'
import { resend } from '@/lib/resendClient'

export const dynamic = 'force-dynamic'

export async function POST(req: Request) {
  try {
    const body = await req.json()
    const { to, subject, html } = body as {
      to?: string
      subject?: string
      html?: string
    }

    if (!to || !subject || !html) {
      return NextResponse.json(
        { error: 'Missing to/subject/html' },
        { status: 400 }
      )
    }

    const from = process.env.RESEND_FROM_EMAIL || 'onboarding@resend.dev'

    const result = await resend.emails.send({
      from,
      to,
      subject,
      html,
    })

    return NextResponse.json({ ok: true, result })
  } catch (e: any) {
    console.error('Errore send-confirmation-email:', e)
    return NextResponse.json(
      { error: e?.message || 'Errore invio email' },
      { status: 500 }
    )
  }
}
