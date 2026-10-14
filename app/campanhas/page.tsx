import { PageShell } from "@/components/PageShell";
import { PageHeader } from "@/components/PageHeader";
import { MockBanner } from "@/components/MockBanner";
import { DateRangeFilter } from "@/components/DateRangeFilter";
import { fetchCampaigns } from "@/lib/data";
import { resolveRange } from "@/lib/dateRange";
import { CampanhasClient } from "./CampanhasClient";
import { SyncButton } from "./SyncButton";

export const dynamic = "force-dynamic";

export default async function Page({
  searchParams,
}: {
  searchParams: { preset?: string; since?: string; until?: string };
}) {
  const range = resolveRange(searchParams);
  const data = await fetchCampaigns({ since: range.since, until: range.until });

  const active = data.campaigns.filter((c) => c.status === "ACTIVE").length;

  return (
    <PageShell>
      {data.mock && <MockBanner />}

      <PageHeader
        eyebrow={`Campanhas · ${active} ativas · ${data.campaigns.length} com resultado no período`}
        title={
          <>
            <span className="italic text-white/75">Performance</span>{" "}
            <span className="text-grad-aurora">por estrutura.</span>
          </>
        }
        description={
          <>
            Abra qualquer campanha para ver os conjuntos, e qualquer conjunto para ver os anúncios.
            Troque a visão para comparar com o Gerenciador ou checar se o rastreamento está batendo.
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

      <CampanhasClient
        campaigns={data.campaigns}
        currency={data.currency}
        accountsCurrency={data.accounts_currency ?? null}
        unattributed={data.unattributed ?? { sales: 0, revenue: 0, without_ad_id: 0 }}
        isMock={data.mock}
      />
    </PageShell>
  );
}
