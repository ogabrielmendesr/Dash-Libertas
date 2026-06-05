import { CountrySaleRow } from "@/lib/data";
import { formatMoney, formatInt, Currency } from "@/lib/currency";

function flagEmoji(iso: string): string {
  return [...iso.toUpperCase()]
    .map((c) => String.fromCodePoint(0x1f1e6 + c.charCodeAt(0) - 65))
    .join("");
}

export function CountryBreakdown({
  rows,
  currency,
}: {
  rows: CountrySaleRow[];
  currency: Currency;
}) {
  if (rows.length === 0) return null;

  const maxRevenue = rows[0].revenue;
  const totalSales = rows.reduce((a, r) => a + r.sales, 0);
  const totalRevenue = rows.reduce((a, r) => a + r.revenue, 0);

  return (
    <div className="glass sheen p-4 sm:p-5">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div>
          <div className="text-[11px] font-mono uppercase tracking-[0.22em] text-white/45 mb-0.5">
            Vendas por país
          </div>
          <div className="text-[13px] text-white/70">
            {rows.length} países ·{" "}
            <span className="text-white/90">{formatInt(totalSales, currency)} vendas</span>
            {" · "}
            <span className="text-white/90">{formatMoney(totalRevenue, currency)}</span>
          </div>
        </div>
      </div>

      {/* Rows */}
      <div className="space-y-2.5">
        {rows.map((row, i) => {
          const barPct = maxRevenue > 0 ? (row.revenue / maxRevenue) * 100 : 0;
          const isTop3 = i < 3;
          return (
            <div key={row.country_iso} className="group">
              <div className="grid grid-cols-[2rem_1fr_auto] gap-3 items-center">
                {/* Flag + rank */}
                <div className="flex items-center gap-1.5">
                  <span className="text-[9px] font-mono text-white/30 w-3 text-right tabular-nums">
                    {i + 1}
                  </span>
                  <span className="text-[20px] leading-none">{flagEmoji(row.country_iso)}</span>
                </div>

                {/* Name + bar */}
                <div className="min-w-0">
                  <div className="flex items-baseline gap-2 mb-1">
                    <span
                      className={`font-display text-[13px] leading-none truncate ${
                        isTop3 ? "text-white" : "text-white/80"
                      }`}
                    >
                      {row.country_name}
                    </span>
                    <span className="text-[10px] font-mono text-white/40 whitespace-nowrap">
                      {formatInt(row.sales, currency)} vendas
                    </span>
                  </div>
                  {/* Bar */}
                  <div className="h-1.5 rounded-full bg-white/[0.06] overflow-hidden">
                    <div
                      className="h-full rounded-full transition-all duration-500"
                      style={{
                        width: `${barPct}%`,
                        background:
                          i === 0
                            ? "linear-gradient(90deg, #a78bfa, #7c3aed)"
                            : i === 1
                            ? "linear-gradient(90deg, #38bdf8, #0ea5e9)"
                            : i === 2
                            ? "linear-gradient(90deg, #34d399, #10b981)"
                            : "linear-gradient(90deg, rgba(255,255,255,0.25), rgba(255,255,255,0.12))",
                      }}
                    />
                  </div>
                </div>

                {/* Revenue + % */}
                <div className="text-right shrink-0">
                  <div className="font-mono text-[13px] tabular-nums text-white/90">
                    {formatMoney(row.revenue, currency)}
                  </div>
                  <div className="font-mono text-[10px] text-white/40">
                    {row.pct_revenue.toFixed(1)}%
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
