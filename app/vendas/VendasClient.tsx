"use client";

import { useMemo, useState } from "react";
import { formatMoney, formatInt, Currency } from "@/lib/currency";
import { SalesData } from "@/lib/data";

const STATUS_LABELS: Record<string, string> = {
  approved: "Pago",
  pending: "Pendente",
  refunded: "Estorno",
  cancelled: "Cancelado",
  chargeback: "Chargeback",
};

export function VendasClient({ initial, currency }: { initial: SalesData; currency: Currency }) {
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [productFilter, setProductFilter] = useState<string>("all");
  const [query, setQuery] = useState("");

  const filtered = useMemo(() => {
    return initial.sales.filter((s) => {
      if (statusFilter !== "all" && s.status !== statusFilter) return false;
      if (productFilter !== "all" && s.product_name !== productFilter) return false;
      if (query) {
        const q = query.toLowerCase();
        if (
          !s.product_name?.toLowerCase().includes(q) &&
          !s.transaction_id?.toLowerCase().includes(q) &&
          !s.utm_content?.toLowerCase().includes(q) &&
          !s.ad_name?.toLowerCase().includes(q)
        )
          return false;
      }
      return true;
    });
  }, [statusFilter, productFilter, query, initial.sales]);

  return (
    <>
      <section className="px-4 sm:px-6 lg:px-8 pb-5">
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4">
          <Mini label="Receita aprovada" value={formatMoney(initial.totals.revenue, currency)} tone="mint" />
          <Mini label="Vendas aprovadas" value={formatInt(initial.totals.approved, currency)} tone="azure" />
          <Mini
            label="Vinculadas a anúncio"
            value={formatInt(initial.totals.linked, currency)}
            tone="violet"
            sub={`${Math.max(0, initial.totals.approved - initial.totals.linked)} sem vínculo`}
          />
          <Mini label="Total estornado" value={formatMoney(initial.totals.refunded, currency)} tone="amber" />
        </div>
      </section>

      <section className="px-4 sm:px-6 lg:px-8 pb-5">
        <div className="glass p-3 sm:p-4 flex flex-col lg:flex-row gap-3 lg:items-center">
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Buscar por produto, ID da transação, ad.id, anúncio…"
            className="flex-1 bg-white/[0.06] border border-white/10 rounded-xl px-4 py-2.5 text-[13px] text-white placeholder:text-white/35 focus:outline-none focus:border-white/30"
          />
          <div className="flex flex-wrap gap-2">
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="bg-white/[0.06] border border-white/10 rounded-xl px-3 py-2.5 text-[13px] text-white focus:outline-none focus:border-white/30"
            >
              <option value="all">Todos os status</option>
              <option value="approved">Pagas</option>
              <option value="pending">Pendentes</option>
              <option value="refunded">Estornadas</option>
              <option value="cancelled">Canceladas</option>
              <option value="chargeback">Chargeback</option>
            </select>
            <select
              value={productFilter}
              onChange={(e) => setProductFilter(e.target.value)}
              className="bg-white/[0.06] border border-white/10 rounded-xl px-3 py-2.5 text-[13px] text-white focus:outline-none focus:border-white/30"
            >
              <option value="all">Todos os produtos</option>
              {initial.products.map((p) => (
                <option key={p} value={p}>{p}</option>
              ))}
            </select>
          </div>
        </div>
      </section>

      <section className="px-4 sm:px-6 lg:px-8 pb-10">
        <div className="glass sheen p-3 sm:p-4 overflow-hidden">
          <div className="overflow-x-auto scrollbar-thin">
            <table className="w-full text-[12.5px] min-w-[980px]">
              <thead className="text-white/55">
                <tr>
                  <Th>Status</Th>
                  <Th>Produto</Th>
                  <Th align="right">Valor</Th>
                  <Th>Anúncio vinculado</Th>
                  <Th>utm_content (ad.id)</Th>
                  <Th>Transação</Th>
                  <Th align="right">Data</Th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((s) => (
                  <tr key={s.id} className="border-t border-white/[0.06] hover:bg-white/[0.03]">
                    <Td>
                      <StatusBadge status={s.status} />
                    </Td>
                    <Td>
                      <span className="text-white">{s.product_name}</span>
                      {s.buyer_email && (
                        <div className="text-[10px] font-mono text-white/40">{s.buyer_email}</div>
                      )}
                    </Td>
                    <Td align="right">
                      <span
                        className={`font-mono ${
                          s.status === "refunded" ? "line-through text-rose-300" : "text-white"
                        }`}
                      >
                        {formatMoney(s.sale_amount, currency)}
                      </span>
                    </Td>
                    <Td>
                      {s.ad_name ? (
                        <div>
                          <div className="text-[10px] uppercase tracking-[0.18em] text-white/45 font-mono">
                            {s.campaign_name}
                          </div>
                          <div className="italic font-display text-[12.5px] text-white/85">{s.ad_name}</div>
                        </div>
                      ) : (
                        <span className="text-rose-300/75 text-[11px] italic">sem vínculo</span>
                      )}
                    </Td>
                    <Td>
                      <span className="font-mono text-[11px] text-white/65">{s.utm_content || "—"}</span>
                    </Td>
                    <Td>
                      <span className="font-mono text-[11px] text-white/65">{s.transaction_id}</span>
                    </Td>
                    <Td align="right">
                      <span className="font-mono text-white/55">{formatWhen(s.sale_date)}</span>
                    </Td>
                  </tr>
                ))}
                {filtered.length === 0 && (
                  <tr>
                    <td colSpan={7} className="py-8 text-center text-white/45 text-[13px]">
                      Nenhuma venda corresponde aos filtros aplicados.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </section>
    </>
  );
}

function StatusBadge({ status }: { status: string }) {
  const cls =
    status === "approved"
      ? "text-emerald-300 border-emerald-300/30 bg-emerald-300/10"
      : status === "pending"
      ? "text-amber-300 border-amber-300/30 bg-amber-300/10"
      : status === "chargeback"
      ? "text-rose-300 border-rose-300/30 bg-rose-300/10"
      : status === "cancelled"
      ? "text-white/55 border-white/15 bg-white/[0.05]"
      : "text-rose-300 border-rose-300/30 bg-rose-300/10";
  return (
    <span className={`inline-block text-[10px] font-mono px-2 py-0.5 rounded-md border whitespace-nowrap ${cls}`}>
      {(STATUS_LABELS[status] ?? status).toUpperCase()}
    </span>
  );
}

function Th({ children, align = "left" }: { children: React.ReactNode; align?: "left" | "right" }) {
  return (
    <th
      className={`py-2 px-3 font-mono text-[10px] uppercase tracking-[0.16em] font-medium ${
        align === "right" ? "text-right" : ""
      }`}
    >
      {children}
    </th>
  );
}

function Td({ children, align = "left" }: { children: React.ReactNode; align?: "left" | "right" }) {
  return <td className={`py-3 px-3 align-top ${align === "right" ? "text-right" : ""}`}>{children}</td>;
}

function Mini({ label, value, tone, sub }: { label: string; value: string; tone: "amber" | "mint" | "azure" | "violet"; sub?: string }) {
  const dotCls = {
    amber: "bg-amber-400 text-amber-400",
    mint: "bg-emerald-400 text-emerald-400",
    azure: "bg-sky-400 text-sky-400",
    violet: "bg-violet-400 text-violet-400",
  }[tone];
  return (
    <div className="glass p-4">
      <div className="flex items-center gap-2">
        <span className={`dot ${dotCls}`} />
        <span className="text-[10px] uppercase tracking-[0.22em] font-mono text-white/55">{label}</span>
      </div>
      <div className="mt-1.5 font-display text-[22px] sm:text-[26px] leading-none tracking-tight text-white tabular-nums whitespace-nowrap">
        {value}
      </div>
      {sub ? <div className="mt-1 text-[11px] text-white/45 font-mono">{sub}</div> : null}
    </div>
  );
}

function formatWhen(iso: string) {
  const d = new Date(iso);
  const dd = String(d.getDate()).padStart(2, "0");
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const hh = String(d.getHours()).padStart(2, "0");
  const mi = String(d.getMinutes()).padStart(2, "0");
  return `${dd}/${mm} ${hh}:${mi}`;
}
