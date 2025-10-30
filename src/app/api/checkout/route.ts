// /src/app/api/checkout/route.ts (estratto)
import Stripe from 'stripe'

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2024-06-20', // o la tua versione
})

export async function POST(req: Request) {
  const body = await req.json()
  const { items, tenant_slug, tenant_name, total_cents, slot } = body

  // line_items costruite come prima…
  const line_items = items.map((i: any) => ({
    price_data: {
      currency: 'eur',
      product_data: {
        name: i.name,
        metadata: {
          tenant_slug,
          slot,
        },
      },
      unit_amount: i.price_cents, // in centesimi
    },
    quantity: i.qty,
  }))

  const session = await stripe.checkout.sessions.create({
    mode: 'payment',
    line_items,
    // ✅ lascia che Stripe proponga carta + Link + wallet
    automatic_payment_methods: { enabled: true },

    // Se preferisci forzare esplicitamente carta + link (non necessario):
    // payment_method_types: ['card', 'link'],

    success_url: `${process.env.NEXT_PUBLIC_BASE_URL}/t/${tenant_slug}/success?session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${process.env.NEXT_PUBLIC_BASE_URL}/t/${tenant_slug}`,
    metadata: {
      tenant_slug,
      slot,
      tenant_name: tenant_name || '',
    },
  })

  return new Response(JSON.stringify({ url: session.url }), { status: 200 })
}

