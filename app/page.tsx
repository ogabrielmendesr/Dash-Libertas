import { fetchDashboard } from "@/lib/data";
import { formatMoney, formatInt, formatDecimal } from "@/lib/currency";
import { resolveRange } from "@/lib/dateRange";
import { TopBar } from "@/components/TopBar";
import { KPICard } from "@/components/KPICard";
import { HourlyPerformanceChart } from "@/components/HourlyPerformanceChart";
import { SalesFeed } from "@/components/SalesFeed";
import { FunnelStrip } from "@/components/FunnelStrip";
import { AdsTable } from "@/components/AdsTable";
import { MockBanner } from "@/components/MockBanner";
import { DateRangeFilter } from "@/components/DateRangeFilter";

// Sempre renderiza com dados frescos
export const dynamic = "force-dynamic";

export default async function Page({
  searchParams,
}: {
  searchParams: { preset?: string; since?: string; until?: string };
}) {
  const range = resolveRange(searchParams);
  const data = await fetchDashboard({ since: range.since, until: range.until });
  const t = data.totals;

  // Séries para os sparklines
  const spendSeries = data.daily.map((d) => d.spend);
  const revenueSeries = data.daily.map((d) => d.revenue);
  const roasSeries = data.daily.map((d) => d.revenue / Math.max(1, d.spend));
  const profitSeries = data.daily.map((d) => d.revenue - d.spend);

  // Adapta o shape dos dados pros componentes existentes
  const chartData = data.daily.map((d) => ({
    date: d.date,
    label: formatDayLabel(d.date),
    spend: d.spend,
    revenue: d.revenue,
    sales: d.sales,
  }));

  const adsRows = data.ads.map((a) => ({
    campaign: a.campaign_name,
    adset: a.adset_name,
    ad: a.ad_name,
    adId: a.ad_id,
    spend: a.spend,
    impressions: a.impressions,
    linkClicks: a.link_clicks,
    pageViews: a.landing_page_views,
    initiateCheckouts: a.initiate_checkouts,
    sales: a.sales,
    revenue: a.revenue,
  }));

  const salesRows = data.recent_sales.map((s) => ({
    id: s.transaction_id ?? s.id,
    product: s.product_name,
    amount: s.sale_amount,
    status: s.status as "approved" | "pending" | "refunded",
    utmContent: s.utm_content ?? "",
    campaign: s.campaign_name ?? "—",
    ad: s.ad_name ?? "sem vínculo",
    when: s.sale_date ? formatHourMin(s.sale_date) : "—",
  }));

  const roas = t.spend > 0 ? t.revenue / t.spend : 0;
  const cpa = t.sales > 0 ? t.spend / t.sales : 0;
  const ticket = t.sales > 0 ? t.revenue / t.sales : 0;
  const profit = t.revenue - t.spend;

  const hasData = t.spend > 0 || t.revenue > 0;

  return (
    <main className="relative min-h-screen">
      <div className="aurora" aria-hidden />
      <div className="aurora-veil" aria-hidden />

      <div className="relative z-10">
        <TopBar />

        {data.mock && <MockBanner />}

        {/* Hero title */}
        <section className="px-4 sm:px-6 lg:px-8 pt-8 sm:pt-10 pb-5 sm:pb-6">
          <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-5 lg:gap-6">
            <div>
              <div className="flex items-center gap-2 mb-4">
                <DateRangeFilter
                  currentPreset={range.preset}
                  currentLabel={range.label}
                  since={range.since}
                  until={range.until}
                />
                <span className="text-[10px] font-mono uppercase tracking-[0.22em] text-white/35 hidden sm:inline">
                  {range.days === 1 ? "1 dia" : `${range.days} dias`}
                </span>
              </div>
              <h1 className="font-display text-[36px] sm:text-[48px] lg:text-[64px] leading-[0.95] tracking-tight text-white max-w-3xl">
                <span className="italic text-white/75">Cada real investido,</span>{" "}
                <span className="text-grad-aurora">rastreado até a venda.</span>
              </h1>
              <p className="mt-3 sm:mt-4 max-w-2xl text-[13px] sm:text-[15px] text-white/60">
                Cruzamos seus dados do Meta Ads com o webhook da Hotmart por{" "}
                <span className="font-mono text-white/85">ad.id ≡ utm_content</span>. ROAS, CPA e lucro reais — por anúncio, em tempo real.
              </p>
            </div>

            <div className="flex lg:flex-col items-start lg:items-end justify-between gap-3 lg:shrink-0">
              <div className="pill text-[10px] sm:text-[11px] font-mono uppercase tracking-[0.18em] text-white/70">
                <span className="dot text-emerald-400 bg-emerald-400" />
                <span>Saldo do período</span>
              </div>
              <div className="text-right">
                <div className="text-[10px] sm:text-[11px] uppercase tracking-[0.22em] font-mono text-white/40">
                  Lucro líquido
                </div>
                <div className="font-display text-[28px] sm:text-[36px] lg:text-[42px] leading-none tracking-tight text-grad-mint">
                  {formatMoney(profit, data.currency)}
                </div>
              </div>
            </div>
          </div>
        </section>

        {!hasData ? (
          <EmptyState />
        ) : (
          <>
            {/* KPI grid */}
            <section className="px-4 sm:px-6 lg:px-8 pb-5 sm:pb-6">
              <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4 sm:gap-5">
                <KPICard
                  label="Investido"
                  value={formatMoney(t.spend, data.currency)}
                  caption="vs. período anterior"
                  data={spendSeries.length > 0 ? spendSeries : [0]}
                  tint="amber"
                />
                <KPICard
                  label="Receita"
                  value={formatMoney(t.revenue, data.currency)}
                  caption="vendas aprovadas · Hotmart"
                  data={revenueSeries.length > 0 ? revenueSeries : [0]}
                  tint="mint"
                />
                <KPICard
                  label="ROAS"
                  value={`${formatDecimal(roas, 2, data.currency)}×`}
                  caption="receita ÷ investido"
                  data={roasSeries.length > 0 ? roasSeries : [0]}
                  tint="azure"
                />
                <KPICard
                  label="Lucro"
                  value={formatMoney(profit, data.currency)}
                  caption="receita − investido"
                  data={profitSeries.length > 0 ? profitSeries : [0]}
                  tint="violet"
                />
              </div>
            </section>

            {/* Mini stats strip */}
            <section className="px-4 sm:px-6 lg:px-8 pb-5 sm:pb-6">
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 sm:gap-4">
                <StatTile label="CPA" value={formatMoney(cpa, data.currency)} hint="custo por aquisição" tint="teal" icon="◎" />
                <StatTile label="Ticket médio" value={formatMoney(ticket, data.currency)} hint="receita ÷ vendas" tint="violet" icon="✦" />
                <StatTile label="Vendas no mês" value={formatInt(t.sales, data.currency)} hint="apenas aprovadas" tint="mint" icon="↑" />
                <StatTile label="Checkouts" value={formatInt(t.initiate_checkouts, data.currency)} hint="iniciados no Meta" tint="amber" icon="◐" />
                <StatTile label="Page Views" value={formatInt(t.landing_page_views, data.currency)} hint="visualizações de página" tint="azure" icon="◇" />
                <StatTile
                  label="CPM médio"
                  value={t.impressions > 0 ? formatMoney((t.spend / t.impressions) * 1000, data.currency) : "—"}
                  hint="custo por mil impressões"
                  tint="violet"
                  icon="◈"
                />
              </div>
            </section>

            {/* Funnel */}
            <section className="px-4 sm:px-6 lg:px-8 pb-5 sm:pb-6">
              <FunnelStrip
                impressions={t.impressions}
                linkClicks={t.link_clicks}
                pageViews={t.landing_page_views}
                checkouts={t.initiate_checkouts}
                sales={t.sales}
                currency={data.currency}
              />
            </section>

            {/* Chart + Feed */}
            <section className="px-4 sm:px-6 lg:px-8 pb-5 sm:pb-6">
              <div className="grid grid-cols-1 xl:grid-cols-3 gap-4 sm:gap-5 items-stretch">
                <div className="xl:col-span-2">
                  <HourlyPerformanceChart
                    data={data.hourly ?? []}
                    currency={data.currency}
                    rangeLabel={range.label}
                    maxHour={data.current_hour}
                  />
                </div>
                <div className="xl:col-span-1 h-full">
                  <SalesFeed sales={salesRows} currency={data.currency} />
                </div>
              </div>
            </section>

            {/* Big table */}
            <section className="px-4 sm:px-6 lg:px-8 pb-8 sm:pb-10">
              <AdsTable rows={adsRows} currency={data.currency} />
            </section>
          </>
        )}

        {/* Footer */}
        <footer className="px-4 sm:px-6 lg:px-8 pb-8 sm:pb-10">
          <div className="hr-glow mb-5 sm:mb-6" />
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 text-[11px] text-white/45">
            <div className="font-mono uppercase tracking-[0.22em]">Libertas · painel privado · v.026</div>
            <div className="font-mono">
              {data.mock ? (
                <span className="text-amber-300">⚠ dados de demonstração</span>
              ) : (
                <>Cruzamento ativo · <span className="text-white/70">{data.ads.length} anúncios</span></>
              )}
            </div>
          </div>
        </footer>
      </div>
    </main>
  );
}

function EmptyState() {
  return (
    <section className="px-4 sm:px-6 lg:px-8 pb-10">
      <div className="glass glass-tinted-violet sheen p-8 sm:p-12 text-center max-w-2xl mx-auto">
        <div className="font-display text-[28px] sm:text-[34px] text-white leading-tight">
          <span className="italic text-white/70">Nenhum dado ainda.</span>{" "}
          <span className="text-grad-aurora">Vamos conectar?</span>
        </div>
        <p className="mt-4 text-[14px] text-white/65 max-w-md mx-auto">
          Você ainda não conectou o Meta nem recebeu vendas pelo webhook. Comece pelas configurações.
        </p>
        <a
          href="/configuracoes"
          className="btn-glass btn-primary text-[13px] px-5 py-2.5 rounded-xl inline-flex items-center gap-2 mt-6"
        >
          Ir para Configurações
          <span>→</span>
        </a>
      </div>
    </section>
  );
}

type Tint = "pink" | "violet" | "teal" | "amber" | "mint" | "azure" | "rose";
const TINTS: Record<Tint, { color: string; glow: string; bar: string }> = {
  pink:   { color: "#ff3da3", glow: "rgba(255,61,163,0.32)",  bar: "linear-gradient(90deg, #ff7ab8, #ff3da3)" },
  violet: { color: "#a78bfa", glow: "rgba(139,92,246,0.32)",  bar: "linear-gradient(90deg, #c4b5fd, #8b5cf6)" },
  teal:   { color: "#2dd4bf", glow: "rgba(45,212,191,0.32)",  bar: "linear-gradient(90deg, #5eead4, #2dd4bf)" },
  amber:  { color: "#fbbf24", glow: "rgba(251,191,36,0.32)",  bar: "linear-gradient(90deg, #fcd34d, #fbbf24)" },
  mint:   { color: "#a3e635", glow: "rgba(163,230,53,0.32)",  bar: "linear-gradient(90deg, #d9f99d, #a3e635)" },
  azure:  { color: "#38bdf8", glow: "rgba(56,189,248,0.32)",  bar: "linear-gradient(90deg, #7dd3fc, #38bdf8)" },
  rose:   { color: "#fb7185", glow: "rgba(251,113,133,0.32)", bar: "linear-gradient(90deg, #fda4af, #fb7185)" },
};

function StatTile({ label, value, hint, tint, icon }: { label: string; value: string; hint?: string; tint: Tint; icon?: string }) {
  const tn = TINTS[tint];
  return (
    <div className="glass sheen p-4 relative overflow-hidden">
      <div
        className="absolute -top-12 -right-12 w-32 h-32 rounded-full pointer-events-none"
        style={{ background: `radial-gradient(circle, ${tn.glow} 0%, transparent 65%)`, filter: "blur(14px)" }}
      />
      <div className="relative flex items-start justify-between">
        <div className="text-[10px] uppercase tracking-[0.22em] font-mono text-white/55">{label}</div>
        {icon ? (
          <div className="text-[15px] leading-none -mt-0.5" style={{ color: tn.color, textShadow: `0 0 10px ${tn.glow}` }}>
            {icon}
          </div>
        ) : null}
      </div>
      <div className="mt-2.5 font-display text-[22px] sm:text-[26px] lg:text-[28px] leading-none tracking-tight text-white tabular-nums whitespace-nowrap">
        {value}
      </div>
      {hint ? <div className="mt-1 text-[11px] text-white/45">{hint}</div> : null}
    </div>
  );
}

function formatDayLabel(iso: string) {
  const d = new Date(iso);
  return `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}`;
}

function formatHourMin(iso: string) {
  const d = new Date(iso);
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}
