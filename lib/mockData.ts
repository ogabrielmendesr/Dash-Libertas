export type AdRow = {
  campaign: string;
  adset: string;
  ad: string;
  adId: string;
  spend: number;
  impressions: number;
  linkClicks: number;
  pageViews: number;
  initiateCheckouts: number;
  sales: number;
  revenue: number;
};

export const ADS: AdRow[] = [
  {
    campaign: "Black Friday — Vendas Diretas",
    adset: "LAL 1% Compradores 30d",
    ad: "VSL 02 — Hook Aristocrata",
    adId: "23857391022040123",
    spend: 1842.55,
    impressions: 142_330,
    linkClicks: 3_412,
    pageViews: 2_801,
    initiateCheckouts: 642,
    sales: 187,
    revenue: 18_703.30,
  },
  {
    campaign: "Black Friday — Vendas Diretas",
    adset: "Interesse — Investidores",
    ad: "Imagem 04 — Cofre",
    adId: "23857391022040187",
    spend: 1124.10,
    impressions: 98_222,
    linkClicks: 2_103,
    pageViews: 1_722,
    initiateCheckouts: 418,
    sales: 96,
    revenue: 9_408.00,
  },
  {
    campaign: "Captação — Lista VIP",
    adset: "Broad — Brasil",
    ad: "Carrossel 01 — Manuscrito",
    adId: "23857391022040244",
    spend: 678.40,
    impressions: 61_904,
    linkClicks: 1_504,
    pageViews: 1_198,
    initiateCheckouts: 211,
    sales: 41,
    revenue: 3_977.00,
  },
  {
    campaign: "Captação — Lista VIP",
    adset: "Retargeting — Page View 7d",
    ad: "VSL 01 — Promessa",
    adId: "23857391022040301",
    spend: 432.18,
    impressions: 28_440,
    linkClicks: 988,
    pageViews: 812,
    initiateCheckouts: 188,
    sales: 53,
    revenue: 5_141.00,
  },
  {
    campaign: "Perene — Curso Mestre",
    adset: "Interesse — Educação Financeira",
    ad: "Depoimento 03 — Cliente",
    adId: "23857391022040399",
    spend: 1290.77,
    impressions: 87_115,
    linkClicks: 2_745,
    pageViews: 2_220,
    initiateCheckouts: 502,
    sales: 124,
    revenue: 12_028.00,
  },
  {
    campaign: "Perene — Curso Mestre",
    adset: "LAL 3% Lista de Email",
    ad: "Estática 07 — Selo de Cera",
    adId: "23857391022040422",
    spend: 540.92,
    impressions: 41_300,
    linkClicks: 1_021,
    pageViews: 854,
    initiateCheckouts: 162,
    sales: 28,
    revenue: 2_716.00,
  },
  {
    campaign: "Frio — Topo de Funil",
    adset: "Broad — 25-55",
    ad: "Carrossel 02 — Página dos Livros",
    adId: "23857391022040488",
    spend: 920.65,
    impressions: 152_044,
    linkClicks: 1_788,
    pageViews: 1_402,
    initiateCheckouts: 224,
    sales: 31,
    revenue: 3_007.00,
  },
];

export type DailyPoint = {
  date: string; // ISO date
  label: string; // dd/MM
  spend: number;
  revenue: number;
  sales: number;
};

const seed = (i: number) => (Math.sin(i * 12.9898) * 43758.5453) % 1;
const rand = (i: number) => Math.abs(seed(i));

export const DAILY: DailyPoint[] = Array.from({ length: 28 }).map((_, i) => {
  const d = new Date();
  d.setDate(d.getDate() - (27 - i));
  const base = 220 + rand(i + 3) * 320;
  const spend = Math.round(base * 100) / 100;
  const roas = 2.1 + rand(i + 7) * 4.2;
  const revenue = Math.round(spend * roas * 100) / 100;
  const sales = Math.max(1, Math.round(revenue / (78 + rand(i + 2) * 60)));
  const dd = String(d.getDate()).padStart(2, "0");
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  return {
    date: d.toISOString().slice(0, 10),
    label: `${dd}/${mm}`,
    spend,
    revenue,
    sales,
  };
});

export type Sale = {
  id: string;
  product: string;
  amount: number;
  status: "approved" | "pending" | "refunded";
  utmContent: string;
  campaign: string;
  ad: string;
  when: string;
};

const PRODUCTS = [
  "Mestre do Capital — Anual",
  "Caderno do Banqueiro",
  "Curso da Renda Passiva",
  "Mentoria Privada — Trimestre",
  "Workshop Black Tie",
];

const STATUSES: Sale["status"][] = ["approved", "approved", "approved", "approved", "pending", "refunded"];

export const SALES: Sale[] = Array.from({ length: 24 }).map((_, i) => {
  const ad = ADS[Math.floor(rand(i + 11) * ADS.length)];
  const prod = PRODUCTS[Math.floor(rand(i + 12) * PRODUCTS.length)];
  const minutesAgo = Math.floor(rand(i + 14) * 60 * 18);
  const d = new Date(Date.now() - minutesAgo * 60_000);
  const hh = String(d.getHours()).padStart(2, "0");
  const mm = String(d.getMinutes()).padStart(2, "0");
  return {
    id: `TX-${(982341 + i).toString(36).toUpperCase()}`,
    product: prod,
    amount: Math.round((49 + rand(i + 21) * 280) * 100) / 100,
    status: STATUSES[Math.floor(rand(i + 15) * STATUSES.length)],
    utmContent: ad.adId,
    campaign: ad.campaign,
    ad: ad.ad,
    when: `${hh}:${mm}`,
  };
});

export function totals(rows: AdRow[]) {
  const t = rows.reduce(
    (a, r) => ({
      spend: a.spend + r.spend,
      impressions: a.impressions + r.impressions,
      linkClicks: a.linkClicks + r.linkClicks,
      pageViews: a.pageViews + r.pageViews,
      initiateCheckouts: a.initiateCheckouts + r.initiateCheckouts,
      sales: a.sales + r.sales,
      revenue: a.revenue + r.revenue,
    }),
    { spend: 0, impressions: 0, linkClicks: 0, pageViews: 0, initiateCheckouts: 0, sales: 0, revenue: 0 }
  );
  const roas = t.revenue / t.spend;
  const cpa = t.spend / t.sales;
  const profit = t.revenue - t.spend;
  const ticket = t.revenue / t.sales;
  return { ...t, roas, cpa, profit, ticket };
}

export const BRL = (n: number) =>
  n.toLocaleString("pt-BR", { style: "currency", currency: "BRL", minimumFractionDigits: 2 });

export const INT = (n: number) => n.toLocaleString("pt-BR");
export const DEC = (n: number, d = 2) =>
  n.toLocaleString("pt-BR", { minimumFractionDigits: d, maximumFractionDigits: d });
