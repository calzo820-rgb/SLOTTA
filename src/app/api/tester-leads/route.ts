import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabaseAdmin'
import { resend } from '@/lib/resendClient'

function cleanText(value: unknown, max = 500) {
  return String(value || '').trim().slice(0, max)
}

function isValidPhone(value: string) {
  return value.replace(/\D/g, '').length >= 8
}

function leadMessage(lead: {
  salonName: string
  contactName: string
  phone: string
  city: string
  message: string
  source: string
}) {
  return [
    'Nuovo tester Slotta',
    '',
    `Salone: ${lead.salonName}`,
    `Referente: ${lead.contactName}`,
    `Telefono: ${lead.phone}`,
    `Comune: ${lead.city}`,
    lead.message ? `Messaggio: ${lead.message}` : null,
    `Fonte: ${lead.source}`,
  ]
    .filter(Boolean)
    .join('\n')
}

async function notifyTelegram(text: string) {
  const token = process.env.TELEGRAM_BOT_TOKEN
  const chatId = process.env.TELEGRAM_CHAT_ID

  if (!token || !chatId) return

  try {
    await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: chatId, text }),
    })
  } catch (error) {
    console.error('Telegram tester lead notification failed:', error)
  }
}

async function notifyEmail(subject: string, text: string) {
  const to = process.env.LEADS_NOTIFY_EMAIL
  const from = process.env.RESEND_FROM_EMAIL || 'onboarding@resend.dev'

  if (!to || !process.env.RESEND_API_KEY) {
    console.log('Email NON inviata: manca LEADS_NOTIFY_EMAIL o RESEND_API_KEY')
    return
  }

  try {
    const result = await resend.emails.send({
      from,
      to,
      subject,
      text,
    })

 if (result.error) {
  console.error('Errore invio email Resend:', result.error)
  return
}

console.log('Email inviata con Resend:', result.data)
  } catch (error) {
    console.error('Errore invio email Resend:', error)
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}))

    const companyWebsite = cleanText(body.companyWebsite, 200)

    // Honeypot anti-spam: se compilato, fingiamo successo ma non salviamo.
    if (companyWebsite) {
      return NextResponse.json({ ok: true }, { status: 200 })
    }

    const salonName = cleanText(body.salonName, 120)
    const contactName = cleanText(body.contactName, 120)
    const phone = cleanText(body.phone, 40)
    const city = cleanText(body.city, 80)
    const message = cleanText(body.message, 800)
    const source = cleanText(body.source || 'tester_page', 80)
    const pagePath = cleanText(body.pagePath || '/tester', 300)
    const userAgent = cleanText(req.headers.get('user-agent'), 500)
    const referer = cleanText(req.headers.get('referer'), 300)

    if (salonName.length < 2) {
      return NextResponse.json(
        { error: 'Inserisci il nome del salone.' },
        { status: 400 },
      )
    }

    if (contactName.length < 2) {
      return NextResponse.json(
        { error: 'Inserisci il tuo nome.' },
        { status: 400 },
      )
    }

    if (!isValidPhone(phone)) {
      return NextResponse.json(
        { error: 'Inserisci un numero WhatsApp valido.' },
        { status: 400 },
      )
    }

    if (city.length < 2) {
      return NextResponse.json(
        { error: 'Inserisci il comune.' },
        { status: 400 },
      )
    }

    const { data, error } = await supabaseAdmin
      .from('tester_leads')
      .insert({
        salon_name: salonName,
        contact_name: contactName,
        phone,
        city,
        message: message || null,
        source,
        page_path: pagePath,
        user_agent: userAgent || null,
        referer: referer || null,
        status: 'new',
      })
      .select('id')
      .single()

    if (error) {
      console.error('tester_leads insert error:', error)

      return NextResponse.json(
        { error: 'Non riesco a salvare la richiesta. Riprova tra poco.' },
        { status: 500 },
      )
    }

    const notificationText = leadMessage({
      salonName,
      contactName,
      phone,
      city,
      message,
      source,
    })

    await Promise.all([
      notifyTelegram(notificationText),
      notifyEmail(`Nuovo tester Slotta: ${salonName}`, notificationText),
    ])

    return NextResponse.json({ ok: true, id: data.id }, { status: 200 })
  } catch (error) {
    console.error('tester leads route error:', error)

    return NextResponse.json(
      { error: 'Errore durante l’invio della richiesta.' },
      { status: 500 },
    )
  }
}