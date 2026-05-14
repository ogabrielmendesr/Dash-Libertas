"use client";

import { useState } from "react";
import { formatMoney, formatInt, formatDecimal, Currency } from "@/lib/currency";

type Agg = {
  spend: number;
  impressions: number;
  link_clicks: number;
  landing_page_views: number;
  initiate_checkouts: number;
  sales: number;
  revenue: number;
};

type CampaignNode = {
  campaign_id: string;
  campaign_name: string;
  agg: Agg;
  adsets: Array<{
    adset_id: string;
    adset_name: string;
    agg: Agg;
    ads: Array<{ ad_id: string; ad_name: string; agg: Agg }>;
  }>;
};

export function CampanhasClient({ campaigns, currency }: { campaigns: CampaignNode[]; currency: Currency }) {
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const toggle = (k: string) =>
    setExpanded((s) => {
      const next = new Set(s);
      next.has(k) ? next.delete(k) : next.add(k);
      return next;
    });

  return (
    <section className="px-4 sm:px-6 lg:px-8 pb-10">
      <div className="glass sheen p-3 sm:p-4">
        <div className="overflow-x-auto scrollbar-thin">
          <div className="min-w-[920px]">
            <div className="grid grid-cols-[1fr_110px_90px_90px_90px_110px_90px] gap-2 px-3 py-2 text-[10px] font-mono uppercase tracking-[0.16em] text-white/45 border-b border-white/10">
              <div>Estrutura</div>
              <div className="text-right">Gasto</div>
              <div className="text-right">Cliques</div>
              <div className="text-right">Checkouts</div>
              <div className="text-right">Vendas</div>
              <div className="text-right">Receita</div>
              <div className="text-right">ROAS</div>
            </div>

            {campaigns.length === 0 && (
              <div className="px-3 py-10 text-center text-white/45 text-[13px]">
                Nenhuma campanha sincronizada ainda. Vá em{" "}
                <a href="/configuracoes" className="underline text-white">Configurações</a> e conecte o Meta.
              </div>
            )}

            {campaigns.map((c) => {
              const cKey = `c:${c.campaign_id}`;
              const cOpen = expanded.has(cKey);
              const cRoas = c.agg.spend > 0 ? c.agg.revenue / c.agg.spend : 0;
              return (
                <div key={c.campaign_id} className="border-b border-white/[0.06] last:border-0">
                  <button
                    onClick={() => toggle(cKey)}
                    className="w-full grid grid-cols-[1fr_110px_90px_90px_90px_110px_90px] gap-2 px-3 py-3 hover:bg-white/[0.03] text-left"
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <Caret open={cOpen} />
                      <span className="font-display text-[15px] text-white truncate">{c.campaign_name}</span>
                      <span className="text-[10px] font-mono uppercase tracking-[0.16em] text-white/45 whitespace-nowrap">
                        {c.adsets.length} conjuntos
                      </span>
                    </div>
                    <Cell value={formatMoney(c.agg.spend, currency)} />
                    <Cell value={formatInt(c.agg.link_clicks, currency)} muted />
                    <Cell value={formatInt(c.agg.initiate_checkouts, currency)} muted />
                    <Cell value={formatInt(c.agg.sales, currency)} accent="mint" />
                    <Cell value={formatMoney(c.agg.revenue, currency)} />
                    <RoasBadge value={cRoas} currency={currency} />
                  </button>

                  {cOpen && (
                    <div className="bg-white/[0.02]">
                      {c.adsets.map((s) => {
                        const sKey = `s:${c.campaign_id}:${s.adset_id}`;
                        const sOpen = expanded.has(sKey);
                        const sRoas = s.agg.spend > 0 ? s.agg.revenue / s.agg.spend : 0;
                        return (
                          <div key={s.adset_id} className="border-t border-white/[0.05]">
                            <button
                              onClick={() => toggle(sKey)}
                              className="w-full grid grid-cols-[1fr_110px_90px_90px_90px_110px_90px] gap-2 px-3 py-2.5 pl-9 hover:bg-white/[0.03] text-left"
                            >
                              <div className="flex items-center gap-2 min-w-0">
                                <Caret open={sOpen} small />
                                <span className="italic font-display text-[13.5px] text-white/85 truncate">
                                  {s.adset_name}
                                </span>
                                <span className="text-[10px] font-mono uppercase tracking-[0.16em] text-white/40 whitespace-nowrap">
                                  {s.ads.length} anúncios
                                </span>
                              </div>
                              <Cell value={formatMoney(s.agg.spend, currency)} />
                              <Cell value={formatInt(s.agg.link_clicks, currency)} muted />
                              <Cell value={formatInt(s.agg.initiate_checkouts, currency)} muted />
                              <Cell value={formatInt(s.agg.sales, currency)} accent="mint" />
                              <Cell value={formatMoney(s.agg.revenue, currency)} />
                              <RoasBadge value={sRoas} currency={currency} />
                            </button>

                            {sOpen && (
                              <div>
                                {s.ads.map((ad) => {
                                  const aRoas = ad.agg.spend > 0 ? ad.agg.revenue / ad.agg.spend : 0;
                                  return (
                                    <div
                                      key={ad.ad_id}
                                      className="grid grid-cols-[1fr_110px_90px_90px_90px_110px_90px] gap-2 px-3 py-2.5 pl-16 border-t border-white/[0.04] bg-white/[0.015]"
                                    >
                                      <div className="min-w-0">
                                        <div className="text-[13px] text-white truncate">{ad.ad_name}</div>
                                        <div className="text-[10px] font-mono text-white/40 truncate">
                                          ad.id {ad.ad_id}
                                        </div>
                                      </div>
                                      <Cell value={formatMoney(ad.agg.spend, currency)} small />
                                      <Cell value={formatInt(ad.agg.link_clicks, currency)} small muted />
                                      <Cell value={formatInt(ad.agg.initiate_checkouts, currency)} small muted />
                                      <Cell value={formatInt(ad.agg.sales, currency)} small accent="mint" />
                                      <Cell value={formatMoney(ad.agg.revenue, currency)} small />
                                      <RoasBadge value={aRoas} small currency={currency} />
                                    </div>
                                  );
                                })}
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </section>
  );
}

function Caret({ open, small }: { open: boolean; small?: boolean }) {
  return (
    <svg
      width={small ? 10 : 12}
      height={small ? 10 : 12}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.5"
      className={`text-white/55 transition-transform ${open ? "rotate-90" : ""}`}
    >
      <path d="M9 6l6 6-6 6" />
    </svg>
  );
}

function Cell({ value, small, muted, accent }: { value: string; small?: boolean; muted?: boolean; accent?: "mint" }) {
  return (
    <div
      className={`text-right font-mono tabular-nums ${small ? "text-[12px]" : "text-[13px]"} ${
        accent === "mint" ? "text-emerald-300" : muted ? "text-white/65" : "text-white/90"
      }`}
    >
      {value}
    </div>
  );
}

function RoasBadge({ value, small, currency = "BRL" as Currency }: { value: number; small?: boolean; currency?: Currency }) {
  const style =
    value >= 3
      ? { color: "#a3e635", borderColor: "rgba(163,230,53,0.35)", background: "rgba(163,230,53,0.10)" }
      : value >= 1.5
      ? { color: "#fbbf24", borderColor: "rgba(251,191,36,0.35)", background: "rgba(251,191,36,0.10)" }
      : { color: "#fb7185", borderColor: "rgba(251,113,133,0.35)", background: "rgba(251,113,133,0.10)" };
  return (
    <div className="flex justify-end">
      <span
        className={`font-mono ${small ? "text-[11px]" : "text-[12px]"} px-2 py-0.5 rounded-md border whitespace-nowrap`}
        style={style}
      >
        {formatDecimal(value, 2, currency)}×
      </span>
    </div>
  );
}
