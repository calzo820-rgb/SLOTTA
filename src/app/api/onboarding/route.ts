import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

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
    const body = await req.json().catch(() => ({}));
    const businessName: string = (body?.businessName || body?.name || "").trim();
    const timezone: string = (body?.timezone || "Europe/Rome").trim();

    if (!businessName) {
      return NextResponse.json({ error: "Missing businessName" }, { status: 400 });
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
        tenant_mode: "service", // <-- SOLO SERVICE
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

    // 6) (Opzionale ma consigliato) Default tenant_settings così puoi testare subito booking
    // Se la tabella/colonne NON esistono, commenta questa sezione.
    await supabaseAdmin.from("tenant_settings").upsert({
      tenant_id: tenantId,
      timezone,
      slot_minutes: 30,
      lead_time_minutes: 60,
      service_staff_count: 1,
    });

    return NextResponse.json({ tenantId, slug: tenantInsert.slug }, { status: 200 });
  } catch (e: any) {
    return NextResponse.json({ error: "Unexpected error", details: e?.message }, { status: 500 });
  }
}