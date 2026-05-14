import { NextResponse } from "next/server";
import { supabaseAdmin, useMockData } from "@/lib/supabase";
import { mockCampaigns } from "@/lib/mockApi";

/**
 * Árvore campanha → conjunto → anúncio com métricas agregadas.
 * Query: ?days=30
 */
export async function GET(req: Request) {
  const url = new URL(req.url);
  const days = Math.min(90, Math.max(1, Number(url.searchParams.get("days")) || 30));

  if (useMockData()) return NextResponse.json({ ...mockCampaigns(), mock: true });

  const sb = supabaseAdmin();
  const until = new Date();
  const since = new Date();
  since.setDate(since.getDate() - (days - 1));
  const sinceStr = since.toISOString().slice(0, 10);
  const untilStr = until.toISOString().slice(0, 10);

  const { data, error } = await sb
    .from("ad_performance")
    .select("*")
    .gte("date", sinceStr)
    .lte("date", untilStr);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  type Agg = {
    spend: number;
    impressions: number;
    link_clicks: number;
    landing_page_views: number;
    initiate_checkouts: number;
    sales: number;
    revenue: number;
  };
  const empty = (): Agg => ({
    spend: 0,
    impressions: 0,
    link_clicks: 0,
    landing_page_views: 0,
    initiate_checkouts: 0,
    sales: 0,
    revenue: 0,
  });
  const add = (a: Agg, r: typeof data[number]): Agg => ({
    spend: a.spend + Number(r.spend),
    impressions: a.impressions + Number(r.impressions),
    link_clicks: a.link_clicks + Number(r.link_clicks),
    landing_page_views: a.landing_page_views + Number(r.landing_page_views),
    initiate_checkouts: a.initiate_checkouts + Number(r.initiate_checkouts),
    sales: a.sales + Number(r.sales_count),
    revenue: a.revenue + Number(r.revenue),
  });

  // campaign → adset → ads
  const tree = new Map<
    string,
    {
      campaign_id: string;
      campaign_name: string;
      agg: Agg;
      adsets: Map<
        string,
        {
          adset_id: string;
          adset_name: string;
          agg: Agg;
          ads: Map<
            string,
            { ad_id: string; ad_name: string; agg: Agg }
          >;
        }
      >;
    }
  >();

  for (const r of data ?? []) {
    if (!tree.has(r.campaign_id)) {
      tree.set(r.campaign_id, {
        campaign_id: r.campaign_id,
        campaign_name: r.campaign_name,
        agg: empty(),
        adsets: new Map(),
      });
    }
    const c = tree.get(r.campaign_id)!;
    c.agg = add(c.agg, r);

    if (!c.adsets.has(r.adset_id)) {
      c.adsets.set(r.adset_id, {
        adset_id: r.adset_id,
        adset_name: r.adset_name,
        agg: empty(),
        ads: new Map(),
      });
    }
    const s = c.adsets.get(r.adset_id)!;
    s.agg = add(s.agg, r);

    if (!s.ads.has(r.ad_id)) {
      s.ads.set(r.ad_id, { ad_id: r.ad_id, ad_name: r.ad_name, agg: empty() });
    }
    const a = s.ads.get(r.ad_id)!;
    a.agg = add(a.agg, r);
  }

  const result = Array.from(tree.values()).map((c) => ({
    campaign_id: c.campaign_id,
    campaign_name: c.campaign_name,
    agg: c.agg,
    adsets: Array.from(c.adsets.values()).map((s) => ({
      adset_id: s.adset_id,
      adset_name: s.adset_name,
      agg: s.agg,
      ads: Array.from(s.ads.values()),
    })),
  }));

  return NextResponse.json({ period: { since: sinceStr, until: untilStr, days }, campaigns: result });
}
