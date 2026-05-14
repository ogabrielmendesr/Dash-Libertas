"use client";

import { formatInt, Currency } from "@/lib/currency";

type Stage = { label: string; value: number; color: string };

export function FunnelStrip({
  impressions,
  linkClicks,
  pageViews,
  checkouts,
  sales,
  currency = "BRL",
}: {
  impressions: number;
  linkClicks: number;
  pageViews: number;
  checkouts: number;
  sales: number;
  currency?: Currency;
}) {
  const stages: Stage[] = [
    { label: "Impressões",    value: impressions, color: "#38bdf8" },
    { label: "Cliques",       value: linkClicks,  color: "#8b5cf6" },
    { label: "Page Views",    value: pageViews,   color: "#ff3da3" },
    { label: "Checkouts",     value: checkouts,   color: "#fbbf24" },
    { label: "Vendas",        value: sales,       color: "#a3e635" },
  ];
  const max = stages[0].value;

  return (
    <div className="glass sheen p-4 sm:p-5 pt-4 relative overflow-hidden">
      <div className="absolute inset-x-0 top-0 h-px" style={{ background: "linear-gradient(90deg, transparent, rgba(255,255,255,0.25), transparent)" }} />
      <div className="flex flex-wrap items-center justify-between gap-2 mb-4">
        <div className="pill text-[11px] font-mono uppercase tracking-[0.18em] text-white/80">
          <span className="dot text-violet-400 bg-violet-400" />
          Funil de conversão
        </div>
        <div className="text-[11px] font-mono text-white/45">
          Taxa final: <span className="text-white">{((sales / impressions) * 100).toFixed(3)}%</span>
        </div>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
        {stages.map((s, i) => {
          const pct = (s.value / max) * 100;
          const dropFromPrev = i === 0 ? null : ((stages[i - 1].value - s.value) / stages[i - 1].value) * 100;
          return (
            <div key={s.label} className="relative">
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-[10px] font-mono uppercase tracking-[0.18em] text-white/55">
                  {s.label}
                </span>
                {dropFromPrev !== null && (
                  <span className="text-[10px] font-mono text-rose-300/80">
                    −{dropFromPrev.toFixed(1)}%
                  </span>
                )}
              </div>
              <div className="font-display text-[24px] sm:text-[30px] leading-none text-white tracking-tight tabular-nums">
                {formatInt(s.value, currency)}
              </div>
              <div className="mt-2 h-1.5 rounded-full bg-white/[0.06] overflow-hidden relative">
                <div
                  className="h-full rounded-full"
                  style={{
                    width: `${pct}%`,
                    background: `linear-gradient(90deg, ${s.color}, ${s.color}cc)`,
                    boxShadow: `0 0 14px ${s.color}80`,
                  }}
                />
              </div>
              <div className="mt-1 text-[10px] font-mono text-white/45">
                {pct.toFixed(1)}% do topo
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
