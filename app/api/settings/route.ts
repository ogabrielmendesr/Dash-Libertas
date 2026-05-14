import { NextResponse } from "next/server";
import { z } from "zod";
import { supabaseAdmin } from "@/lib/supabase";

const Body = z.object({
  display_currency: z.enum(["BRL", "USD"]).optional(),
  fx_usd_brl: z.number().positive().max(1000).optional(),
});

export async function GET() {
  const sb = supabaseAdmin();
  const { data, error } = await sb
    .from("app_settings")
    .select("display_currency, fx_usd_brl, fx_rate_updated_at, updated_at")
    .order("updated_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(
    data ?? { display_currency: "BRL", fx_usd_brl: 5.20, fx_rate_updated_at: null }
  );
}

export async function PATCH(req: Request) {
  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Body inválido" }, { status: 400 });
  }
  const sb = supabaseAdmin();

  const { data: existing } = await sb
    .from("app_settings")
    .select("id")
    .order("updated_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  // Quando o usuário ajusta manualmente o câmbio, também marca o timestamp
  const payload: Record<string, unknown> = { ...parsed.data };
  if (parsed.data.fx_usd_brl !== undefined) {
    payload.fx_rate_updated_at = new Date().toISOString();
  }

  if (!existing) {
    const { error } = await sb.from("app_settings").insert(payload);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  } else {
    const { error } = await sb.from("app_settings").update(payload).eq("id", existing.id);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true, ...payload });
}
