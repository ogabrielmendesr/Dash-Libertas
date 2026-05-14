"use client";

import { useMemo, useState } from "react";
import { DailyPoint } from "@/lib/mockData";
import { formatMoney, Currency } from "@/lib/currency";

export function SpendRevenueChart({ data, currency = "BRL" }: { data: DailyPoint[]; currency?: Currency }) {
  const W = 1000;
  const H = 320;
  const PAD = { l: 56, r: 18, t: 28, b: 34 };
  const innerW = W - PAD.l - PAD.r;
  const innerH = H - PAD.t - PAD.b;
  const [hover, setHover] = useState<number | null>(null);

  const maxY = useMemo(() => {
    const m = Math.max(...data.map((d) => Math.max(d.spend, d.revenue)));
    return Math.ceil(m / 500) * 500 || 1000;
  }, [data]);

  const x = (i: number) => PAD.l + (innerW * i) / Math.max(1, data.length - 1);
  const y = (v: number) => PAD.t + innerH - (v / maxY) * innerH;

  const line = (key: "spend" | "revenue") =>
    data.map((d, i) => `${i === 0 ? "M" : "L"} ${x(i).toFixed(1)} ${y(d[key]).toFixed(1)}`).join(" ");

  const area = (key: "spend" | "revenue") => {
    const base = PAD.t + innerH;
    return (
      `M ${x(0).toFixed(1)} ${base} ` +
      data.map((d, i) => `L ${x(i).toFixed(1)} ${y(d[key]).toFixed(1)}`).join(" ") +
      ` L ${x(data.length - 1).toFixed(1)} ${base} Z`
    );
  };

  const yTicks = [0, 0.25, 0.5, 0.75, 1].map((p) => p * maxY);
  const totalSpend = data.reduce((a, b) => a + b.spend, 0);
  const totalRev = data.reduce((a, b) => a + b.revenue, 0);

  const point = hover !== null ? data[hover] : null;

  return (
    <div className="glass glass-tinted-azure sheen p-4 sm:p-6 relative overflow-hidden">
      {/* halo */}
      <div className="absolute -top-32 -left-20 w-[420px] h-[420px] rounded-full pointer-events-none opacity-50"
           style={{ background: "radial-gradient(circle, rgba(56,189,248,0.4) 0%, transparent 65%)", filter: "blur(30px)" }} />

      <div className="relative flex flex-col sm:flex-row sm:items-start justify-between gap-4 mb-4">
        <div>
          <div className="pill text-[11px] font-mono uppercase tracking-[0.18em] text-white/80">
            <span className="dot text-sky-400 bg-sky-400" />
            Gasto vs. Receita
          </div>
          <h3 className="mt-3 font-display text-[22px] sm:text-[28px] leading-none text-white">
            <span className="italic text-white/70">Performance</span> dos últimos 28 dias
          </h3>
        </div>

        <div className="flex items-center gap-5 mt-1">
          <Legend color="#fbbf24" label="Gasto" value={formatMoney(totalSpend, currency)} />
          <Legend color="#a3e635" label="Receita" value={formatMoney(totalRev, currency)} />
        </div>
      </div>

      <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-auto" preserveAspectRatio="none"
           onMouseLeave={() => setHover(null)}
           onMouseMove={(e) => {
             const rect = (e.currentTarget as SVGSVGElement).getBoundingClientRect();
             const px = ((e.clientX - rect.left) / rect.width) * W;
             const idx = Math.round(((px - PAD.l) / innerW) * (data.length - 1));
             if (idx >= 0 && idx < data.length) setHover(idx);
           }}>
        <defs>
          <linearGradient id="spendArea" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#fbbf24" stopOpacity="0.42" />
            <stop offset="100%" stopColor="#fbbf24" stopOpacity="0" />
          </linearGradient>
          <linearGradient id="revArea" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#a3e635" stopOpacity="0.40" />
            <stop offset="100%" stopColor="#a3e635" stopOpacity="0" />
          </linearGradient>
          <linearGradient id="spendLine" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor="#fcd34d" />
            <stop offset="100%" stopColor="#fbbf24" />
          </linearGradient>
          <linearGradient id="revLine" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor="#d9f99d" />
            <stop offset="100%" stopColor="#a3e635" />
          </linearGradient>
        </defs>

        {/* grid */}
        {yTicks.map((v, i) => (
          <g key={i}>
            <line x1={PAD.l} x2={PAD.l + innerW} y1={y(v)} y2={y(v)}
                  stroke="rgba(255,255,255,0.08)" strokeDasharray="3 5" strokeWidth="1" />
            <text x={PAD.l - 10} y={y(v) + 4} textAnchor="end"
                  fontFamily="var(--font-mono), monospace" fontSize="10"
                  fill="rgba(255,255,255,0.45)">
              {v >= 1000 ? `${(v / 1000).toFixed(1)}k` : v}
            </text>
          </g>
        ))}

        {/* x labels */}
        {data.map((d, i) =>
          i % 4 === 0 ? (
            <text key={i} x={x(i)} y={H - 10} textAnchor="middle"
                  fontFamily="var(--font-mono), monospace" fontSize="10"
                  fill="rgba(255,255,255,0.45)">
              {d.label}
            </text>
          ) : null
        )}

        {/* areas */}
        <path d={area("spend")} fill="url(#spendArea)" />
        <path d={area("revenue")} fill="url(#revArea)" />

        {/* lines */}
        <path d={line("spend")} fill="none" stroke="url(#spendLine)" strokeWidth="2.4"
              strokeLinejoin="round" strokeLinecap="round"
              style={{ filter: "drop-shadow(0 0 8px rgba(251,191,36,0.55))" }} />
        <path d={line("revenue")} fill="none" stroke="url(#revLine)" strokeWidth="2.6"
              strokeLinejoin="round" strokeLinecap="round"
              style={{ filter: "drop-shadow(0 0 10px rgba(163,230,53,0.55))" }} />

        {/* hover marker */}
        {hover !== null && point && (
          <g>
            <line x1={x(hover)} x2={x(hover)} y1={PAD.t} y2={PAD.t + innerH}
                  stroke="rgba(255,255,255,0.35)" strokeDasharray="3 3" />
            <circle cx={x(hover)} cy={y(point.spend)} r="5" fill="#fbbf24" stroke="white" strokeWidth="1.5" />
            <circle cx={x(hover)} cy={y(point.revenue)} r="5" fill="#a3e635" stroke="white" strokeWidth="1.5" />
          </g>
        )}
      </svg>

      {/* hover panel */}
      {hover !== null && point && (
        <div className="absolute top-6 right-6 glass-strong rounded-xl px-4 py-3 min-w-[180px]">
          <div className="text-[10px] uppercase tracking-[0.2em] font-mono text-white/55">
            {point.label}
          </div>
          <div className="mt-2 flex items-center justify-between gap-4">
            <span className="text-[12px] flex items-center gap-1.5 text-white/75">
              <span className="w-2 h-2 rounded-full bg-amber-400" />Gasto
            </span>
            <span className="font-mono text-[13px] text-white">{formatMoney(point.spend, currency)}</span>
          </div>
          <div className="mt-1 flex items-center justify-between gap-4">
            <span className="text-[12px] flex items-center gap-1.5 text-white/75">
              <span className="w-2 h-2 rounded-full bg-lime-400" />Receita
            </span>
            <span className="font-mono text-[13px] text-white">{formatMoney(point.revenue, currency)}</span>
          </div>
          <div className="mt-2 pt-2 border-t border-white/10 flex justify-between gap-4">
            <span className="text-[11px] text-white/55">ROAS</span>
            <span className="font-mono text-[12px] text-white">
              {(point.revenue / Math.max(1, point.spend)).toFixed(2)}×
            </span>
          </div>
        </div>
      )}
    </div>
  );
}

function Legend({ color, label, value }: { color: string; label: string; value: string }) {
  return (
    <div className="flex items-center gap-2">
      <span className="w-2.5 h-2.5 rounded-full" style={{ background: color, boxShadow: `0 0 10px ${color}` }} />
      <div className="flex flex-col leading-tight">
        <span className="text-[10px] font-mono uppercase tracking-widest text-white/55">{label}</span>
        <span className="font-mono text-[13px] text-white">{value}</span>
      </div>
    </div>
  );
}
