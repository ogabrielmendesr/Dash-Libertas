"use client";

import { useState } from "react";
import { AdRow } from "@/lib/mockData";
import { formatMoney, formatInt, formatDecimal, Currency } from "@/lib/currency";

type SortKey = "spend" | "revenue" | "roas" | "sales" | "cpa" | "profit";

export function AdsTable({ rows, currency = "BRL" }: { rows: AdRow[]; currency?: Currency }) {
  const enriched = rows.map((r) => ({
    ...r,
    roas: r.revenue / r.spend,
    cpa: r.spend / Math.max(1, r.sales),
    ctr: (r.linkClicks / r.impressions) * 100,
    profit: r.revenue - r.spend,
  }));

  const [sortKey, setSortKey] = useState<SortKey>("roas");
  const [dir, setDir] = useState<"asc" | "desc">("desc");

  const sorted = [...enriched].sort((a, b) => (dir === "desc" ? b[sortKey] - a[sortKey] : a[sortKey] - b[sortKey]));

  const toggle = (k: SortKey) => {
    if (sortKey === k) setDir(dir === "desc" ? "asc" : "desc");
    else {
      setSortKey(k);
      setDir("desc");
    }
  };

  return (
    <div className="glass sheen p-4 sm:p-6 relative overflow-hidden">
      <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-4 mb-5">
        <div>
          <div className="pill text-[10px] sm:text-[11px] font-mono uppercase tracking-[0.18em] text-white/80">
            <span className="dot text-emerald-400 bg-emerald-400" />
            <span className="hidden sm:inline">Anúncios · cruzamento por ad.id ≡ utm_content</span>
            <span className="sm:hidden">Anúncios · ad.id ≡ utm_content</span>
          </div>
          <h3 className="mt-3 font-display text-[22px] sm:text-[28px] leading-none text-white">
            <span className="italic text-white/70">Performance</span> por anúncio
          </h3>
        </div>
        <div className="flex items-center gap-2">
          <input
            placeholder="Filtrar campanha, conjunto ou anúncio…"
            className="bg-white/[0.06] border border-white/10 rounded-xl px-3 sm:px-4 py-2 text-[13px] text-white placeholder:text-white/35 focus:outline-none focus:border-white/30 flex-1 lg:w-72"
          />
          <button className="btn-glass text-[12px] px-3.5 py-2 rounded-xl whitespace-nowrap">
            <span className="hidden sm:inline">Exportar CSV</span>
            <span className="sm:hidden">CSV</span>
          </button>
        </div>
      </div>

      <div className="overflow-x-auto scrollbar-thin -mx-2 px-2">
        <table className="w-full text-[12.5px] min-w-[1100px]">
          <thead>
            <tr className="text-left text-white/55">
              <Th>Campanha / Conjunto / Anúncio</Th>
              <Th>ad.id</Th>
              <Th align="right" onClick={() => toggle("spend")} active={sortKey === "spend"} dir={dir}>Gasto</Th>
              <Th align="right">Impr.</Th>
              <Th align="right">Cliques</Th>
              <Th align="right">CTR</Th>
              <Th align="right">P.View</Th>
              <Th align="right">Checkout</Th>
              <Th align="right" onClick={() => toggle("sales")} active={sortKey === "sales"} dir={dir}>Vendas</Th>
              <Th align="right" onClick={() => toggle("revenue")} active={sortKey === "revenue"} dir={dir}>Receita</Th>
              <Th align="right" onClick={() => toggle("cpa")} active={sortKey === "cpa"} dir={dir}>CPA</Th>
              <Th align="right" onClick={() => toggle("roas")} active={sortKey === "roas"} dir={dir}>ROAS</Th>
              <Th align="right" onClick={() => toggle("profit")} active={sortKey === "profit"} dir={dir}>Lucro</Th>
            </tr>
          </thead>
          <tbody>
            {sorted.map((r) => (
              <tr key={r.adId}
                  className="border-t border-white/[0.06] hover:bg-white/[0.03] transition-colors">
                <Td>
                  <div className="text-[10px] uppercase tracking-[0.18em] text-white/45 font-mono">
                    {r.campaign}
                  </div>
                  <div className="text-[11px] text-white/55 italic font-display">{r.adset}</div>
                  <div className="text-[14px] text-white font-medium leading-tight">{r.ad}</div>
                </Td>
                <Td className="font-mono text-[11px] text-white/45">{r.adId}</Td>
                <Td align="right" className="font-mono text-white/85">{formatMoney(r.spend, currency)}</Td>
                <Td align="right" className="font-mono text-white/70">{formatInt(r.impressions, currency)}</Td>
                <Td align="right" className="font-mono text-white/70">{formatInt(r.linkClicks, currency)}</Td>
                <Td align="right" className="font-mono text-white/70">{formatDecimal(r.ctr, 2, currency)}%</Td>
                <Td align="right" className="font-mono text-white/70">{formatInt(r.pageViews, currency)}</Td>
                <Td align="right" className="font-mono text-white/70">{formatInt(r.initiateCheckouts, currency)}</Td>
                <Td align="right" className="font-mono text-emerald-300 font-medium">{formatInt(r.sales, currency)}</Td>
                <Td align="right" className="font-mono text-white/90">{formatMoney(r.revenue, currency)}</Td>
                <Td align="right" className="font-mono text-white/70">{formatMoney(r.cpa, currency)}</Td>
                <Td align="right">
                  <span
                    className="inline-flex items-center justify-end font-mono px-2 py-0.5 rounded-md border text-[12px]"
                    style={
                      r.roas >= 3
                        ? { color: "#a3e635", borderColor: "rgba(163,230,53,0.35)", background: "rgba(163,230,53,0.10)" }
                        : r.roas >= 1.5
                        ? { color: "#fbbf24", borderColor: "rgba(251,191,36,0.35)", background: "rgba(251,191,36,0.10)" }
                        : { color: "#fb7185", borderColor: "rgba(251,113,133,0.35)", background: "rgba(251,113,133,0.10)" }
                    }
                  >
                    {formatDecimal(r.roas, 2, currency)}×
                  </span>
                </Td>
                <Td align="right" className={`font-mono font-medium ${r.profit >= 0 ? "text-emerald-300" : "text-rose-300"}`}>
                  {formatMoney(r.profit, currency)}
                </Td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="mt-4 flex items-center justify-between text-[11px] font-mono text-white/45">
        <span>{sorted.length} anúncios · ordenado por {sortKey.toUpperCase()} ({dir})</span>
        <span>Página 1 de 1</span>
      </div>
    </div>
  );
}

function Th({
  children,
  align = "left",
  onClick,
  active,
  dir,
}: {
  children: React.ReactNode;
  align?: "left" | "right";
  onClick?: () => void;
  active?: boolean;
  dir?: "asc" | "desc";
}) {
  return (
    <th
      onClick={onClick}
      className={`py-2 px-2 font-mono text-[10px] uppercase tracking-[0.16em] font-medium ${
        align === "right" ? "text-right" : ""
      } ${onClick ? "cursor-pointer hover:text-white" : ""} ${active ? "text-white" : ""}`}
    >
      <span className="inline-flex items-center gap-1">
        {children}
        {active ? <span className="text-[9px]">{dir === "desc" ? "▼" : "▲"}</span> : null}
      </span>
    </th>
  );
}

function Td({
  children,
  align = "left",
  className = "",
}: {
  children: React.ReactNode;
  align?: "left" | "right";
  className?: string;
}) {
  return (
    <td className={`py-3 px-2 align-top ${align === "right" ? "text-right" : ""} ${className}`}>
      {children}
    </td>
  );
}
