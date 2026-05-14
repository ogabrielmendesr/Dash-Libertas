"use client";

import { useMemo, useState } from "react";
import { formatMoney, Currency } from "@/lib/currency";

export type HourlyPoint = {
  hour: number;
  label: string;
  spend: number;
  revenue: number;
  profit: number;
};

type Props = {
  data: HourlyPoint[];
  currency?: Currency;
  rangeLabel?: string;
  /** Quando definido, o chart corta as linhas após esta hora (inclusive). 0..23 */
  maxHour?: number;
};

const COLORS = {
  revenue: { line: "#facc15", lineFrom: "#fde047", lineTo: "#facc15", glow: "rgba(250,204,21,0.55)", areaFrom: "rgba(250,204,21,0.32)" },
  spend:   { line: "#ef4444", lineFrom: "#f87171", lineTo: "#ef4444", glow: "rgba(239,68,68,0.55)",  areaFrom: "rgba(239,68,68,0.30)"  },
  profit:  { line: "#22c55e", lineFrom: "#4ade80", lineTo: "#22c55e", glow: "rgba(34,197,94,0.55)",  areaFrom: "rgba(34,197,94,0.30)"  },
};

/**
 * Gráfico de linhas (com área) mostrando, hora a hora, os valores acumulados de:
 *   • Faturamento (mint)
 *   • Investimento (amber)
 *   • Lucro (violet, oscila +/-)
 *
 * Estilo dashboard moderno, dark, premium. Curvas suaves (Catmull-Rom).
 */
export function HourlyPerformanceChart({ data, currency = "BRL", rangeLabel, maxHour }: Props) {
  const W = 1000;
  const H = 340;
  const PAD = { l: 64, r: 18, t: 28, b: 38 };
  const innerW = W - PAD.l - PAD.r;
  const innerH = H - PAD.t - PAD.b;
  const [hover, setHover] = useState<number | null>(null);

  // Recorta os dados até a hora atual (se aplicável)
  const visible = useMemo(() => {
    if (maxHour === undefined) return data;
    return data.filter((d) => d.hour <= maxHour);
  }, [data, maxHour]);

  // Domínio Y: precisa incluir negativos pro lucro — usa apenas dados visíveis
  const { yMin, yMax } = useMemo(() => {
    if (visible.length === 0) return { yMin: -1, yMax: 1 };
    const values = visible.flatMap((d) => [d.spend, d.revenue, d.profit]);
    const min = Math.min(0, ...values);
    const max = Math.max(0, ...values);
    const range = Math.max(1, max - min);
    const pad = range * 0.08;
    return { yMin: min - pad, yMax: max + pad };
  }, [visible]);

  const x = (h: number) => PAD.l + (innerW * h) / 23;
  const y = (v: number) => PAD.t + innerH - ((v - yMin) / (yMax - yMin)) * innerH;
  const baseY = y(0);

  // Catmull-Rom spline → smooth bezier
  function smoothPath(points: Array<{ x: number; y: number }>): string {
    if (points.length < 2) return "";
    if (points.length === 2) return `M${points[0].x},${points[0].y} L${points[1].x},${points[1].y}`;
    const d = [`M${points[0].x},${points[0].y}`];
    for (let i = 0; i < points.length - 1; i++) {
      const p0 = points[i - 1] ?? points[i];
      const p1 = points[i];
      const p2 = points[i + 1];
      const p3 = points[i + 2] ?? p2;
      const t = 0.18; // tensão
      const cp1x = p1.x + (p2.x - p0.x) * t;
      const cp1y = p1.y + (p2.y - p0.y) * t;
      const cp2x = p2.x - (p3.x - p1.x) * t;
      const cp2y = p2.y - (p3.y - p1.y) * t;
      d.push(`C${cp1x},${cp1y} ${cp2x},${cp2y} ${p2.x},${p2.y}`);
    }
    return d.join(" ");
  }

  const points = (key: "spend" | "revenue" | "profit") =>
    visible.map((p) => ({ x: x(p.hour), y: y(p[key]) }));

  const line = (key: "spend" | "revenue" | "profit") => smoothPath(points(key));
  const area = (key: "spend" | "revenue" | "profit") => {
    const pts = points(key);
    if (pts.length === 0) return "";
    // área até a base do zero (em vez do bottom do chart)
    return `${smoothPath(pts)} L${pts[pts.length - 1].x},${baseY} L${pts[0].x},${baseY} Z`;
  };

  // Y ticks: 5 linhas
  const yTicks = useMemo(() => {
    const ticks: number[] = [];
    for (let i = 0; i < 5; i++) {
      ticks.push(yMin + ((yMax - yMin) * i) / 4);
    }
    return ticks;
  }, [yMin, yMax]);

  const point = hover !== null ? visible[hover] : null;
  const last = visible[visible.length - 1];
  const totalSpend = last?.spend ?? 0;
  const totalRev = last?.revenue ?? 0;
  const totalProfit = totalRev - totalSpend;

  return (
    <div className="glass glass-tinted-azure sheen p-4 sm:p-6 relative overflow-hidden">
      {/* halo */}
      <div
        className="absolute -top-32 -left-20 w-[420px] h-[420px] rounded-full pointer-events-none opacity-50"
        style={{
          background: "radial-gradient(circle, rgba(56,189,248,0.4) 0%, transparent 65%)",
          filter: "blur(30px)",
        }}
      />

      <div className="relative flex flex-col sm:flex-row sm:items-start justify-between gap-4 mb-4">
        <div>
          <div className="pill text-[11px] font-mono uppercase tracking-[0.18em] text-white/80">
            <span className="dot text-sky-400 bg-sky-400" />
            Faturamento × Investimento × Lucro
          </div>
          <h3 className="mt-3 font-display text-[22px] sm:text-[28px] leading-none text-white">
            <span className="italic text-white/70">Acumulado</span> por hora
          </h3>
          {rangeLabel && (
            <div className="mt-1 text-[11px] font-mono uppercase tracking-[0.2em] text-white/40">
              {rangeLabel}
            </div>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-4 mt-1">
          <Legend color={COLORS.revenue.line} label="Faturamento" value={formatMoney(totalRev, currency)} />
          <Legend color={COLORS.spend.line} label="Investimento" value={formatMoney(totalSpend, currency)} />
          <Legend
            color={COLORS.profit.line}
            label="Lucro"
            value={formatMoney(totalProfit, currency)}
            negative={totalProfit < 0}
          />
        </div>
      </div>

      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="w-full h-auto"
        preserveAspectRatio="none"
        onMouseLeave={() => setHover(null)}
        onMouseMove={(e) => {
          const rect = (e.currentTarget as SVGSVGElement).getBoundingClientRect();
          const px = ((e.clientX - rect.left) / rect.width) * W;
          const idx = Math.round(((px - PAD.l) / innerW) * 23);
          if (idx >= 0 && idx <= 23) setHover(idx);
        }}
      >
        <defs>
          <linearGradient id="revArea" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={COLORS.revenue.line} stopOpacity="0.32" />
            <stop offset="100%" stopColor={COLORS.revenue.line} stopOpacity="0" />
          </linearGradient>
          <linearGradient id="spArea" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={COLORS.spend.line} stopOpacity="0.30" />
            <stop offset="100%" stopColor={COLORS.spend.line} stopOpacity="0" />
          </linearGradient>
          <linearGradient id="prArea" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={COLORS.profit.line} stopOpacity="0.32" />
            <stop offset="100%" stopColor={COLORS.profit.line} stopOpacity="0" />
          </linearGradient>

          <linearGradient id="revLine" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor={COLORS.revenue.lineFrom} />
            <stop offset="100%" stopColor={COLORS.revenue.lineTo} />
          </linearGradient>
          <linearGradient id="spLine" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor={COLORS.spend.lineFrom} />
            <stop offset="100%" stopColor={COLORS.spend.lineTo} />
          </linearGradient>
          <linearGradient id="prLine" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor={COLORS.profit.lineFrom} />
            <stop offset="100%" stopColor={COLORS.profit.lineTo} />
          </linearGradient>
        </defs>

        {/* grid horizontal */}
        {yTicks.map((v, i) => (
          <g key={i}>
            <line
              x1={PAD.l}
              x2={PAD.l + innerW}
              y1={y(v)}
              y2={y(v)}
              stroke={v === 0 ? "rgba(255,255,255,0.18)" : "rgba(255,255,255,0.06)"}
              strokeDasharray={v === 0 ? "0" : "3 5"}
              strokeWidth="1"
            />
            <text
              x={PAD.l - 10}
              y={y(v) + 4}
              textAnchor="end"
              fontFamily="var(--font-mono), monospace"
              fontSize="10"
              fill="rgba(255,255,255,0.45)"
            >
              {compactMoney(v, currency)}
            </text>
          </g>
        ))}

        {/* x ticks (00 a 23) — todas as horas */}
        {Array.from({ length: 24 }).map((_, h) => {
          const isPast = maxHour === undefined || h <= maxHour;
          return (
            <g key={h}>
              <line
                x1={x(h)}
                x2={x(h)}
                y1={PAD.t + innerH}
                y2={PAD.t + innerH + (h % 3 === 0 ? 5 : 3)}
                stroke="rgba(255,255,255,0.15)"
              />
              <text
                x={x(h)}
                y={H - 14}
                textAnchor="middle"
                fontFamily="var(--font-mono), monospace"
                fontSize="9"
                fill={isPast ? "rgba(255,255,255,0.55)" : "rgba(255,255,255,0.22)"}
                fontWeight={h % 6 === 0 ? "600" : "400"}
              >
                {String(h).padStart(2, "0")}
              </text>
            </g>
          );
        })}

        {/* "Agora" marker (linha vertical pontilhada) quando temos cutoff */}
        {maxHour !== undefined && (
          <g>
            <line
              x1={x(maxHour)}
              x2={x(maxHour)}
              y1={PAD.t}
              y2={PAD.t + innerH}
              stroke="rgba(255,255,255,0.35)"
              strokeDasharray="2 4"
              strokeWidth="1"
            />
            <text
              x={x(maxHour)}
              y={PAD.t - 6}
              textAnchor="middle"
              fontFamily="var(--font-mono), monospace"
              fontSize="9"
              fill="rgba(255,255,255,0.55)"
              letterSpacing="2"
            >
              AGORA
            </text>
          </g>
        )}

        {/* áreas + linhas: ordem importa pra sobreposição visual */}
        <path d={area("spend")} fill="url(#spArea)" />
        <path d={area("revenue")} fill="url(#revArea)" />
        <path d={area("profit")} fill="url(#prArea)" />

        <path
          d={line("spend")}
          fill="none"
          stroke="url(#spLine)"
          strokeWidth="2.4"
          strokeLinejoin="round"
          strokeLinecap="round"
          style={{ filter: `drop-shadow(0 0 8px ${COLORS.spend.glow})` }}
        />
        <path
          d={line("revenue")}
          fill="none"
          stroke="url(#revLine)"
          strokeWidth="2.6"
          strokeLinejoin="round"
          strokeLinecap="round"
          style={{ filter: `drop-shadow(0 0 10px ${COLORS.revenue.glow})` }}
        />
        <path
          d={line("profit")}
          fill="none"
          stroke="url(#prLine)"
          strokeWidth="2.6"
          strokeLinejoin="round"
          strokeLinecap="round"
          style={{ filter: `drop-shadow(0 0 10px ${COLORS.profit.glow})` }}
        />

        {/* hover marker */}
        {hover !== null && point && (
          <g>
            <line
              x1={x(hover)}
              x2={x(hover)}
              y1={PAD.t}
              y2={PAD.t + innerH}
              stroke="rgba(255,255,255,0.35)"
              strokeDasharray="3 3"
            />
            <circle cx={x(hover)} cy={y(point.spend)} r="5" fill={COLORS.spend.line} stroke="white" strokeWidth="1.5" />
            <circle cx={x(hover)} cy={y(point.revenue)} r="5" fill={COLORS.revenue.line} stroke="white" strokeWidth="1.5" />
            <circle cx={x(hover)} cy={y(point.profit)} r="5" fill={COLORS.profit.line} stroke="white" strokeWidth="1.5" />
          </g>
        )}
      </svg>

      {/* hover panel */}
      {hover !== null && point && (
        <div className="absolute top-6 right-6 glass-strong rounded-xl px-4 py-3 min-w-[200px]">
          <div className="text-[10px] uppercase tracking-[0.2em] font-mono text-white/55">
            até {point.label}
          </div>
          <div className="mt-2 flex items-center justify-between gap-4">
            <span className="text-[12px] flex items-center gap-1.5 text-white/75">
              <span className="w-2 h-2 rounded-full" style={{ background: COLORS.revenue.line }} />
              Faturamento
            </span>
            <span className="font-mono text-[13px] text-white">{formatMoney(point.revenue, currency)}</span>
          </div>
          <div className="mt-1 flex items-center justify-between gap-4">
            <span className="text-[12px] flex items-center gap-1.5 text-white/75">
              <span className="w-2 h-2 rounded-full" style={{ background: COLORS.spend.line }} />
              Investimento
            </span>
            <span className="font-mono text-[13px] text-white">{formatMoney(point.spend, currency)}</span>
          </div>
          <div className="mt-2 pt-2 border-t border-white/10 flex items-center justify-between gap-4">
            <span className="text-[12px] flex items-center gap-1.5 text-white/75">
              <span className="w-2 h-2 rounded-full" style={{ background: COLORS.profit.line }} />
              Lucro
            </span>
            <span className={`font-mono text-[13px] ${point.profit >= 0 ? "text-emerald-300" : "text-rose-300"}`}>
              {formatMoney(point.profit, currency)}
            </span>
          </div>
        </div>
      )}
    </div>
  );
}

function Legend({
  color,
  label,
  value,
  negative,
}: {
  color: string;
  label: string;
  value: string;
  negative?: boolean;
}) {
  return (
    <div className="flex items-center gap-2">
      <span
        className="w-2.5 h-2.5 rounded-full"
        style={{ background: color, boxShadow: `0 0 10px ${color}` }}
      />
      <div className="flex flex-col leading-tight">
        <span className="text-[10px] font-mono uppercase tracking-widest text-white/55">{label}</span>
        <span className={`font-mono text-[13px] ${negative ? "text-rose-300" : "text-white"}`}>
          {value}
        </span>
      </div>
    </div>
  );
}

function compactMoney(v: number, currency: Currency): string {
  const abs = Math.abs(v);
  const sign = v < 0 ? "-" : "";
  const symbol = currency === "BRL" ? "R$" : "$";
  if (abs >= 1000) return `${sign}${symbol}${(abs / 1000).toFixed(1)}k`;
  if (abs >= 100) return `${sign}${symbol}${Math.round(abs)}`;
  return `${sign}${symbol}${abs.toFixed(0)}`;
}
