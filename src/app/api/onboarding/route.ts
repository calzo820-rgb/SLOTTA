import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { enforceRateLimit, readJsonBody } from '@/lib/apiGuard'

function slugify(input: string) {
  return input
    .toLowerCase()
    .trim()
    .replace(/[^\p{L}\p{N}]+/gu, "-")
    .replace(/(^-|-$)/g, "")
    .slice(0, 50);
}

export async function POST(req: Request) {
  try {
    // 1) Leggi body
    const limited = enforceRateLimit(req, 'onboarding', 5, 60 * 60_000)
    if (limited) return limited
    const body = await readJsonBody(req, 8_192)
    if (!body) return NextResponse.json({ error: 'Invalid request' }, { status: 400 })
    const businessName = String(body.businessName || body.name || "").trim();
    const timezone = String(body.timezone || "Europe/Rome").trim();
    const contactEmail: string = String(body?.contactEmail || "").trim().toLowerCase();

    if (!businessName) {
      return NextResponse.json({ error: "Missing businessName" }, { status: 400 });
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(contactEmail)) {
      return NextResponse.json({ error: "Invalid contactEmail" }, { status: 400 });
    }

    // 2) Supabase "user" via JWT in cookie (Next middleware già refresh-a)
    // Qui usiamo ANON + Authorization header se presente nel client (se non lo passi, fallback al cookie non c’è).
    // Quindi: dal frontend, manda il bearer token. (Ti dico sotto cosa aggiungere in page.tsx se manca)
    const authHeader = req.headers.get("authorization") || "";
    const jwt = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : null;

    if (!jwt) {
      return NextResponse.json({ error: "Missing Authorization Bearer token" }, { status: 401 });
    }

    const supabaseAnon = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        global: { headers: { Authorization: `Bearer ${jwt}` } },
        auth: { persistSession: false },
      }
    );

    const { data: userData, error: userErr } = await supabaseAnon.auth.getUser();
    if (userErr || !userData?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const userId = userData.user.id;

    // 3) Supabase ADMIN per scrivere (service role)
    const supabaseAdmin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      { auth: { persistSession: false } }
    );

    // 4) Crea tenant (SOLO SERVICE)
    const baseSlug = slugify(businessName);
    // slug unico: aggiungo 4 char random per ridurre collisioni senza loop infinito
    const slug = `${baseSlug}-${Math.random().toString(36).slice(2, 6)}`;

    const { data: tenantInsert, error: tenantErr } = await supabaseAdmin
      .from("tenants")
      .insert({
  name: businessName,
  slug,
  tenant_mode: "service",
  is_active: true,
  primary_color: "#1FA7A6",
  secondary_color: "#0F1D2D",
  contact_email: contactEmail,
})
      .select("id, slug")
      .single();

    if (tenantErr || !tenantInsert) {
      return NextResponse.json(
        { error: "Failed to create tenant", details: tenantErr?.message },
        { status: 500 }
      );
    }

    const tenantId = tenantInsert.id as string;

    // 5) Inserisci membership owner in tenant_users (tabella COERENTE col resto del progetto)
    // campi attesi: tenant_id, user_id, role, is_active, allowed_pages, username (se esiste)
    const { error: tuErr } = await supabaseAdmin.from("tenant_users").insert({
      tenant_id: tenantId,
      user_id: userId,
      role: "owner",
      is_active: true,
      // allowed_pages: null, // se la colonna esiste, puoi lasciarla null
    });

    if (tuErr) {
      // rollback tenant se vuoi tenere pulito
      await supabaseAdmin.from("tenants").delete().eq("id", tenantId);
      return NextResponse.json(
        { error: "Failed to create owner membership", details: tuErr.message },
        { status: 500 }
      );
    }

    // 6) Default tenant_settings
const { error: settingsErr } = await supabaseAdmin.from("tenant_settings").upsert(
  {
    tenant_id: tenantId,
    timezone,
    slot_minutes: 30,
    lead_minutes: 60,
    service_staff_count: 1,
    payment_mode_default: "in_person",
    staff_assign_mode: "first_free",
    staff_selection_mode: "client_choice",
  },
  { onConflict: "tenant_id" }
);

if (settingsErr) {
  await supabaseAdmin.from("tenant_users").delete().eq("tenant_id", tenantId);
  await supabaseAdmin.from("tenants").delete().eq("id", tenantId);

  return NextResponse.json(
    { error: "Failed to create tenant settings", details: settingsErr.message },
    { status: 500 }
  );
}

// 7) Default tenant_hours: Lun-Sab aperto, Dom chiuso
// Nota: open_time / close_time sono NOT NULL nel DB, quindi anche nei giorni chiusi
// salviamo un orario tecnico valido. La chiusura viene gestita da is_closed = true.
const defaultTenantHours = [0, 1, 2, 3, 4, 5, 6].map((dow) => {
  const isClosed = dow === 0

  return {
    tenant_id: tenantId,
    dow,
    open_time_am: "09:00:00",
    close_time_am: isClosed ? "09:00:00" : "12:30:00",
    pm_enabled: !isClosed,
    open_time_pm: isClosed ? "09:00:00" : "15:00:00",
    close_time_pm: isClosed ? "09:00:00" : "19:00:00",
    is_closed: isClosed,
    open_time: "09:00:00",
    close_time: isClosed ? "09:00:00" : "19:00:00",
  }
});

const { error: hoursErr } = await supabaseAdmin
  .from("tenant_hours")
  .upsert(defaultTenantHours, { onConflict: "tenant_id,dow" });

if (hoursErr) {
  await supabaseAdmin.from("tenant_settings").delete().eq("tenant_id", tenantId);
  await supabaseAdmin.from("tenant_users").delete().eq("tenant_id", tenantId);
  await supabaseAdmin.from("tenants").delete().eq("id", tenantId);

  return NextResponse.json(
    { error: "Failed to create tenant hours", details: hoursErr.message },
    { status: 500 }
  );
}

return NextResponse.json({ tenantId, slug: tenantInsert.slug }, { status: 200 });
 } catch (e: unknown) {
  console.error('onboarding error:', e)

  const message =
    e instanceof Error ? e.message : 'Errore durante l’onboarding.'

  return NextResponse.json(
    { error: message },
    { status: 500 },
  )
}
}
