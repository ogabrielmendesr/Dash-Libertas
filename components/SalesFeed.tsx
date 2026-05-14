"use client";

import { Sale } from "@/lib/mockData";
import { formatMoney, Currency } from "@/lib/currency";

export function SalesFeed({ sales, currency = "BRL" }: { sales: Sale[]; currency?: Currency }) {
  const loop = [...sales, ...sales];
  return (
    <div className="glass glass-tinted-mint sheen overflow-hidden h-full max-h-[560px] flex flex-col">
      <div className="px-5 pt-5 pb-3 flex items-center justify-between">
        <div>
          <div className="pill text-[11px] font-mono uppercase tracking-[0.18em] text-white/80">
            <span className="relative flex">
              <span className="dot bg-emerald-400 text-emerald-400" />
              <span className="absolute inset-0 dot bg-emerald-400 text-emerald-400 live-pulse" />
            </span>
            Vendas ao vivo
          </div>
          <h3 className="mt-3 font-display text-[26px] leading-none text-white">
            <span className="italic text-white/70">Feed</span> da plataforma
          </h3>
        </div>
        <div className="text-right">
          <div className="text-[10px] uppercase tracking-[0.22em] font-mono text-white/45">Últimas</div>
          <div className="font-mono text-[15px] text-white">{sales.length}</div>
        </div>
      </div>

      <div className="relative flex-1 overflow-hidden">
        <div className="absolute inset-x-0 top-0 h-8 z-10 pointer-events-none"
             style={{ background: "linear-gradient(180deg, rgba(255,255,255,0.06), transparent)" }} />
        <div className="absolute inset-x-0 bottom-0 h-8 z-10 pointer-events-none"
             style={{ background: "linear-gradient(0deg, rgba(6,6,15,0.5), transparent)" }} />

        <div className="ticker-scroll px-5">
          {loop.map((s, i) => (
            <SaleRow key={i} s={s} currency={currency} />
          ))}
        </div>
      </div>
    </div>
  );
}

function SaleRow({ s, currency = "BRL" as Currency }: { s: Sale; currency?: Currency }) {
  const badge =
    s.status === "approved"
      ? { label: "PAGO", cls: "text-emerald-300 border-emerald-300/30 bg-emerald-300/10" }
      : s.status === "pending"
      ? { label: "PEND.", cls: "text-amber-300 border-amber-300/30 bg-amber-300/10" }
      : { label: "ESTORNO", cls: "text-rose-300 border-rose-300/30 bg-rose-300/10" };

  return (
    <div className="py-3 border-b border-white/[0.06] flex items-start gap-3">
      <div className={`text-[10px] font-mono px-2 py-0.5 rounded-md border whitespace-nowrap mt-1 ${badge.cls}`}>
        {badge.label}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-baseline justify-between gap-3">
          <p className="font-display text-[16px] leading-tight text-white truncate">{s.product}</p>
          <p className={`font-mono text-[14px] whitespace-nowrap ${
            s.status === "refunded" ? "line-through text-rose-300" : "text-white"
          }`}>
            {formatMoney(s.amount, currency)}
          </p>
        </div>
        <div className="mt-0.5 flex items-baseline justify-between gap-3 text-[12px]">
          <p className="italic font-display text-white/65 truncate">{s.ad}</p>
          <p className="font-mono text-white/50">{s.when}</p>
        </div>
        <div className="mt-1 font-mono text-[10px] text-white/35 truncate">
          utm_content {s.utmContent} · {s.id}
        </div>
      </div>
    </div>
  );
}
