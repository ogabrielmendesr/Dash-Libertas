/**
 * Camada de dados server-side.
 *
 * Cruzamento: ad.id ≡ utm_content (independente de moeda).
 * Quando moedas diferem entre ad account e venda, aplicamos conversão pela
 * taxa app_settings.fx_usd_brl. A moeda do toggle controla como exibimos.
 */

import { supabaseAdmin, useMockData } from "./supabase";
import { mockDashboard, mockSales, mockCampaigns } from "./mockApi";
import { Currency } from "./currency";
import { convertAmount } from "./fx";
import { brDateStr } from "./dateRange";

function defaultRange(): { since: string; until: string } {
  const today = brDateStr(new Date());
  return { since: today, until: today };
}

function computeDays(since: string, until: string): number {
  const sd = new Date(since);
  const ud = new Date(until);
  return Math.max(1, Math.round((ud.getTime() - sd.getTime()) / 86400000) + 1);
}

// ============================================================
// Helpers
// ============================================================
async function getSettings(): Promise<{ display_currency: Currency; fx_usd_brl: number }> {
  if (useMockData()) return { display_currency: "BRL", fx_usd_brl: 5.20 };
  const sb = supabaseAdmin();
  const { data } = await sb
    .from("app_settings")
    .select("display_currency, fx_usd_brl")
    .order("updated_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  return {
    display_currency: ((data?.display_currency as Currency) ?? "BRL") as Currency,
    fx_usd_brl: Number(data?.fx_usd_brl ?? 5.20),
  };
}

// ============================================================
// DASHBOARD
// ============================================================
export type HourlyPoint = {
  hour: number;
  label: string;
  spend: number;
  revenue: number;
  profit: number;
};

export type DashboardData = ReturnType<typeof mockDashboard> & {
  mock?: boolean;
  currency: Currency;
  fx_usd_brl?: number;
  hourly?: HourlyPoint[];
  current_hour?: number;
};

export async function fetchDashboard(
  range: { since: string; until: string } = defaultRange()
): Promise<DashboardData> {
  const days = computeDays(range.since, range.until);
  if (useMockData()) return { ...mockDashboard(days), mock: true, currency: "BRL" };

  const { display_currency: display, fx_usd_brl: fx } = await getSettings();
  const sb = supabaseAdmin();
  const sinceStr = range.since;
  const untilStr = range.until;

  const { data: rows } = await sb
    .from("ad_performance")
    .select("*")
    .gte("date", sinceStr)
    .lte("date", untilStr);

  const list = rows ?? [];

  // Converte cada linha para display
  type Row = (typeof list)[number];
  const convert = (r: Row) => {
    const adCurrency: Currency = (r.ad_account_currency as Currency) ?? "BRL";
    const spend = convertAmount(Number(r.spend), adCurrency, display, fx);
    const brlRev = convertAmount(Number(r.brl_revenue), "BRL", display, fx);
    const usdRev = convertAmount(Number(r.usd_revenue), "USD", display, fx);
    return {
      ...r,
      spend_disp: spend,
      revenue_disp: brlRev + usdRev,
      sales_total: Number(r.brl_sales_count) + Number(r.usd_sales_count),
    };
  };
  const converted = list.map(convert);

  // Por dia
  const byDay = new Map<string, { date: string; spend: number; revenue: number; sales: number }>();
  for (const r of converted) {
    const key = r.date as string;
    const prev = byDay.get(key) ?? { date: key, spend: 0, revenue: 0, sales: 0 };
    prev.spend += r.spend_disp;
    prev.revenue += r.revenue_disp;
    prev.sales += r.sales_total;
    byDay.set(key, prev);
  }
  const daily = Array.from(byDay.values()).sort((a, b) => a.date.localeCompare(b.date));

  // Por anúncio
  type AdRowAgg = {
    ad_id: string;
    ad_name: string;
    adset_id: string;
    adset_name: string;
    campaign_id: string;
    campaign_name: string;
    ad_account_currency: Currency;
    spend: number;
    impressions: number;
    link_clicks: number;
    landing_page_views: number;
    initiate_checkouts: number;
    sales: number;
    revenue: number;
    mixed_currency: boolean;
  };
  const byAd = new Map<string, AdRowAgg>();
  for (const r of converted) {
    const k = r.ad_id as string;
    const adCurrency: Currency = (r.ad_account_currency as Currency) ?? "BRL";
    const hasMixedSales =
      (Number(r.brl_revenue) > 0 && adCurrency !== "BRL") ||
      (Number(r.usd_revenue) > 0 && adCurrency !== "USD");
    const prev =
      byAd.get(k) ?? {
        ad_id: r.ad_id,
        ad_name: r.ad_name,
        adset_id: r.adset_id,
        adset_name: r.adset_name,
        campaign_id: r.campaign_id,
        campaign_name: r.campaign_name,
        ad_account_currency: adCurrency,
        spend: 0,
        impressions: 0,
        link_clicks: 0,
        landing_page_views: 0,
        initiate_checkouts: 0,
        sales: 0,
        revenue: 0,
        mixed_currency: false,
      };
    prev.spend += r.spend_disp;
    prev.impressions += Number(r.impressions);
    prev.link_clicks += Number(r.link_clicks);
    prev.landing_page_views += Number(r.landing_page_views);
    prev.initiate_checkouts += Number(r.initiate_checkouts);
    prev.sales += r.sales_total;
    prev.revenue += r.revenue_disp;
    if (hasMixedSales) prev.mixed_currency = true;
    byAd.set(k, prev);
  }
  const ads = Array.from(byAd.values()).sort((a, b) => b.revenue - a.revenue);

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
    { spend: 0, impressions: 0, link_clicks: 0, landing_page_views: 0, initiate_checkouts: 0, sales: 0, revenue: 0 }
  );

  // ============================================================
  // DADOS POR HORA (acumulado) — para o chart de Faturamento × Investimento × Lucro
  // ============================================================
  // Investimento: distribuído uniformemente em 24h (Meta retorna spend diário)
  // Faturamento: bucketizado pela hora real da venda (sale_date em America/Sao_Paulo)
  // Lucro: faturamento − investimento (cumulativos)
  const totalSpendDisp = totals.spend;
  const daysCount = computeDays(sinceStr, untilStr);
  const spendPerHourBucket = daysCount > 0 ? totalSpendDisp / 24 : 0; // cada hora-do-dia abrange "daysCount" dias

  const { data: salesInRange } = await sb
    .from("sales")
    .select("sale_amount, currency, sale_date, status")
    .gte("sale_date", `${sinceStr}T00:00:00`)
    .lte("sale_date", `${untilStr}T23:59:59.999`);

  const hourRevenueBuckets = Array.from({ length: 24 }, () => 0);
  for (const s of salesInRange ?? []) {
    if (s.status !== "approved") continue;
    const d = new Date(s.sale_date);
    const hourStr = new Intl.DateTimeFormat("pt-BR", {
      timeZone: "America/Sao_Paulo",
      hour: "2-digit",
      hour12: false,
    }).format(d);
    const hourNum = parseInt(hourStr, 10);
    if (!Number.isFinite(hourNum) || hourNum < 0 || hourNum > 23) continue;
    const saleCurr: Currency = (s.currency as Currency) ?? "BRL";
    hourRevenueBuckets[hourNum] += convertAmount(Number(s.sale_amount), saleCurr, display, fx);
  }

  let spendCum = 0;
  let revCum = 0;
  const hourly: HourlyPoint[] = Array.from({ length: 24 }, (_, h) => {
    spendCum += spendPerHourBucket;
    revCum += hourRevenueBuckets[h];
    return {
      hour: h,
      label: `${String(h).padStart(2, "0")}:00`,
      spend: spendCum,
      revenue: revCum,
      profit: revCum - spendCum,
    };
  });

  // Quando o range é um único dia "hoje", limitamos o chart na hora atual (BR)
  const todayStr = brDateStr(new Date());
  const isSingleDayToday = sinceStr === todayStr && untilStr === todayStr;
  let currentHour: number | undefined;
  if (isSingleDayToday) {
    const hourStr = new Intl.DateTimeFormat("pt-BR", {
      timeZone: "America/Sao_Paulo",
      hour: "2-digit",
      hour12: false,
    }).format(new Date());
    const h = parseInt(hourStr, 10);
    currentHour = Number.isFinite(h) ? h : undefined;
  }

  // Recent sales — sem filtrar por moeda, com conversão por venda
  const { data: recentSales } = await sb
    .from("sales")
    .select("id, transaction_id, status, product_name, sale_amount, currency, utm_content, sale_date")
    .order("sale_date", { ascending: false })
    .limit(24);

  const adById = new Map(ads.map((a) => [a.ad_id, a]));
  const recent_sales = (recentSales ?? []).map((s) => {
    const ad = s.utm_content ? adById.get(s.utm_content) : undefined;
    const saleCurr = (s.currency as Currency) ?? "BRL";
    const displayedAmount = convertAmount(Number(s.sale_amount), saleCurr, display, fx);
    return {
      id: s.id,
      transaction_id: s.transaction_id,
      status: s.status,
      product_name: s.product_name,
      sale_amount: displayedAmount,
      original_amount: Number(s.sale_amount),
      original_currency: saleCurr,
      utm_content: s.utm_content,
      sale_date: s.sale_date,
      ad_name: ad?.ad_name ?? null,
      campaign_name: ad?.campaign_name ?? null,
    };
  });

  return {
    period: { since: sinceStr, until: untilStr, days },
    totals,
    daily,
    ads,
    recent_sales,
    hourly,
    current_hour: currentHour,
    mock: false,
    currency: display,
    fx_usd_brl: fx,
  };
}

// ============================================================
// CAMPANHAS
// ============================================================
export type CampaignsData = ReturnType<typeof mockCampaigns> & {
  mock?: boolean;
  currency: Currency;
  fx_usd_brl?: number;
};

export async function fetchCampaigns(
  range: { since: string; until: string } = defaultRange()
): Promise<CampaignsData> {
  if (useMockData()) return { ...mockCampaigns(), mock: true, currency: "BRL" };

  const { display_currency: display, fx_usd_brl: fx } = await getSettings();
  const sb = supabaseAdmin();
  const sinceStr = range.since;
  const untilStr = range.until;

  const { data } = await sb
    .from("ad_performance")
    .select("*")
    .gte("date", sinceStr)
    .lte("date", untilStr);

  type Agg = { spend: number; impressions: number; link_clicks: number; landing_page_views: number; initiate_checkouts: number; sales: number; revenue: number };
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  type Row = any;
  const empty = (): Agg => ({ spend: 0, impressions: 0, link_clicks: 0, landing_page_views: 0, initiate_checkouts: 0, sales: 0, revenue: 0 });
  const add = (a: Agg, r: Row): Agg => {
    const adCurrency: Currency = (r.ad_account_currency as Currency) ?? "BRL";
    const spend = convertAmount(Number(r.spend), adCurrency, display, fx);
    const brlRev = convertAmount(Number(r.brl_revenue), "BRL", display, fx);
    const usdRev = convertAmount(Number(r.usd_revenue), "USD", display, fx);
    return {
      spend: a.spend + spend,
      impressions: a.impressions + Number(r.impressions),
      link_clicks: a.link_clicks + Number(r.link_clicks),
      landing_page_views: a.landing_page_views + Number(r.landing_page_views),
      initiate_checkouts: a.initiate_checkouts + Number(r.initiate_checkouts),
      sales: a.sales + Number(r.brl_sales_count) + Number(r.usd_sales_count),
      revenue: a.revenue + brlRev + usdRev,
    };
  };

  const tree = new Map<string, { campaign_id: string; campaign_name: string; agg: Agg; adsets: Map<string, { adset_id: string; adset_name: string; agg: Agg; ads: Map<string, { ad_id: string; ad_name: string; agg: Agg }> }> }>();

  for (const r of data ?? []) {
    if (!tree.has(r.campaign_id)) tree.set(r.campaign_id, { campaign_id: r.campaign_id, campaign_name: r.campaign_name, agg: empty(), adsets: new Map() });
    const c = tree.get(r.campaign_id)!;
    c.agg = add(c.agg, r);
    if (!c.adsets.has(r.adset_id)) c.adsets.set(r.adset_id, { adset_id: r.adset_id, adset_name: r.adset_name, agg: empty(), ads: new Map() });
    const s = c.adsets.get(r.adset_id)!;
    s.agg = add(s.agg, r);
    if (!s.ads.has(r.ad_id)) s.ads.set(r.ad_id, { ad_id: r.ad_id, ad_name: r.ad_name, agg: empty() });
    const a = s.ads.get(r.ad_id)!;
    a.agg = add(a.agg, r);
  }

  return {
    period: { since: sinceStr, until: untilStr, days: computeDays(sinceStr, untilStr) },
    campaigns: Array.from(tree.values()).map((c) => ({
      campaign_id: c.campaign_id,
      campaign_name: c.campaign_name,
      agg: c.agg,
      adsets: Array.from(c.adsets.values()).map((s) => ({
        adset_id: s.adset_id,
        adset_name: s.adset_name,
        agg: s.agg,
        ads: Array.from(s.ads.values()),
      })),
    })),
    mock: false,
    currency: display,
    fx_usd_brl: fx,
  };
}

// ============================================================
// SALES
// ============================================================
export type SalesData = ReturnType<typeof mockSales> & {
  mock?: boolean;
  currency: Currency;
  fx_usd_brl?: number;
};

export async function fetchSales(
  range?: { since: string; until: string }
): Promise<SalesData> {
  if (useMockData()) return { ...mockSales(), mock: true, currency: "BRL" };

  const { display_currency: display, fx_usd_brl: fx } = await getSettings();
  const sb = supabaseAdmin();
  let q = sb
    .from("sales")
    .select("id, transaction_id, status, product_name, sale_amount, currency, utm_content, sale_date, buyer_email")
    .order("sale_date", { ascending: false })
    .limit(200);

  if (range) {
    // sale_date é timestamptz — filtra do início do "since" até o fim do "until"
    q = q.gte("sale_date", `${range.since}T00:00:00`).lte("sale_date", `${range.until}T23:59:59.999`);
  }

  const { data: sales } = await q;

  const utmIds = Array.from(new Set((sales ?? []).map((s) => s.utm_content).filter(Boolean) as string[]));
  const adMap: Map<string, { ad_name: string; campaign_name: string }> = new Map();
  if (utmIds.length > 0) {
    const { data: ads } = await sb
      .from("fb_ad_insights")
      .select("ad_id, ad_name, campaign_name")
      .in("ad_id", utmIds);
    for (const a of ads ?? []) adMap.set(a.ad_id, { ad_name: a.ad_name, campaign_name: a.campaign_name });
  }

  const enriched = (sales ?? []).map((s) => {
    const saleCurr = (s.currency as Currency) ?? "BRL";
    const displayedAmount = convertAmount(Number(s.sale_amount), saleCurr, display, fx);
    return {
      ...s,
      sale_amount: displayedAmount,
      original_amount: Number(s.sale_amount),
      original_currency: saleCurr,
      ad_name: s.utm_content ? adMap.get(s.utm_content)?.ad_name ?? null : null,
      campaign_name: s.utm_content ? adMap.get(s.utm_content)?.campaign_name ?? null : null,
    };
  });

  const products = Array.from(new Set(enriched.map((s) => s.product_name).filter(Boolean)));
  const totals = enriched.reduce(
    (a, s) => {
      if (s.status === "approved") { a.revenue += s.sale_amount; a.approved += 1; }
      else if (s.status === "refunded") a.refunded += s.sale_amount;
      if (s.ad_name) a.linked += 1;
      return a;
    },
    { revenue: 0, refunded: 0, approved: 0, linked: 0 }
  );

  return { sales: enriched, products, totals, mock: false, currency: display, fx_usd_brl: fx };
}
