import { PageShell } from "@/components/PageShell";
import { PageHeader } from "@/components/PageHeader";
import { MockBanner } from "@/components/MockBanner";
import { DateRangeFilter } from "@/components/DateRangeFilter";
import { fetchSales } from "@/lib/data";
import { resolveRange } from "@/lib/dateRange";
import { VendasClient } from "./VendasClient";

export const dynamic = "force-dynamic";

export default async function Page({
  searchParams,
}: {
  searchParams: { preset?: string; since?: string; until?: string };
}) {
  const range = resolveRange(searchParams);
  const data = await fetchSales({ since: range.since, until: range.until });

  return (
    <PageShell>
      {data.mock && <MockBanner />}

      <PageHeader
        eyebrow={`Vendas · ${data.sales.length} registros`}
        title={
          <>
            <span className="italic text-white/75">Cada venda,</span>{" "}
            <span className="text-grad-aurora">com o anúncio que a originou.</span>
          </>
        }
        description={
          <>
            Cada linha cruza o <span className="font-mono text-white/85">utm_content</span> que volta no
            webhook da Hotmart com o <span className="font-mono text-white/85">ad.id</span> dos insights
            do Meta.
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
            <button className="btn-glass text-[12px] px-3.5 py-2 rounded-xl">Exportar CSV</button>
          </>
        }
      />

      <VendasClient initial={data} currency={data.currency} />
    </PageShell>
  );
}
