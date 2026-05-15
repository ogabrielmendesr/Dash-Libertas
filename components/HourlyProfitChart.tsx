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
  /** Hora atual (BR) quando o filtro é "Hoje". Esconde barras vazias após. */
  maxHour?: number;
};

const COLORS = {
  profit: { fill: "#22c55e", glow: "rgba(34,197,94,0.55)", areaFrom: "rgba(34,197,94,0.40)" },
  loss:   { fill: "#ef4444", glow: "rgba(239,68,68,0.55)", areaFrom: "rgba(239,68,68,0.40)" },
};

/**
 * Gráfico de barras: Lucro por horário.
 *  - Cada barra = (Receita do horário) − (Investimento do horário)
 *  - Verde acima da linha do zero = lucro
 *  - Vermelho abaixo da linha do zero = prejuízo
 */
export function HourlyProfitChart({ data, currency = "BRL", rangeLabel, maxHour }: Props) {
  const W = 1000;
  const H = 340;
  const PAD = { l: 64, r: 18, t: 28, b: 38 };
  const innerW = W - PAD.l - PAD.r;
  const innerH = H - PAD.t - PAD.b;
  const [hover, setHover] = useState<number | null>(null);

  const visible = useMemo(() => {
    if (maxHour === undefined) return data;
    return data.filter((d) => d.hour <= maxHour);
  }, [data, maxHour]);

  const { yMin, yMax } = useMemo(() => {
    if (visible.length === 0) return { yMin: -1, yMax: 1 };
    const values = visible.map((d) => d.profit);
    const min = Math.min(0, ...values);
    const max = Math.max(0, ...values);
    const range = Math.max(1, max - min);
    const pad = range * 0.12;
    return { yMin: min - pad, yMax: max + pad };
  }, [visible]);

  // Largura de cada barra dividida em 24 slots
  const slotW = innerW / 24;
  const barW = slotW * 0.62;

  const xCenter = (h: number) => PAD.l + slotW * h + slotW / 2;
  const y = (v: number) => PAD.t + innerH - ((v - yMin) / (yMax - yMin)) * innerH;
  const baseY = y(0);

  // Y ticks: 5 valores, sempre incluindo 0
  const yTicks = useMemo(() => {
    const arr = [0];
    const step = Math.max(Math.abs(yMin), Math.abs(yMax)) / 2;
    if (step > 0) {
      arr.push(step, -step);
      if (yMax > step * 1.5) arr.push(step * 2);
      if (yMin < -step * 1.5) arr.push(-step * 2);
    }
    return arr.filter((v) => v >= yMin && v <= yMax).sort((a, b) => a - b);
  }, [yMin, yMax]);

  const totalProfit = visible.reduce((a, p) => a + p.profit, 0);
  const profitHours = visible.filter((p) => p.profit > 0).length;
  const lossHours = visible.filter((p) => p.profit < 0).length;

  const point = hover !== null ? visible[hover] : null;

  return (
    <div className="glass glass-tinted-mint sheen p-4 sm:p-6 relative overflow-hidden">
      <div
        className="absolute -top-32 -left-20 w-[420px] h-[420px] rounded-full pointer-events-none opacity-50"
        style={{
          background: "radial-gradient(circle, rgba(34,197,94,0.25) 0%, transparent 65%)",
          filter: "blur(30px)",
        }}
      />

      <div className="relative flex flex-col sm:flex-row sm:items-start justify-between gap-4 mb-4">
        <div>
          <div className="pill text-[11px] font-mono uppercase tracking-[0.18em] text-white/80">
            <span className="dot bg-emerald-400 text-emerald-400" />
            Lucro por horário
          </div>
          <h3 className="mt-3 font-display text-[22px] sm:text-[28px] leading-none text-white">
            <span className="italic text-white/70">Receita</span> − <span className="italic text-white/70">Investimento</span>{" "}
            <span className="text-white/55 text-[15px]">por hora</span>
          </h3>
          {rangeLabel && (
            <div className="mt-1 text-[11px] font-mono uppercase tracking-[0.2em] text-white/40">
              {rangeLabel}
            </div>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-4 mt-1">
          <Legend
            color={COLORS.profit.fill}
            label="Horas com lucro"
            value={`${profitHours}h`}
          />
          <Legend color={COLORS.loss.fill} label="Horas com prejuízo" value={`${lossHours}h`} />
          <Legend
            color={totalProfit >= 0 ? COLORS.profit.fill : COLORS.loss.fill}
            label="Saldo"
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
          const slot = Math.floor((px - PAD.l) / slotW);
          if (slot >= 0 && slot <= 23 && slot < visible.length) setHover(slot);
        }}
      >
        {/* grid */}
        {yTicks.map((v, i) => (
          <g key={i}>
            <line
              x1={PAD.l}
              x2={PAD.l + innerW}
              y1={y(v)}
              y2={y(v)}
              stroke={v === 0 ? "rgba(255,255,255,0.25)" : "rgba(255,255,255,0.06)"}
              strokeDasharray={v === 0 ? "0" : "3 5"}
              strokeWidth={v === 0 ? "1.2" : "1"}
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

        {/* x ticks (00 a 23) */}
        {Array.from({ length: 24 }).map((_, h) => {
          const isPast = maxHour === undefined || h <= maxHour;
          return (
            <g key={h}>
              <line
                x1={xCenter(h)}
                x2={xCenter(h)}
                y1={PAD.t + innerH}
                y2={PAD.t + innerH + (h % 3 === 0 ? 5 : 3)}
                stroke="rgba(255,255,255,0.15)"
              />
              <text
                x={xCenter(h)}
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

        {/* Barras */}
        {visible.map((p) => {
          const profitPositive = p.profit >= 0;
          const c = profitPositive ? COLORS.profit : COLORS.loss;
          const top = profitPositive ? y(p.profit) : baseY;
          const bot = profitPositive ? baseY : y(p.profit);
          const h = Math.max(1, bot - top);
          const isHovered = hover === p.hour;
          // Esconde barras com profit zero (não acrescenta visual)
          if (Math.abs(p.profit) < 0.001) return null;
          return (
            <g key={p.hour}>
              <rect
                x={xCenter(p.hour) - barW / 2}
                y={top}
                width={barW}
                height={h}
                rx="2"
                fill={c.fill}
                opacity={isHovered ? 1 : 0.85}
                style={{ filter: `drop-shadow(0 0 6px ${c.glow})` }}
              />
            </g>
          );
        })}

        {/* "Agora" marker */}
        {maxHour !== undefined && (
          <g>
            <line
              x1={xCenter(maxHour) + slotW / 2}
              x2={xCenter(maxHour) + slotW / 2}
              y1={PAD.t}
              y2={PAD.t + innerH}
              stroke="rgba(255,255,255,0.35)"
              strokeDasharray="2 4"
              strokeWidth="1"
            />
            <text
              x={xCenter(maxHour) + slotW / 2}
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
      </svg>

      {/* Tooltip */}
      {point !== null && (
        <div className="absolute top-6 right-6 glass-strong rounded-xl px-4 py-3 min-w-[210px]">
          <div className="text-[10px] uppercase tracking-[0.2em] font-mono text-white/55">
            {point.label}
          </div>
          <div className="mt-2 flex items-center justify-between gap-4">
            <span className="text-[12px] flex items-center gap-1.5 text-white/75">
              <span className="w-2 h-2 rounded-full bg-lime-400" />
              Receita
            </span>
            <span className="font-mono text-[13px] text-white">{formatMoney(point.revenue, currency)}</span>
          </div>
          <div className="mt-1 flex items-center justify-between gap-4">
            <span className="text-[12px] flex items-center gap-1.5 text-white/75">
              <span className="w-2 h-2 rounded-full bg-amber-400" />
              Investimento
            </span>
            <span className="font-mono text-[13px] text-white">{formatMoney(point.spend, currency)}</span>
          </div>
          <div className="mt-2 pt-2 border-t border-white/10 flex items-center justify-between gap-4">
            <span className="text-[12px] flex items-center gap-1.5 text-white/75">
              <span
                className="w-2 h-2 rounded-full"
                style={{ background: point.profit >= 0 ? COLORS.profit.fill : COLORS.loss.fill }}
              />
              {point.profit >= 0 ? "Lucro" : "Prejuízo"}
            </span>
            <span
              className={`font-mono text-[13px] font-semibold ${
                point.profit >= 0 ? "text-emerald-300" : "text-rose-300"
              }`}
            >
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
