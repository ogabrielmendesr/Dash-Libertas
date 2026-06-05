import { PageShell } from "@/components/PageShell";
import { PageHeader } from "@/components/PageHeader";
import { MockBanner } from "@/components/MockBanner";
import { DateRangeFilter } from "@/components/DateRangeFilter";
import { fetchCampaigns } from "@/lib/data";
import { resolveRange } from "@/lib/dateRange";
import { CampanhasClient } from "./CampanhasClient";
import { SyncButton } from "./SyncButton";
import { formatMoney, formatInt, formatDecimal } from "@/lib/currency";

export const dynamic = "force-dynamic";

export default async function Page({
  searchParams,
}: {
  searchParams: { preset?: string; since?: string; until?: string };
}) {
  const range = resolveRange(searchParams);
  const data = await fetchCampaigns({ since: range.since, until: range.until });

  const totals = data.campaigns.reduce(
    (a, c) => ({
      spend: a.spend + c.agg.spend,
      revenue: a.revenue + c.agg.revenue,
      sales: a.sales + c.agg.sales,
    }),
    { spend: 0, revenue: 0, sales: 0 }
  );

  const totalProfit = totals.revenue - totals.spend;
  const totalMargin = totals.revenue > 0 ? ((totals.revenue - totals.spend) / totals.revenue) * 100 : 0;
  const totalBudget = data.campaigns.reduce((a, c) => a + (c.daily_budget ?? 0), 0);

  return (
    <PageShell>
      {data.mock && <MockBanner />}

      <PageHeader
        eyebrow={`Campanhas · ${data.campaigns.length} ativas`}
        title={
          <>
            <span className="italic text-white/75">Performance</span>{" "}
            <span className="text-grad-aurora">por estrutura.</span>
          </>
        }
        description={
          <>
            Abra qualquer campanha para ver os conjuntos, e qualquer conjunto para ver os anúncios.
            Clique no orçamento de uma campanha para editar diretamente pelo Meta.
          </>
        }
        actions={
          <>
            <DateRangeFilter
              currentPreset={range.preset}
              currentLabel={range.label}
              since={range.since}
              until={range.until}
            />
            <SyncButton />
          </>
        }
      />

      {/* Totals strip */}
      <section className="px-4 sm:px-6 lg:px-8 pb-5">
        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-3 sm:gap-4">
          <Mini label="Orçamento/dia" value={totalBudget > 0 ? formatMoney(totalBudget, data.currency) : "—"} tone="violet" />
          <Mini label="Investido" value={formatMoney(totals.spend, data.currency)} tone="amber" />
          <Mini label="Vendas" value={formatInt(totals.sales, data.currency)} tone="mint" />
          <Mini label="Faturamento" value={formatMoney(totals.revenue, data.currency)} tone="mint" />
          <Mini
            label="CPA"
            value={totals.sales > 0 ? formatMoney(totals.spend / totals.sales, data.currency) : "—"}
            tone="teal"
          />
          <Mini
            label="ROAS"
            value={totals.spend > 0 ? `${formatDecimal(totals.revenue / totals.spend, 2, data.currency)}×` : "—"}
            tone="azure"
          />
          <Mini label="Lucro" value={formatMoney(totalProfit, data.currency)} tone={totalProfit >= 0 ? "mint" : "rose"} />
          <Mini label="Margem" value={`${totalMargin.toFixed(1)}%`} tone={totalMargin >= 20 ? "azure" : "rose"} />
        </div>
      </section>

      <CampanhasClient campaigns={data.campaigns} currency={data.currency} isMock={data.mock} />
    </PageShell>
  );
}

function Mini({ label, value, tone }: { label: string; value: string; tone: "amber" | "mint" | "azure" | "violet" | "teal" | "rose" }) {
  const dotCls = {
    amber: "bg-amber-400 text-amber-400",
    mint: "bg-emerald-400 text-emerald-400",
    azure: "bg-sky-400 text-sky-400",
    violet: "bg-violet-400 text-violet-400",
    teal: "bg-teal-400 text-teal-400",
    rose: "bg-rose-400 text-rose-400",
  }[tone];
  return (
    <div className="glass p-4">
      <div className="flex items-center gap-2">
        <span className={`dot ${dotCls}`} />
        <span className="text-[10px] uppercase tracking-[0.22em] font-mono text-white/55">{label}</span>
      </div>
      <div className="mt-1.5 font-display text-[20px] sm:text-[24px] leading-none tracking-tight text-white tabular-nums whitespace-nowrap">
        {value}
      </div>
    </div>
  );
}
