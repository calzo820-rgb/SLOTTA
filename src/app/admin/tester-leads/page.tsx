import { getMyMembership, requireAuth, requireOwner } from '@/lib/authz'
import { getSupabaseAdmin } from '@/lib/supabaseAdmin'

export const dynamic = 'force-dynamic'
export const revalidate = 0

type TesterLead = {
  id: string
  created_at: string
  salon_name: string
  contact_name: string
  phone: string
  city: string
  message: string | null
  source: string
  status: string
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat('it-IT', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value))
}

export default async function TesterLeadsPage() {
  const mem = await getMyMembership()
  requireOwner(requireAuth(mem, '/admin/tester-leads'))
  const { data, error } = await getSupabaseAdmin().from('tester_leads').select('id, created_at, salon_name, contact_name, phone, city, message, source, status').order('created_at', { ascending: false })
  if (error) throw new Error('Impossibile caricare le richieste tester.')
  const leads = (data ?? []) as TesterLead[]

  return (
    <main className="min-h-[calc(100vh-80px)] bg-[#F2F4F7] px-4 py-6 text-[#0F1D2D] sm:px-6 md:py-8">
      <div className="mx-auto max-w-7xl">
        <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-end">
          <div>
            <div className="text-sm font-black uppercase tracking-wide text-[#1FA7A6]">Contatti commerciali</div>
            <h1 className="mt-1 text-3xl font-black tracking-tight">Richieste tester</h1>
            <p className="mt-2 text-sm text-slate-500">{leads.length} {leads.length === 1 ? 'richiesta ricevuta' : 'richieste ricevute'}</p>
          </div>
          <div className="rounded-2xl border border-[#1FA7A6]/20 bg-white px-4 py-3 text-sm font-bold text-slate-600 shadow-sm">Le richieste vengono salvate anche se una notifica non parte.</div>
        </div>
        {leads.length === 0 ? (
          <div className="mt-6 rounded-[2rem] border border-slate-200 bg-white p-8 text-center shadow-sm"><div className="text-lg font-black">Ancora nessuna richiesta</div><p className="mt-2 text-sm text-slate-500">Quando un salone compilerà il modulo tester, lo vedrai qui.</p></div>
        ) : (
          <div className="mt-6 grid gap-4">{leads.map(lead => (
            <article key={lead.id} className="rounded-[2rem] border border-slate-200 bg-white p-5 shadow-sm">
              <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-start">
                <div><h2 className="text-xl font-black">{lead.salon_name}</h2><p className="mt-1 text-sm font-bold text-slate-600">{lead.contact_name} · {lead.city}</p></div>
                <div className="flex items-center gap-2 text-xs font-black"><span className="rounded-full bg-[#E6FFFA] px-3 py-1.5 text-[#0F766E]">{lead.status}</span><span className="text-slate-400">{formatDate(lead.created_at)}</span></div>
              </div>
              <div className="mt-4 grid gap-2 text-sm sm:grid-cols-3"><a href={`tel:${lead.phone}`} className="font-black text-[#1FA7A6] hover:underline">{lead.phone}</a><div className="text-slate-600">Fonte: {lead.source}</div><div className="text-slate-500">ID: {lead.id.slice(0, 8)}</div></div>
              {lead.message ? <p className="mt-4 rounded-2xl bg-[#F8FAFC] p-4 text-sm leading-6 text-slate-600">{lead.message}</p> : null}
            </article>
          ))}</div>
        )}
      </div>
    </main>
  )
}
