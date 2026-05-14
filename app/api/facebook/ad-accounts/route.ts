import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import { listAdAccounts, MetaApiError } from "@/lib/meta";

/**
 * Lista todas as contas de anúncios catalogadas (com flag is_enabled).
 */
export async function GET() {
  const sb = supabaseAdmin();
  const { data, error } = await sb
    .from("fb_ad_accounts")
    .select("ad_account_id, name, currency, is_active, is_enabled, last_synced_at")
    .order("is_enabled", { ascending: false })
    .order("is_active", { ascending: false })
    .order("name");
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ accounts: data ?? [] });
}

/**
 * Atualiza o catálogo de contas chamando a Meta API de novo.
 * Útil quando o usuário ganha acesso a uma nova conta no BM.
 */
export async function POST() {
  const sb = supabaseAdmin();
  const { data: conn } = await sb
    .from("fb_connections")
    .select("access_token")
    .order("updated_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (!conn) {
    return NextResponse.json({ error: "Conecte o Meta primeiro" }, { status: 412 });
  }

  try {
    const accounts = await listAdAccounts(conn.access_token);
    for (const a of accounts) {
      await sb.from("fb_ad_accounts").upsert(
        {
          ad_account_id: a.id,
          name: a.name,
          currency: a.currency,
          is_active: a.account_status === 1,
        },
        { onConflict: "ad_account_id" }
      );
    }
    return NextResponse.json({ ok: true, count: accounts.length });
  } catch (e) {
    if (e instanceof MetaApiError) {
      return NextResponse.json({ error: e.message }, { status: e.status });
    }
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}
