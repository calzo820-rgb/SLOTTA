import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabaseAdmin'
import { resend } from '@/lib/resendClient'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

type EmailType = 'confirmed' | 'cancelled' | 'manual_created'

function escapeHtml(value: string) {
  return String(value || '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;')
}

function fmtDate(d: string) {
  try {
    return new Date(`${d}T00:00:00`).toLocaleDateString('it-IT')
  } catch {
    return d
  }
}

function fmtTime(t: string) {
  const parts = String(t || '').split(':')
  return `${parts[0] || '00'}:${parts[1] || '00'}`
}

function timeStrToMinutes(s: string): number {
  const parts = String(s || '').split(':')
  const h = parseInt(parts[0] || '0', 10)
  const m = parseInt(parts[1] || '0', 10)
  return h * 60 + m
}

function buildGoogleCalendarLink({
  bookingDate,
  bookingTime,
  serviceName,
  customerName,
  durationMinutes,
}: {
  bookingDate: string
  bookingTime: string
  serviceName: string
  customerName: string
  durationMinutes: number
}) {
  const datePlain = bookingDate.replace(/-/g, '')
  const [hh, mm] = String(bookingTime || '00:00').split(':')
  const startMinutes = timeStrToMinutes(bookingTime)
  const endMinutes = startMinutes + durationMinutes

  const endH = String(Math.floor(endMinutes / 60)).padStart(2, '0')
  const endM = String(endMinutes % 60).padStart(2, '0')

  const startStr = `${datePlain}T${(hh || '00')}${(mm || '00')}00`
  const endStr = `${datePlain}T${endH}${endM}00`

  const title = encodeURIComponent(`Appuntamento: ${serviceName}`)
  const details = encodeURIComponent(
    `Prenotazione presso il salone.\nCliente: ${customerName || ''}`,
  )

  return `https://www.google.com/calendar/render?action=TEMPLATE&text=${title}&dates=${startStr}/${endStr}&details=${details}`
}

export async function POST(req: Request) {
  try {
    const body = await req.json()
const authHeader = req.headers.get('authorization')
const accessToken = authHeader?.replace('Bearer ', '').trim()

if (!accessToken) {
  return NextResponse.json(
    { error: 'Non autenticato.' },
    { status: 401 },
  )
}
    const bookingId = String(body?.booking_id || '')
    const tenantId = String(body?.tenant_id || '')
    const type = String(body?.type || '') as EmailType
const {
  data: { user },
  error: userErr,
} = await supabaseAdmin.auth.getUser(accessToken)

if (userErr || !user) {
  return NextResponse.json(
    { error: 'Sessione non valida.' },
    { status: 401 },
  )
}

const { data: membership, error: membershipErr } = await supabaseAdmin
  .from('tenant_users')
  .select('tenant_id, user_id, role')
  .eq('tenant_id', tenantId)
  .eq('user_id', user.id)
  .maybeSingle()

if (membershipErr) {
  return NextResponse.json(
    { error: membershipErr.message },
    { status: 500 },
  )
}

if (!membership) {
  return NextResponse.json(
    { error: 'Non autorizzato per questo salone.' },
    { status: 403 },
  )
}
    if (!bookingId || !tenantId || !['confirmed', 'cancelled', 'manual_created'].includes(type)) {
      return NextResponse.json(
        { error: 'Parametri mancanti o non validi.' },
        { status: 400 },
      )
    }

    const { data: booking, error: bookingErr } = await supabaseAdmin
      .from('service_bookings')
      .select(
        'id, tenant_id, service_id, customer_name, customer_email, booking_date, booking_time, status',
      )
      .eq('id', bookingId)
      .eq('tenant_id', tenantId)
      .single()

    if (bookingErr || !booking) {
      return NextResponse.json(
        { error: bookingErr?.message || 'Prenotazione non trovata.' },
        { status: 404 },
      )
    }

    const to = String(booking.customer_email || '').trim().toLowerCase()

    if (!to || !to.includes('@')) {
      return NextResponse.json({
        ok: true,
        skipped: true,
        reason: 'Email cliente mancante o non valida.',
      })
    }

    const { data: service } = await supabaseAdmin
      .from('services')
      .select('name, duration_minutes, price_cents')
      .eq('id', booking.service_id)
      .single()

    const { data: tenant } = await supabaseAdmin
      .from('tenants')
      .select('name')
      .eq('id', tenantId)
      .single()

    const businessName = tenant?.name || 'il salone'
    const serviceName = service?.name || 'servizio'
    const durationMinutes = service?.duration_minutes || 60
    const dateStr = fmtDate(booking.booking_date)
    const timeStr = fmtTime(booking.booking_time)

    const calendarUrl = buildGoogleCalendarLink({
      bookingDate: booking.booking_date,
      bookingTime: booking.booking_time,
      serviceName,
      customerName: booking.customer_name || '',
      durationMinutes,
    })

    let subject = ''
    let title = ''
    let intro = ''
    let extraBlock = ''
    let showCalendarButton = false

    if (type === 'confirmed') {
      subject = `Prenotazione confermata - ${businessName}`
      title = 'Prenotazione confermata'
      intro = `Ciao ${escapeHtml(
        booking.customer_name || '',
      )}, la tua prenotazione è stata confermata.`
      showCalendarButton = true
    }

    if (type === 'manual_created') {
      subject = `Prenotazione registrata - ${businessName}`
      title = 'Prenotazione registrata'
      intro = `Ciao ${escapeHtml(
        booking.customer_name || '',
      )}, la tua prenotazione è stata registrata.`
      showCalendarButton = true
    }

if (type === 'cancelled') {
  subject = `Prenotazione rifiutata - ${businessName}`
  title = 'La tua prenotazione è stata rifiutata'
  intro = `Ciao ${escapeHtml(
    booking.customer_name || '',
  )}, ci dispiace, la tua prenotazione è stata rifiutata dal salone.`
  extraBlock = `
    <div style="margin-top: 18px; padding: 16px; border-radius: 16px; background: #FEF2F2; color: #991B1B;">
      Puoi scegliere un altro orario disponibile oppure contattare direttamente l’attività per maggiori informazioni.
    </div>
  `
}
    const from = process.env.RESEND_FROM_EMAIL || 'onboarding@resend.dev'

    await resend.emails.send({
      from,
      to,
      subject,
      html: `
        <div style="font-family: Arial, sans-serif; color: #0F1D2D; line-height: 1.5; max-width: 560px; margin: 0 auto;">
          <div style="padding: 20px 0;">
            <h1 style="margin: 0; font-size: 24px; color: #0F1D2D;">
              ${escapeHtml(title)}
            </h1>

            <p style="margin: 8px 0 0; color: #64748b;">
              ${intro}
            </p>
          </div>

          <div style="border: 1px solid #e2e8f0; border-radius: 18px; padding: 18px; background: #f8fafc;">
            <p style="margin: 0 0 10px;">
              <strong>Attività:</strong> ${escapeHtml(businessName)}
            </p>

            <p style="margin: 0 0 10px;">
              <strong>Servizio:</strong> ${escapeHtml(serviceName)}
            </p>

            <p style="margin: 0 0 10px;">
              <strong>Data:</strong> ${escapeHtml(dateStr)}
            </p>

            <p style="margin: 0;">
              <strong>Ora:</strong> ${escapeHtml(timeStr)}
            </p>
          </div>

          ${
            showCalendarButton
              ? `
                <div style="margin-top: 18px;">
                  <a
                    href="${escapeHtml(calendarUrl)}"
                    target="_blank"
                    rel="noopener noreferrer"
                    style="display: inline-block; background: #FFC145; color: #0F1D2D; text-decoration: none; font-weight: 700; padding: 12px 16px; border-radius: 14px;"
                  >
                    Aggiungi al calendario
                  </a>
                </div>
              `
              : ''
          }

          ${extraBlock}

          <p style="margin-top: 22px; color: #64748b;">
            ${
              type === 'cancelled'
                ? 'Grazie.'
                : 'Ti aspettiamo in salone!'
            }
          </p>

          <p style="margin-top: 22px; font-size: 12px; color: #94a3b8;">
            Email inviata automaticamente da Slotta.
          </p>
        </div>
      `,
    })

    return NextResponse.json({ ok: true })
} catch (e: unknown) {
  console.error('booking-email error:', e)

  const message =
    e instanceof Error ? e.message : 'Errore invio email prenotazione.'

  return NextResponse.json(
    { error: message },
    { status: 500 },
  )
}
}