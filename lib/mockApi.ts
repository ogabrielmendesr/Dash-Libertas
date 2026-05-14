/**
 * Versões mockadas dos endpoints, usadas como fallback enquanto o Supabase
 * não está configurado. Garante que o frontend nunca quebra.
 */

import { ADS, DAILY, SALES, AdRow } from "./mockData";

export function mockDashboard(days = 30) {
  // limita DAILY aos últimos N dias
  const daily = DAILY.slice(-days).map((d) => ({
    date: d.date,
    spend: d.spend,
    revenue: d.revenue,
    sales: d.sales,
  }));

  const ads = ADS.map((a: AdRow) => ({
    ad_id: a.adId,
    ad_name: a.ad,
    adset_id: `set-${a.adId.slice(-3)}`,
    adset_name: a.adset,
    campaign_id: `camp-${a.campaign.slice(0, 6)}`,
    campaign_name: a.campaign,
    spend: a.spend,
    impressions: a.impressions,
    link_clicks: a.linkClicks,
    landing_page_views: a.pageViews,
    initiate_checkouts: a.initiateCheckouts,
    sales: a.sales,
    revenue: a.revenue,
  }));

  const totals = ads.reduce(
    (acc, r) => ({
      spend: acc.spend + r.spend,
      impressions: acc.impressions + r.impressions,
      link_clicks: acc.link_clicks + r.link_clicks,
      landing_page_views: acc.landing_page_views + r.landing_page_views,
      initiate_checkouts: acc.initiate_checkouts + r.initiate_checkouts,
      sales: acc.sales + r.sales,
      revenue: acc.revenue + r.revenue,
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

  const recent_sales = SALES.map((s) => {
    const ad = ADS.find((a) => a.adId === s.utmContent);
    return {
      id: s.id,
      transaction_id: s.id,
      status: s.status,
      product_name: s.product,
      sale_amount: s.amount,
      utm_content: s.utmContent,
      sale_date: new Date().toISOString(),
      ad_name: ad?.ad ?? null,
      campaign_name: ad?.campaign ?? null,
    };
  });

  // Hourly cumulativo simulado: spend distribuído, revenue com picos por hora
  let spendCum = 0;
  let revCum = 0;
  const spendPerHour = totals.spend / 24;
  const hourly = Array.from({ length: 24 }, (_, h) => {
    spendCum += spendPerHour;
    // simula picos: 09h, 12h, 19h, 21h
    const surge = [9, 12, 19, 21].includes(h) ? 1.6 : 0.5;
    revCum += (totals.revenue / 24) * surge;
    return {
      hour: h,
      label: `${String(h).padStart(2, "0")}:00`,
      spend: spendCum,
      revenue: revCum,
      profit: revCum - spendCum,
    };
  });

  return {
    period: { since: "", until: "", days },
    totals,
    daily,
    ads,
    recent_sales,
    hourly,
  };
}

export function mockSales() {
  const products = Array.from(new Set(SALES.map((s) => s.product))).sort();
  const enriched = SALES.map((s) => {
    const ad = ADS.find((a) => a.adId === s.utmContent);
    return {
      id: s.id,
      transaction_id: s.id,
      status: s.status,
      product_name: s.product,
      sale_amount: s.amount,
      utm_content: s.utmContent,
      sale_date: new Date().toISOString(),
      ad_name: ad?.ad ?? null,
      campaign_name: ad?.campaign ?? null,
      buyer_email: null as string | null,
    };
  });
  const totals = enriched.reduce(
    (a, s) => {
      if (s.status === "approved") {
        a.revenue += s.sale_amount;
        a.approved += 1;
      } else if (s.status === "refunded") a.refunded += s.sale_amount;
      if (s.ad_name) a.linked += 1;
      return a;
    },
    { revenue: 0, refunded: 0, approved: 0, linked: 0 }
  );
  return { sales: enriched, products, totals };
}

export function mockCampaigns() {
  const map = new Map<
    string,
    {
      campaign_id: string;
      campaign_name: string;
      adsets: Map<
        string,
        { adset_id: string; adset_name: string; ads: typeof ADS }
      >;
    }
  >();

  for (const r of ADS) {
    if (!map.has(r.campaign)) {
      map.set(r.campaign, {
        campaign_id: `camp-${r.campaign.slice(0, 6)}`,
        campaign_name: r.campaign,
        adsets: new Map(),
      });
    }
    const c = map.get(r.campaign)!;
    if (!c.adsets.has(r.adset)) {
      c.adsets.set(r.adset, {
        adset_id: `set-${r.adset.slice(0, 6)}`,
        adset_name: r.adset,
        ads: [],
      });
    }
    c.adsets.get(r.adset)!.ads.push(r);
  }

  const addAd = (a: AdRow) => ({
    spend: a.spend,
    impressions: a.impressions,
    link_clicks: a.linkClicks,
    landing_page_views: a.pageViews,
    initiate_checkouts: a.initiateCheckouts,
    sales: a.sales,
    revenue: a.revenue,
  });
  const sum = <T extends Record<string, number>>(arr: T[]): T =>
    arr.reduce((acc, x) => {
      const next = { ...acc };
      for (const k of Object.keys(x)) (next as Record<string, number>)[k] = (acc[k] ?? 0) + x[k];
      return next as T;
    }, {} as T);

  const campaigns = Array.from(map.values()).map((c) => {
    const adsets = Array.from(c.adsets.values()).map((s) => {
      const ads = s.ads.map((a) => ({
        ad_id: a.adId,
        ad_name: a.ad,
        agg: addAd(a),
      }));
      const agg = sum(ads.map((x) => x.agg));
      return { adset_id: s.adset_id, adset_name: s.adset_name, agg, ads };
    });
    const agg = sum(adsets.map((x) => x.agg));
    return { campaign_id: c.campaign_id, campaign_name: c.campaign_name, agg, adsets };
  });

  return { period: { since: "", until: "", days: 30 }, campaigns };
}
