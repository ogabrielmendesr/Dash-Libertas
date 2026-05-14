"use client";

import { Sparkline } from "./Sparkline";

type Props = {
  label: string;
  value: string;
  delta?: { value: string; positive?: boolean };
  caption?: string;
  data: number[];
  tint: "violet" | "teal" | "amber" | "mint" | "azure";
  icon?: React.ReactNode;
};

const tintMap = {
  violet: { stroke: "#a78bfa", fill: "rgba(139,92,246,0.22)",  cls: "glass-tinted-violet", shadow: "rgba(139,92,246,0.35)" },
  teal:   { stroke: "#2dd4bf", fill: "rgba(45,212,191,0.22)",  cls: "glass-tinted-teal",   shadow: "rgba(45,212,191,0.35)" },
  amber:  { stroke: "#fbbf24", fill: "rgba(251,191,36,0.22)",  cls: "glass-tinted-amber",  shadow: "rgba(251,191,36,0.35)" },
  mint:   { stroke: "#a3e635", fill: "rgba(163,230,53,0.22)",  cls: "glass-tinted-mint",   shadow: "rgba(163,230,53,0.32)" },
  azure:  { stroke: "#38bdf8", fill: "rgba(56,189,248,0.22)",  cls: "glass-tinted-azure",  shadow: "rgba(56,189,248,0.32)" },
};

export function KPICard({ label, value, delta, caption, data, tint, icon }: Props) {
  const t = tintMap[tint];
  return (
    <div className={`glass ${t.cls} sheen p-5 sm:p-6 relative overflow-hidden`}>
      {/* glow halo */}
      <div
        className="absolute -top-20 -right-20 w-56 h-56 rounded-full opacity-60 pointer-events-none"
        style={{ background: `radial-gradient(circle, ${t.shadow} 0%, transparent 65%)`, filter: "blur(20px)" }}
      />

      <div className="relative flex items-start justify-between">
        <div className="flex items-center gap-2.5">
          <div className="pill text-[11px] font-mono uppercase tracking-[0.18em] text-white/80">
            <span className="dot" style={{ color: t.stroke, background: t.stroke }} />
            {label}
          </div>
        </div>
        {icon ? <div className="text-white/40">{icon}</div> : null}
      </div>

      <div className="mt-5 flex items-baseline gap-3">
        <div className="font-display text-[32px] sm:text-[40px] xl:text-[44px] leading-none tracking-tight text-white count-glow whitespace-nowrap">
          {value}
        </div>
        {delta ? (
          <div
            className={`text-[12px] font-mono px-2 py-0.5 rounded-md border ${
              delta.positive
                ? "text-emerald-300 border-emerald-300/30 bg-emerald-300/10"
                : "text-rose-300 border-rose-300/30 bg-rose-300/10"
            }`}
          >
            {delta.positive ? "▲" : "▼"} {delta.value}
          </div>
        ) : null}
      </div>

      {caption ? (
        <div className="mt-1 text-[12px] text-white/55 font-mono">{caption}</div>
      ) : null}

      <div className="mt-4 -mx-1">
        <Sparkline data={data} stroke={t.stroke} fill={t.fill} height={48} />
      </div>
    </div>
  );
}
