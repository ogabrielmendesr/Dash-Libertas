import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";

/**
 * Busca a cotação USD/BRL atual na AwesomeAPI (grátis, sem chave)
 * e grava em app_settings.fx_usd_brl.
 *
 * Endpoint: https://economia.awesomeapi.com.br/json/last/USD-BRL
 */
export async function POST() {
  try {
    const r = await fetch("https://economia.awesomeapi.com.br/json/last/USD-BRL", {
      cache: "no-store",
    });
    if (!r.ok) {
      return NextResponse.json({ error: `AwesomeAPI retornou ${r.status}` }, { status: 502 });
    }
    const data = (await r.json()) as { USDBRL?: { bid?: string; ask?: string; high?: string; create_date?: string } };
    const bid = data.USDBRL?.bid ? parseFloat(data.USDBRL.bid) : NaN;
    if (!Number.isFinite(bid) || bid <= 0) {
      return NextResponse.json({ error: "Cotação inválida" }, { status: 502 });
    }

    const sb = supabaseAdmin();
    const { data: existing } = await sb
      .from("app_settings")
      .select("id")
      .order("updated_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (existing) {
      await sb
        .from("app_settings")
        .update({ fx_usd_brl: bid, fx_rate_updated_at: new Date().toISOString() })
        .eq("id", existing.id);
    } else {
      await sb.from("app_settings").insert({ fx_usd_brl: bid, fx_rate_updated_at: new Date().toISOString() });
    }

    return NextResponse.json({
      ok: true,
      fx_usd_brl: bid,
      source: "AwesomeAPI",
      retrieved_at: new Date().toISOString(),
      provider_timestamp: data.USDBRL?.create_date ?? null,
    });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}
