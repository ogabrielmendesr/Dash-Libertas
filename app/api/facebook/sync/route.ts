import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import { fetchAdInsights, extractActions, MetaApiError } from "@/lib/meta";

/**
 * Sincroniza insights de TODAS as contas com is_enabled = true.
 * Body opcional: { days?: number, ad_account_id?: string }
 */
export async function POST(req: Request) {
  const sb = supabaseAdmin();
  const body = await req.json().catch(() => ({}));
  const days = Math.min(90, Math.max(1, Number(body.days) || 30));
  const targetAccount = body.ad_account_id as string | undefined;

  const startedAt = new Date().toISOString();

  // 1) Pega token
  const { data: conn } = await sb
    .from("fb_connections")
    .select("access_token")
    .order("updated_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!conn) {
    return NextResponse.json(
      { error: "Conecte o Meta primeiro em /configuracoes" },
      { status: 412 }
    );
  }

  // 2) Lista contas habilitadas
  let q = sb.from("fb_ad_accounts").select("ad_account_id, name").eq("is_enabled", true);
  if (targetAccount) q = q.eq("ad_account_id", targetAccount);
  const { data: accounts } = await q;

  if (!accounts || accounts.length === 0) {
    return NextResponse.json(
      { error: "Nenhuma conta de anúncios habilitada. Ative pelo menos uma em /configuracoes." },
      { status: 412 }
    );
  }

  // 3) Calcula intervalo
  const until = new Date();
  const since = new Date();
  since.setDate(since.getDate() - (days - 1));
  const fmt = (d: Date) => d.toISOString().slice(0, 10);
  const sinceStr = fmt(since);
  const untilStr = fmt(until);

  let totalRecords = 0;
  const results: Array<{ account: string; records: number; error?: string }> = [];

  for (const acc of accounts) {
    try {
      const rows = await fetchAdInsights({
        token: conn.access_token,
        adAccountId: acc.ad_account_id,
        since: sinceStr,
        until: untilStr,
      });

      const records = rows.map((r) => {
        const { landing_page_views, initiate_checkouts } = extractActions(r.actions);
        return {
          ad_account_id: acc.ad_account_id,
          campaign_id: r.campaign_id,
          campaign_name: r.campaign_name,
          adset_id: r.adset_id,
          adset_name: r.adset_name,
          ad_id: r.ad_id,
          ad_name: r.ad_name,
          date: r.date_start,
          spend: Number(r.spend ?? 0),
          impressions: Number(r.impressions ?? 0),
          link_clicks: Number(r.inline_link_clicks ?? 0),
          landing_page_views,
          initiate_checkouts,
        };
      });

      const batchSize = 200;
      for (let i = 0; i < records.length; i += batchSize) {
        const batch = records.slice(i, i + batchSize);
        const { error } = await sb
          .from("fb_ad_insights")
          .upsert(batch, { onConflict: "ad_id,date" });
        if (error) throw new Error(error.message);
      }

      await sb
        .from("fb_ad_accounts")
        .update({ last_synced_at: new Date().toISOString() })
        .eq("ad_account_id", acc.ad_account_id);

      totalRecords += records.length;
      results.push({ account: acc.name, records: records.length });
    } catch (e) {
      const msg = e instanceof MetaApiError ? e.message : (e as Error).message;
      results.push({ account: acc.name, records: 0, error: msg });
    }
  }

  await sb.from("sync_logs").insert({
    type: "facebook_sync",
    status: results.some((r) => r.error) ? "warning" : "success",
    records_processed: totalRecords,
    message: `${accounts.length} contas · ${totalRecords} insights · ${days} dias`,
    metadata: { results, since: sinceStr, until: untilStr },
    started_at: startedAt,
    finished_at: new Date().toISOString(),
  });

  return NextResponse.json({
    ok: true,
    records: totalRecords,
    since: sinceStr,
    until: untilStr,
    accounts: results,
  });
}
