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

/**
 * Pega tabela de fx_rates (currency → USD rate). 1 USD = X moeda.
 * Usado pra converter vendas em moedas regionais (CLP, MXN, etc.) pra USD primeiro,
 * antes de converter pro display.
 */
async function getFxTable(): Promise<Map<string, number>> {
  if (useMockData()) return new Map([["USD", 1], ["BRL", 5]]);
  const sb = supabaseAdmin();
  const { data } = await sb.from("fx_rates").select("currency, usd_rate");
  const map = new Map<string, number>();
  for (const r of data ?? []) {
    map.set(r.currency, Number(r.usd_rate));
  }
  return map;
}

/**
 * Converte um valor de qualquer moeda regional pra display (BRL ou USD).
 * 1) moeda → USD (dividindo pela rate)
 * 2) USD → display (via convertAmount)
 *
 * FALLBACK: usado quando não temos os valores convertidos pela Hotmart.
 * Quando temos `producer_amount_brl`/`producer_amount_usd`, preferimos esses.
 */
function convertAnyToDisplay(
  value: number,
  fromCurrency: string,
  display: Currency,
  fxUsdBrl: number,
  fxTable: Map<string, number>
): number {
  if (!Number.isFinite(value)) return 0;
  const rate = fxTable.get(fromCurrency) ?? 1;
  const inUsd = value / (rate || 1);
  return convertAmount(inUsd, "USD", display, fxUsdBrl);
}

/**
 * Retorna o valor da venda na moeda do display, preferindo os valores que a
 * Hotmart já enviou convertidos (mais precisos que nossa tabela fx_rates).
 *
 * Prioridade:
 *  - BRL: producer_amount_brl  > fallback (converte sale_amount × fx_rates × fxUsdBrl)
 *  - USD: producer_amount_usd  > fallback
 */
function saleAmountInDisplay(
  s: {
    sale_amount: number;
    currency: string | null;
    producer_amount_brl?: number | null;
    producer_amount_usd?: number | null;
  },
  display: Currency,
  fxUsdBrl: number,
  fxTable: Map<string, number>
): number {
  if (display === "BRL" && s.producer_amount_brl != null) {
    return Number(s.producer_amount_brl);
  }
  if (display === "USD" && s.producer_amount_usd != null) {
    return Number(s.producer_amount_usd);
  }
  // Fallback: converte pelo nosso fx_rates (vendas antigas sem producer fields)
  const saleCurr = String(s.currency ?? "BRL");
  return convertAnyToDisplay(Number(s.sale_amount), saleCurr, display, fxUsdBrl, fxTable);
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

export type MethodBreakdown = {
  method: string;
  total: number;
  approved: number;
  rate: number;
};

export type DashboardData = ReturnType<typeof mockDashboard> & {
  mock?: boolean;
  currency: Currency;
  fx_usd_brl?: number;
  hourly?: HourlyPoint[];
  current_hour?: number;
  unique_buyers?: number;
  arpu?: number;
  approval_rate?: number;
  method_breakdown?: MethodBreakdown[];
};

export async function fetchDashboard(
  range: { since: string; until: string } = defaultRange()
): Promise<DashboardData> {
  const days = computeDays(range.since, range.until);
  if (useMockData()) return { ...mockDashboard(days), mock: true, currency: "BRL" };

  const { display_currency: display, fx_usd_brl: fx } = await getSettings();
  const fxTable = await getFxTable();
  const sb = supabaseAdmin();
  const sinceStr = range.since;
  const untilStr = range.until;

  // 1) Pega contas habilitadas (currency map)
  const { data: enabledAccounts } = await sb
    .from("fb_ad_accounts")
    .select("ad_account_id, currency")
    .eq("is_enabled", true);
  const enabledIds = (enabledAccounts ?? []).map((a) => a.ad_account_id);
  const currencyByAccount = new Map<string, string>(
    (enabledAccounts ?? []).map((a) => [a.ad_account_id, a.currency])
  );

  // 2) Insights do Meta no período, apenas das contas habilitadas
  const { data: insightRows } = enabledIds.length === 0 ? { data: [] } :
    await sb
      .from("fb_ad_insights")
      .select(`
        ad_id, ad_name, adset_id, adset_name, campaign_id, campaign_name,
        ad_account_id, date, spend, impressions, link_clicks,
        landing_page_views, initiate_checkouts
      `)
      .in("ad_account_id", enabledIds)
      .gte("date", sinceStr)
      .lte("date", untilStr);

  // 2) Vendas no período (TODAS, cruzaremos depois)
  const { data: salesRange } = await sb
    .from("sales")
    .select("utm_content, sale_amount, currency, producer_amount_usd, producer_amount_brl, status, sale_date, buyer_email, payment_method")
    .gte("sale_date", `${sinceStr}T00:00:00-03:00`)
    .lte("sale_date", `${untilStr}T23:59:59.999-03:00`);

  // 3) Agrega vendas APROVADAS por ad_id (utm_content), convertendo cada uma pra display
  const salesByAd = new Map<string, { count: number; revenue: number }>();
  for (const s of salesRange ?? []) {
    if (s.status !== "approved" || !s.utm_content) continue;
    const revInDisplay = saleAmountInDisplay(s as any, display, fx, fxTable);
    const prev = salesByAd.get(s.utm_content) ?? { count: 0, revenue: 0 };
    prev.count += 1;
    prev.revenue += revInDisplay;
    salesByAd.set(s.utm_content, prev);
  }

  // 4) Construir o "list" no formato esperado, cruzando insight + vendas por ad_id apenas
  type InsightRow = {
    ad_id: string; ad_name: string;
    adset_id: string; adset_name: string;
    campaign_id: string; campaign_name: string;
    ad_account_id: string; date: string;
    spend: number; impressions: number; link_clicks: number;
    landing_page_views: number; initiate_checkouts: number;
  };
  // Distribui as vendas por ad_id em apenas UM dia (o último dia do range com insight)
  // pra evitar duplicação no agregado por dia. O cruzamento ad_id × revenue é total no período.
  const rawInsights = (insightRows ?? []) as unknown as InsightRow[];
  const lastDayPerAd = new Map<string, string>();
  for (const r of rawInsights) {
    const cur = lastDayPerAd.get(r.ad_id);
    if (!cur || r.date > cur) lastDayPerAd.set(r.ad_id, r.date);
  }

  type Row = InsightRow & {
    ad_account_currency: string;
    spend_disp: number;
    revenue_disp: number;
    sales_total: number;
  };
  const converted: Row[] = rawInsights.map((r) => {
    const adCurrency = ((currencyByAccount.get(r.ad_account_id) as Currency) ?? "BRL") as Currency;
    const spend = convertAmount(Number(r.spend), adCurrency, display, fx);
    // Anexa as vendas só no "último dia" do anúncio dentro do range, pra somar no total certo
    const isLastDay = lastDayPerAd.get(r.ad_id) === r.date;
    const adSales = isLastDay ? salesByAd.get(r.ad_id) : undefined;
    return {
      ...r,
      ad_account_currency: adCurrency,
      spend_disp: spend,
      revenue_disp: adSales?.revenue ?? 0,
      sales_total: adSales?.count ?? 0,
    };
  });

  // Adiciona "ads sem insight no período mas com vendas no período" (vendas fantasma)
  // Não criamos linha pra esses casos por enquanto — eles aparecem em /vendas como órfãos visuais
  // mas o ROAS por ad só conta quando há gasto.

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
  // ARPU + Taxa de aprovação por método de pagamento
  // ============================================================
  // ARPU = receita / compradores únicos (mesmo comprador comprando 2x conta 1 user)
  // Taxa de aprovação = approved / (approved + refunded + chargeback + cancelled)
  // ============================================================
  const uniqueBuyers = new Set<string>();
  let approvedRevenueInDisplay = 0;
  let approvedCount = 0;
  let nonApprovedCount = 0;
  const byMethod = new Map<string, { total: number; approved: number }>();

  for (const s of salesRange ?? []) {
    const method = (s as any).payment_method as string | null;
    if (method) {
      const cur = byMethod.get(method) ?? { total: 0, approved: 0 };
      cur.total += 1;
      if (s.status === "approved") cur.approved += 1;
      byMethod.set(method, cur);
    }
    if (s.status === "approved") {
      approvedCount += 1;
      const email = (s as any).buyer_email as string | null;
      if (email) uniqueBuyers.add(email);
      approvedRevenueInDisplay += saleAmountInDisplay(s as any, display, fx, fxTable);
    } else if (["refunded", "chargeback", "cancelled"].includes(s.status as string)) {
      nonApprovedCount += 1;
    }
  }

  const arpu = uniqueBuyers.size > 0 ? approvedRevenueInDisplay / uniqueBuyers.size : 0;
  const totalStatusedTxn = approvedCount + nonApprovedCount;
  const approvalRate = totalStatusedTxn > 0 ? approvedCount / totalStatusedTxn : 1;
  const methodBreakdown = Array.from(byMethod.entries())
    .map(([method, v]) => ({
      method,
      total: v.total,
      approved: v.approved,
      rate: v.total > 0 ? v.approved / v.total : 0,
    }))
    .sort((a, b) => b.total - a.total);

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
    .select("sale_amount, currency, producer_amount_usd, producer_amount_brl, sale_date, status")
    .gte("sale_date", `${sinceStr}T00:00:00-03:00`)
    .lte("sale_date", `${untilStr}T23:59:59.999-03:00`);

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
    hourRevenueBuckets[hourNum] += saleAmountInDisplay(s as any, display, fx, fxTable);
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
    .select("id, transaction_id, status, product_name, sale_amount, currency, producer_amount_usd, producer_amount_brl, utm_content, sale_date")
    .order("sale_date", { ascending: false })
    .limit(24);

  const adById = new Map(ads.map((a) => [a.ad_id, a]));
  const recent_sales = (recentSales ?? []).map((s) => {
    const ad = s.utm_content ? adById.get(s.utm_content) : undefined;
    const saleCurr = String(s.currency ?? "BRL");
    const displayedAmount = saleAmountInDisplay(s as any, display, fx, fxTable);
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
    unique_buyers: uniqueBuyers.size,
    arpu,
    approval_rate: approvalRate,
    method_breakdown: methodBreakdown,
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
  const fxTable = await getFxTable();
  const sb = supabaseAdmin();
  const sinceStr = range.since;
  const untilStr = range.until;

  // Contas habilitadas
  const { data: enabledAccs } = await sb
    .from("fb_ad_accounts")
    .select("ad_account_id, currency")
    .eq("is_enabled", true);
  const enabledIds2 = (enabledAccs ?? []).map((a) => a.ad_account_id);
  const currencyByAcc = new Map<string, string>(
    (enabledAccs ?? []).map((a) => [a.ad_account_id, a.currency])
  );

  const { data: insightRows } = enabledIds2.length === 0 ? { data: [] } :
    await sb
      .from("fb_ad_insights")
      .select(`
        ad_id, ad_name, adset_id, adset_name, campaign_id, campaign_name,
        ad_account_id, date, spend, impressions, link_clicks,
        landing_page_views, initiate_checkouts
      `)
      .in("ad_account_id", enabledIds2)
      .gte("date", sinceStr)
      .lte("date", untilStr);

  // Vendas no período
  const { data: salesRange } = await sb
    .from("sales")
    .select("utm_content, sale_amount, currency, producer_amount_usd, producer_amount_brl, status")
    .gte("sale_date", `${sinceStr}T00:00:00-03:00`)
    .lte("sale_date", `${untilStr}T23:59:59.999-03:00`);

  const salesByAd = new Map<string, { count: number; revenue: number }>();
  for (const s of salesRange ?? []) {
    if (s.status !== "approved" || !s.utm_content) continue;
    const revInDisplay = saleAmountInDisplay(s as any, display, fx, fxTable);
    const prev = salesByAd.get(s.utm_content) ?? { count: 0, revenue: 0 };
    prev.count += 1;
    prev.revenue += revInDisplay;
    salesByAd.set(s.utm_content, prev);
  }

  type Agg = { spend: number; impressions: number; link_clicks: number; landing_page_views: number; initiate_checkouts: number; sales: number; revenue: number };
  const empty = (): Agg => ({ spend: 0, impressions: 0, link_clicks: 0, landing_page_views: 0, initiate_checkouts: 0, sales: 0, revenue: 0 });

  // Primeiro agrega por ad_id (somando spend de todos os dias)
  type AdAcc = { ad_id: string; ad_name: string; adset_id: string; adset_name: string; campaign_id: string; campaign_name: string; agg: Agg };
  const adsByAdId = new Map<string, AdAcc>();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  for (const r of (insightRows ?? []) as any[]) {
    const adCurrency: Currency = ((currencyByAcc.get(r.ad_account_id) as Currency) ?? "BRL");
    const spend = convertAmount(Number(r.spend), adCurrency, display, fx);
    const cur = adsByAdId.get(r.ad_id) ?? {
      ad_id: r.ad_id,
      ad_name: r.ad_name,
      adset_id: r.adset_id,
      adset_name: r.adset_name,
      campaign_id: r.campaign_id,
      campaign_name: r.campaign_name,
      agg: empty(),
    };
    cur.agg.spend += spend;
    cur.agg.impressions += Number(r.impressions);
    cur.agg.link_clicks += Number(r.link_clicks);
    cur.agg.landing_page_views += Number(r.landing_page_views);
    cur.agg.initiate_checkouts += Number(r.initiate_checkouts);
    adsByAdId.set(r.ad_id, cur);
  }
  // Anexa vendas (cruzamento por ad_id apenas) — total no período
  for (const [adId, ad] of adsByAdId) {
    const sales = salesByAd.get(adId);
    if (sales) {
      ad.agg.sales = sales.count;
      ad.agg.revenue = sales.revenue;
    }
  }

  const tree = new Map<string, { campaign_id: string; campaign_name: string; agg: Agg; adsets: Map<string, { adset_id: string; adset_name: string; agg: Agg; ads: Map<string, { ad_id: string; ad_name: string; agg: Agg }> }> }>();
  const sumAgg = (a: Agg, b: Agg): Agg => ({
    spend: a.spend + b.spend,
    impressions: a.impressions + b.impressions,
    link_clicks: a.link_clicks + b.link_clicks,
    landing_page_views: a.landing_page_views + b.landing_page_views,
    initiate_checkouts: a.initiate_checkouts + b.initiate_checkouts,
    sales: a.sales + b.sales,
    revenue: a.revenue + b.revenue,
  });
  for (const ad of adsByAdId.values()) {
    if (!tree.has(ad.campaign_id)) tree.set(ad.campaign_id, { campaign_id: ad.campaign_id, campaign_name: ad.campaign_name, agg: empty(), adsets: new Map() });
    const c = tree.get(ad.campaign_id)!;
    c.agg = sumAgg(c.agg, ad.agg);
    if (!c.adsets.has(ad.adset_id)) c.adsets.set(ad.adset_id, { adset_id: ad.adset_id, adset_name: ad.adset_name, agg: empty(), ads: new Map() });
    const s = c.adsets.get(ad.adset_id)!;
    s.agg = sumAgg(s.agg, ad.agg);
    s.ads.set(ad.ad_id, { ad_id: ad.ad_id, ad_name: ad.ad_name, agg: ad.agg });
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
export type SalesBreakdownRow = { name: string; count: number; revenue: number };

export type SalesData = ReturnType<typeof mockSales> & {
  mock?: boolean;
  currency: Currency;
  fx_usd_brl?: number;
  breakdowns?: {
    by_placement: SalesBreakdownRow[];
    by_product: SalesBreakdownRow[];
    by_payment: SalesBreakdownRow[];
    by_traffic: SalesBreakdownRow[];
  };
};

export async function fetchSales(
  range?: { since: string; until: string }
): Promise<SalesData> {
  if (useMockData()) return { ...mockSales(), mock: true, currency: "BRL" };

  const { display_currency: display, fx_usd_brl: fx } = await getSettings();
  const fxTable = await getFxTable();
  const sb = supabaseAdmin();
  let q = sb
    .from("sales")
    .select("id, transaction_id, status, product_name, sale_amount, currency, producer_amount_usd, producer_amount_brl, utm_content, sale_date, buyer_email, payment_method, placement, traffic_source")
    .order("sale_date", { ascending: false })
    .limit(200);

  if (range) {
    // sale_date é timestamptz — filtra do início do "since" até o fim do "until"
    q = q.gte("sale_date", `${range.since}T00:00:00-03:00`).lte("sale_date", `${range.until}T23:59:59.999-03:00`);
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
    const saleCurr = String(s.currency ?? "BRL");
    const displayedAmount = saleAmountInDisplay(s as any, display, fx, fxTable);
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

  // Agregadores
  const byPlacement = new Map<string, SalesBreakdownRow>();
  const byProduct = new Map<string, SalesBreakdownRow>();
  const byPayment = new Map<string, SalesBreakdownRow>();
  const byTraffic = new Map<string, SalesBreakdownRow>();

  let revenue = 0;
  let refunded = 0;
  let approved = 0;
  let linked = 0;
  let organic = 0;
  let paid = 0;

  for (const s of enriched) {
    if (s.status === "approved") {
      revenue += s.sale_amount;
      approved += 1;
      if (s.ad_name) linked += 1;

      const traffic = (s as any).traffic_source as string | null;
      if (traffic === "paid_fb") paid += 1;
      else organic += 1;

      // Breakdowns só pra aprovadas (representam dinheiro entrando)
      const placementKey = (s as any).placement || "Sem placement";
      const placementCur = byPlacement.get(placementKey) ?? { name: placementKey, count: 0, revenue: 0 };
      placementCur.count += 1;
      placementCur.revenue += s.sale_amount;
      byPlacement.set(placementKey, placementCur);

      const productKey = s.product_name || "Sem produto";
      const productCur = byProduct.get(productKey) ?? { name: productKey, count: 0, revenue: 0 };
      productCur.count += 1;
      productCur.revenue += s.sale_amount;
      byProduct.set(productKey, productCur);

      const paymentKey = (s as any).payment_method || "Desconhecido";
      const paymentCur = byPayment.get(paymentKey) ?? { name: paymentKey, count: 0, revenue: 0 };
      paymentCur.count += 1;
      paymentCur.revenue += s.sale_amount;
      byPayment.set(paymentKey, paymentCur);

      const trafficKey = traffic || "organic";
      const trafficCur = byTraffic.get(trafficKey) ?? { name: trafficKey, count: 0, revenue: 0 };
      trafficCur.count += 1;
      trafficCur.revenue += s.sale_amount;
      byTraffic.set(trafficKey, trafficCur);
    } else if (s.status === "refunded") {
      refunded += s.sale_amount;
    }
  }

  const sortByCount = (a: SalesBreakdownRow, b: SalesBreakdownRow) => b.count - a.count;
  const breakdowns = {
    by_placement: Array.from(byPlacement.values()).sort(sortByCount),
    by_product: Array.from(byProduct.values()).sort(sortByCount),
    by_payment: Array.from(byPayment.values()).sort(sortByCount),
    by_traffic: Array.from(byTraffic.values()).sort(sortByCount),
  };

  const totals = { revenue, refunded, approved, linked, organic, paid };

  return {
    sales: enriched,
    products,
    totals,
    breakdowns,
    mock: false,
    currency: display,
    fx_usd_brl: fx,
  };
}
