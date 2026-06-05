"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
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
  daily_budget: number | null;
  lifetime_budget: number | null;
  budget_remaining: number | null;
  configured_status: string | null;
  budget_type: "CBO" | "ABO";
  adsets: Array<{
    adset_id: string;
    adset_name: string;
    agg: Agg;
    ads: Array<{ ad_id: string; ad_name: string; agg: Agg }>;
  }>;
};

// ============================================================
// Helpers
// ============================================================

function profit(a: Agg) { return a.revenue - a.spend; }
function margin(a: Agg) { return a.revenue > 0 ? ((a.revenue - a.spend) / a.revenue) * 100 : 0; }
function roas(a: Agg) { return a.spend > 0 ? a.revenue / a.spend : 0; }
function cpa(a: Agg) { return a.sales > 0 ? a.spend / a.sales : 0; }

const COLS = "grid-cols-[1fr_100px_100px_70px_100px_80px_80px_100px_70px]";
const COLS_HEADER = "grid-cols-[1fr_100px_100px_70px_100px_80px_80px_100px_70px]";

// ============================================================
// Main Component
// ============================================================

export function CampanhasClient({ campaigns, currency, isMock }: {
  campaigns: CampaignNode[];
  currency: Currency;
  isMock?: boolean;
}) {
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
          <div className="min-w-[1080px]">
            {/* Header */}
            <div className={`grid ${COLS_HEADER} gap-2 px-3 py-2 text-[10px] font-mono uppercase tracking-[0.16em] text-white/45 border-b border-white/10`}>
              <div>Estrutura</div>
              <div className="text-right">Orçamento</div>
              <div className="text-right">Gastos</div>
              <div className="text-right">Vendas</div>
              <div className="text-right">Faturamento</div>
              <div className="text-right">CPA</div>
              <div className="text-right">ROAS</div>
              <div className="text-right">Lucro</div>
              <div className="text-right">Margem</div>
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
              return (
                <div key={c.campaign_id} className="border-b border-white/[0.06] last:border-0">
                  {/* Campaign Row */}
                  <div className={`grid ${COLS} gap-2 px-3 py-3 hover:bg-white/[0.03] transition-colors`}>
                    <button
                      onClick={() => toggle(cKey)}
                      className="flex items-center gap-2 min-w-0 text-left"
                    >
                      <Caret open={cOpen} />
                      <span className="font-display text-[15px] text-white truncate">{c.campaign_name}</span>
                      <span className="text-[10px] font-mono uppercase tracking-[0.16em] text-white/45 whitespace-nowrap">
                        {c.adsets.length} conj.
                      </span>
                      {c.configured_status === "PAUSED" && (
                        <span className="text-[9px] font-mono uppercase px-1.5 py-0.5 rounded bg-white/10 text-white/50">
                          pausada
                        </span>
                      )}
                    </button>
                    <BudgetCell
                      campaignId={c.campaign_id}
                      value={c.daily_budget}
                      currency={currency}
                      isMock={isMock}
                    />
                    <Cell value={formatMoney(c.agg.spend, currency)} />
                    <Cell value={formatInt(c.agg.sales, currency)} accent="mint" />
                    <Cell value={formatMoney(c.agg.revenue, currency)} />
                    <Cell value={c.agg.sales > 0 ? formatMoney(cpa(c.agg), currency) : "—"} muted />
                    <RoasBadge value={roas(c.agg)} currency={currency} />
                    <ProfitCell value={profit(c.agg)} currency={currency} />
                    <MarginBadge value={margin(c.agg)} />
                  </div>

                  {/* Adsets */}
                  {cOpen && (
                    <div className="bg-white/[0.02]">
                      {c.adsets.map((s) => {
                        const sKey = `s:${c.campaign_id}:${s.adset_id}`;
                        const sOpen = expanded.has(sKey);
                        return (
                          <div key={s.adset_id} className="border-t border-white/[0.05]">
                            <div className={`grid ${COLS} gap-2 px-3 py-2.5 pl-9 hover:bg-white/[0.03] transition-colors`}>
                              <button
                                onClick={() => toggle(sKey)}
                                className="flex items-center gap-2 min-w-0 text-left"
                              >
                                <Caret open={sOpen} small />
                                <span className="italic font-display text-[13.5px] text-white/85 truncate">
                                  {s.adset_name}
                                </span>
                                <span className="text-[10px] font-mono uppercase tracking-[0.16em] text-white/40 whitespace-nowrap">
                                  {s.ads.length} anúncios
                                </span>
                              </button>
                              <Cell value="—" muted /> {/* budget no nível de adset */}
                              <Cell value={formatMoney(s.agg.spend, currency)} />
                              <Cell value={formatInt(s.agg.sales, currency)} accent="mint" />
                              <Cell value={formatMoney(s.agg.revenue, currency)} />
                              <Cell value={s.agg.sales > 0 ? formatMoney(cpa(s.agg), currency) : "—"} muted />
                              <RoasBadge value={roas(s.agg)} currency={currency} small />
                              <ProfitCell value={profit(s.agg)} currency={currency} small />
                              <MarginBadge value={margin(s.agg)} small />
                            </div>

                            {/* Ads */}
                            {sOpen && (
                              <div>
                                {s.ads.map((ad) => (
                                  <div
                                    key={ad.ad_id}
                                    className={`grid ${COLS} gap-2 px-3 py-2.5 pl-16 border-t border-white/[0.04] bg-white/[0.015]`}
                                  >
                                    <div className="min-w-0">
                                      <div className="text-[13px] text-white truncate">{ad.ad_name}</div>
                                      <div className="text-[10px] font-mono text-white/40 truncate">
                                        ad.id {ad.ad_id}
                                      </div>
                                    </div>
                                    <Cell value="—" small muted />
                                    <Cell value={formatMoney(ad.agg.spend, currency)} small />
                                    <Cell value={formatInt(ad.agg.sales, currency)} small accent="mint" />
                                    <Cell value={formatMoney(ad.agg.revenue, currency)} small />
                                    <Cell value={ad.agg.sales > 0 ? formatMoney(cpa(ad.agg), currency) : "—"} small muted />
                                    <RoasBadge value={roas(ad.agg)} small currency={currency} />
                                    <ProfitCell value={profit(ad.agg)} currency={currency} small />
                                    <MarginBadge value={margin(ad.agg)} small />
                                  </div>
                                ))}
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

// ============================================================
// Sub-components
// ============================================================

function Caret({ open, small }: { open: boolean; small?: boolean }) {
  return (
    <svg
      width={small ? 10 : 12}
      height={small ? 10 : 12}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.5"
      className={`text-white/55 transition-transform shrink-0 ${open ? "rotate-90" : ""}`}
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

function ProfitCell({ value, currency, small }: { value: number; currency: Currency; small?: boolean }) {
  const positive = value >= 0;
  return (
    <div
      className={`text-right font-mono tabular-nums ${small ? "text-[12px]" : "text-[13px]"} ${
        positive ? "text-emerald-300" : "text-rose-300"
      }`}
    >
      {formatMoney(value, currency)}
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

function MarginBadge({ value, small }: { value: number; small?: boolean }) {
  const positive = value >= 0;
  const style = positive
    ? value >= 50
      ? { color: "#a3e635", borderColor: "rgba(163,230,53,0.30)", background: "rgba(163,230,53,0.08)" }
      : value >= 20
      ? { color: "#fbbf24", borderColor: "rgba(251,191,36,0.30)", background: "rgba(251,191,36,0.08)" }
      : { color: "#fb7185", borderColor: "rgba(251,113,133,0.30)", background: "rgba(251,113,133,0.08)" }
    : { color: "#fb7185", borderColor: "rgba(251,113,133,0.30)", background: "rgba(251,113,133,0.08)" };

  return (
    <div className="flex justify-end">
      <span
        className={`font-mono ${small ? "text-[11px]" : "text-[12px]"} px-2 py-0.5 rounded-md border whitespace-nowrap`}
        style={style}
      >
        {value.toFixed(1)}%
      </span>
    </div>
  );
}

// ============================================================
// Inline Budget Editor
// ============================================================

function BudgetCell({
  campaignId,
  value,
  currency,
  isMock,
}: {
  campaignId: string;
  value: number | null;
  currency: Currency;
  isMock?: boolean;
}) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(false);
  const [localValue, setLocalValue] = useState(value);
  const inputRef = useRef<HTMLInputElement>(null);

  // Sync local when prop changes
  useEffect(() => { setLocalValue(value); }, [value]);

  // Auto-focus on edit
  useEffect(() => {
    if (editing && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [editing]);

  const handleSave = useCallback(async (newValue: number) => {
    if (!Number.isFinite(newValue) || newValue <= 0) {
      setError(true);
      setTimeout(() => setError(false), 1500);
      setEditing(false);
      return;
    }

    setSaving(true);
    setEditing(false);

    if (isMock) {
      // Em modo demo, apenas atualiza localmente
      await new Promise((r) => setTimeout(r, 600));
      setLocalValue(newValue);
      setSaving(false);
      return;
    }

    try {
      const r = await fetch("/api/facebook/budget", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ campaign_id: campaignId, daily_budget: newValue }),
      });
      if (!r.ok) {
        setError(true);
        setTimeout(() => setError(false), 2500);
      } else {
        setLocalValue(newValue);
        router.refresh();
      }
    } catch {
      setError(true);
      setTimeout(() => setError(false), 2500);
    }
    setSaving(false);
  }, [campaignId, isMock, router]);

  const displayValue = localValue != null ? localValue : null;

  if (editing) {
    return (
      <div className="flex justify-end items-center" onClick={(e) => e.stopPropagation()}>
        <input
          ref={inputRef}
          type="number"
          step="0.01"
          min="1"
          defaultValue={displayValue ?? ""}
          className="w-[90px] bg-white/10 border border-white/30 rounded-lg px-2 py-1 text-right text-[13px] font-mono text-white outline-none focus:border-violet-400 focus:ring-1 focus:ring-violet-400/40 transition"
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              handleSave(Number((e.target as HTMLInputElement).value));
            } else if (e.key === "Escape") {
              setEditing(false);
            }
          }}
          onBlur={(e) => {
            const v = Number(e.target.value);
            if (v > 0 && v !== displayValue) {
              handleSave(v);
            } else {
              setEditing(false);
            }
          }}
        />
      </div>
    );
  }

  return (
    <div
      className={`flex justify-end items-center gap-1.5 group cursor-pointer transition-all ${
        error ? "animate-[shake_0.3s_ease-in-out]" : ""
      }`}
      onClick={(e) => {
        e.stopPropagation();
        setEditing(true);
      }}
    >
      {saving ? (
        <svg className="animate-spin w-3.5 h-3.5 text-violet-400" viewBox="0 0 24 24" fill="none">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4l3-3-3-3v4a8 8 0 00-8 8h4z" />
        </svg>
      ) : null}
      <span
        className={`font-mono text-[13px] tabular-nums ${
          error ? "text-rose-400" : "text-white/90"
        }`}
      >
        {displayValue != null ? formatMoney(displayValue, currency) : "—"}
      </span>
      {!saving && displayValue != null && (
        <svg
          width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
          className="text-white/0 group-hover:text-white/45 transition-colors shrink-0"
        >
          <path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7" />
          <path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z" />
        </svg>
      )}
    </div>
  );
}
