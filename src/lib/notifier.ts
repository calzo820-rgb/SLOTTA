import { Resend } from 'resend'

const RESEND_API_KEY = process.env.RESEND_API_KEY || ''
const FROM = process.env.NOTIFY_FROM_EMAIL || 'no-reply@example.com'

const resend = RESEND_API_KEY ? new Resend(RESEND_API_KEY) : null

export async function notifyNewOrder(params: {
  toEmail?: string | null
  tenantName: string
  orderNumber: string
  totalCents: number
  readyByIso: string
  items: { name: string; qty: number; addons?: string[]; removed?: string[] }[]
}) {
  if (!params.toEmail || !resend) {
    console.log('[notifyNewOrder] (noop)', params)
    return
  }

  const totalEuro = (params.totalCents / 100).toFixed(2)
  const readyAt = new Date(params.readyByIso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })

  const lines = params.items.map(it => {
    const parts = [`• ${it.name} × ${it.qty}`]
    if (it.addons?.length) parts.push(`+ ${it.addons.join(', ')}`)
    if (it.removed?.length) parts.push(`- ${it.removed.join(', ')}`)
    return parts.join(' ')
  }).join('\n')

  const subject = `[${params.tenantName}] Nuovo ordine #${params.orderNumber}`
  const text = `Nuovo ordine #${params.orderNumber}

Ritiro: ore ${readyAt}
Totale: € ${totalEuro}

Dettagli:
${lines}
`

  await resend.emails.send({
    from: FROM,
    to: params.toEmail,
    subject,
    text,
  })
}
