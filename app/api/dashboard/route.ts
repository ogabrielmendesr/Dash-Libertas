import { NextResponse } from "next/server";
import { supabaseAdmin, useMockData } from "@/lib/supabase";
import { mockDashboard } from "@/lib/mockApi";

/**
 * Endpoint principal do painel.
 * Retorna: totals + daily + funnel + ads + recent_sales — tudo cruzado por
 * sales.utm_content = fb_ad_insights.ad_id.
 *
 * Query: ?days=30 (default 30, max 90)
 */
export async function GET(req: Request) {
  const url = new URL(req.url);
  const days = Math.min(90, Math.max(1, Number(url.searchParams.get("days")) || 30));

  if (useMockData()) {
    return NextResponse.json({ ...mockDashboard(days), mock: true });
  }

  const sb = supabaseAdmin();
  const until = new Date();
  const since = new Date();
  since.setDate(since.getDate() - (days - 1));
  const fmt = (d: Date) => d.toISOString().slice(0, 10);
  const sinceStr = fmt(since);
  const untilStr = fmt(until);

  // 1. Pega os insights agregados (já com cruzamento via view)
  const { data: insights, error: insErr } = await sb
    .from("ad_performance")
    .select("*")
    .gte("date", sinceStr)
    .lte("date", untilStr);

  if (insErr) return NextResponse.json({ error: insErr.message }, { status: 500 });

  const rows = insights ?? [];

  // 2. Agrega por dia (chart)
  const byDay = new Map<string, { date: string; spend: number; revenue: number; sales: number }>();
  for (const r of rows) {
    const key = r.date as string;
    const prev = byDay.get(key) ?? { date: key, spend: 0, revenue: 0, sales: 0 };
    prev.spend += Number(r.spend);
    prev.revenue += Number(r.revenue);
    prev.sales += Number(r.sales_count);
    byDay.set(key, prev);
  }
  const daily = Array.from(byDay.values()).sort((a, b) => a.date.localeCompare(b.date));

  // 3. Agrega por anúncio (tabela)
  const byAd = new Map<
    string,
    {
      ad_id: string;
      ad_name: string;
      adset_id: string;
      adset_name: string;
      campaign_id: string;
      campaign_name: string;
      spend: number;
      impressions: number;
      link_clicks: number;
      landing_page_views: number;
      initiate_checkouts: number;
      sales: number;
      revenue: number;
    }
  >();
  for (const r of rows) {
    const k = r.ad_id as string;
    const prev =
      byAd.get(k) ?? {
        ad_id: r.ad_id,
        ad_name: r.ad_name,
        adset_id: r.adset_id,
        adset_name: r.adset_name,
        campaign_id: r.campaign_id,
        campaign_name: r.campaign_name,
        spend: 0,
        impressions: 0,
        link_clicks: 0,
        landing_page_views: 0,
        initiate_checkouts: 0,
        sales: 0,
        revenue: 0,
      };
    prev.spend += Number(r.spend);
    prev.impressions += Number(r.impressions);
    prev.link_clicks += Number(r.link_clicks);
    prev.landing_page_views += Number(r.landing_page_views);
    prev.initiate_checkouts += Number(r.initiate_checkouts);
    prev.sales += Number(r.sales_count);
    prev.revenue += Number(r.revenue);
    byAd.set(k, prev);
  }
  const ads = Array.from(byAd.values()).sort((a, b) => b.revenue - a.revenue);

  // 4. Totais
  const totals = ads.reduce(
    (a, r) => ({
      spend: a.spend + r.spend,
      impressions: a.impressions + r.impressions,
      link_clicks: a.link_clicks + r.link_clicks,
      landing_page_views: a.landing_page_views + r.landing_page_views,
      initiate_checkouts: a.initiate_checkouts + r.initiate_checkouts,
      sales: a.sales + r.sales,
      revenue: a.revenue + r.revenue,
    }),
    {
      spend: 0,
      impressions: 0,
      link_clicks: 0,
      landing_page_views: 0,
      initiate_checkouts: 0,
      sales: 0,
      revenue: 0,
    }
  );

  // 5. Recent sales (últimas 24)
  const { data: recentSales } = await sb
    .from("sales")
    .select(
      "id, transaction_id, status, product_name, sale_amount, utm_content, sale_date"
    )
    .order("sale_date", { ascending: false })
    .limit(24);

  // 6. Para cada venda, anexa o nome do anúncio (se cruzar)
  const adById = new Map(ads.map((a) => [a.ad_id, a]));
  const enrichedSales = (recentSales ?? []).map((s) => {
    const ad = s.utm_content ? adById.get(s.utm_content) : undefined;
    return {
      id: s.id,
      transaction_id: s.transaction_id,
      status: s.status,
      product_name: s.product_name,
      sale_amount: Number(s.sale_amount),
      utm_content: s.utm_content,
      sale_date: s.sale_date,
      ad_name: ad?.ad_name ?? null,
      campaign_name: ad?.campaign_name ?? null,
    };
  });

  return NextResponse.json({
    period: { since: sinceStr, until: untilStr, days },
    totals,
    daily,
    ads,
    recent_sales: enrichedSales,
  });
}
