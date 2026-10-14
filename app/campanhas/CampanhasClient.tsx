"use client";

import { useState, useRef, useEffect, useCallback, ReactNode } from "react";
import { useRouter } from "next/navigation";
import { Currency } from "@/lib/currency";
import type { CampaignAgg as Agg, CampaignNode } from "@/lib/data";

// ============================================================
// Formatação — sempre pt-BR (US$ 1.234,56), como o Gerenciador em português
// ============================================================

function money(v: number, currency: Currency) {
  return v.toLocaleString("pt-BR", { style: "currency", currency, minimumFractionDigits: 2, maximumFractionDigits: 2 });
}
function int(v: number) {
  return v.toLocaleString("pt-BR", { maximumFractionDigits: 0 });
}
function dec(v: number, digits = 2) {
  return v.toLocaleString("pt-BR", { minimumFractionDigits: digits, maximumFractionDigits: digits });
}
function pct(v: number, digits = 2) {
  return `${dec(v, digits)}%`;
}

// ============================================================
// Métricas
// ============================================================

const profit = (a: Agg) => a.revenue - a.spend;
const margin = (a: Agg) => (a.revenue > 0 ? ((a.revenue - a.spend) / a.revenue) * 100 : 0);
const roas = (a: Agg) => (a.spend > 0 ? a.revenue / a.spend : 0);
const cpa = (a: Agg) => (a.sales > 0 ? a.spend / a.sales : 0);

/**
 * Diagnóstico do rastreamento: compara as compras que o Meta registrou com as
 * vendas da Hotmart que chegaram com o ID do anúncio.
 * O Meta naturalmente conta um pouco a mais (quem viu o anúncio e comprou em
 * até 1 dia sem clicar, vendas que perderam o ID no caminho), então até ~20%
 * de diferença é considerado normal.
 */
type Health = "ok" | "warn" | "bad" | "few" | "none";
function trackingHealth(a: Agg): { health: Health; diffPct: number | null } {
  const fb = a.meta_purchases;
  const hm = a.sales;
  if (fb === 0 && hm === 0) return { health: "none", diffPct: null };
  const diffPct = ((fb - hm) / Math.max(fb, hm)) * 100;
  if (Math.max(fb, hm) < 5) return { health: "few", diffPct };
  const abs = Math.abs(diffPct);
  if (abs <= 20) return { health: "ok", diffPct };
  if (abs <= 40) return { health: "warn", diffPct };
  return { health: "bad", diffPct };
}

// ============================================================
// Visões e colunas
// ============================================================

type View = "resultado" | "gerenciador" | "rastreamento";
type Level = "campaign" | "adset" | "ad";

type RowCtx = {
  level: Level;
  agg: Agg;
  /** moeda dos valores do Meta nesta linha (conta de anúncio, ou display se as contas misturam moedas) */
  metaCurrency: Currency;
  display: Currency;
  campaign: CampaignNode;
  adset?: CampaignNode["adsets"][number];
  status: string | null;
  isMock?: boolean;
};

type Column = { label: string; hint?: string; width: number; render: (c: RowCtx) => ReactNode };

const STATUS_COL: Column = {
  label: "Status",
  width: 108,
  render: (c) => (c.level === "ad" ? <Muted /> : <StatusBadge status={c.status} />),
};

const BUDGET_COL: Column = {
  label: "Orçamento",
  hint: "Orçamento diário, na moeda da conta de anúncio (igual ao Gerenciador)",
  width: 116,
  render: (c) => {
    if (c.level === "campaign") {
      if (c.campaign.budget_type === "ABO") return <Text value="nos conjuntos" muted small />;
      return (
        <BudgetCell
          campaignId={c.campaign.campaign_id}
          value={c.campaign.daily_budget}
          currency={c.campaign.account_currency}
          isMock={c.isMock}
        />
      );
    }
    if (c.level === "adset" && c.adset?.daily_budget != null) {
      return <Text value={money(c.adset.daily_budget, c.campaign.account_currency)} />;
    }
    return <Muted />;
  },
};

// Na visão Gerenciador, gasto e valor de compra vêm na moeda da conta (sem câmbio)
const metaSpend = (c: RowCtx) => (c.metaCurrency === c.display ? c.agg.spend : c.agg.spend_acc);
const metaValue = (c: RowCtx) =>
  c.metaCurrency === c.display ? c.agg.meta_purchase_value : c.agg.meta_purchase_value_acc;

const VIEWS: Record<View, { label: string; description: string; columns: Column[] }> = {
  resultado: {
    label: "Resultado",
    description:
      "Quanto cada campanha gastou e quanto ela trouxe de dinheiro de verdade: vendas aprovadas na Hotmart (valor líquido que você recebe) que chegaram com o ID do anúncio.",
    columns: [
      STATUS_COL,
      BUDGET_COL,
      { label: "Gasto", width: 112, render: (c) => <Text value={money(c.agg.spend, c.display)} /> },
      { label: "Vendas", hint: "Vendas aprovadas na Hotmart com o ID deste anúncio", width: 72, render: (c) => <Text value={int(c.agg.sales)} accent /> },
      { label: "Faturamento", hint: "Receita líquida da Hotmart (o que cai pra você)", width: 116, render: (c) => <Text value={money(c.agg.revenue, c.display)} /> },
      { label: "CPA", width: 96, render: (c) => <Text value={c.agg.sales > 0 ? money(cpa(c.agg), c.display) : "—"} muted /> },
      { label: "ROAS", width: 80, render: (c) => <RoasBadge value={roas(c.agg)} /> },
      { label: "Lucro", width: 116, render: (c) => <ProfitText value={profit(c.agg)} currency={c.display} /> },
      { label: "Margem", width: 80, render: (c) => <MarginBadge value={margin(c.agg)} /> },
    ],
  },
  gerenciador: {
    label: "Gerenciador",
    description:
      "As mesmas colunas e os mesmos números do Gerenciador de Anúncios do Facebook, sem conversão de moeda. Use o mesmo período lá pra comparar.",
    columns: [
      STATUS_COL,
      BUDGET_COL,
      { label: "Valor usado", width: 108, render: (c) => <Text value={money(metaSpend(c), c.metaCurrency)} /> },
      { label: "Impressões", width: 96, render: (c) => <Text value={int(c.agg.impressions)} muted /> },
      {
        label: "CPM",
        hint: "Custo por 1.000 impressões",
        width: 84,
        render: (c) => <Text value={c.agg.impressions > 0 ? money((metaSpend(c) / c.agg.impressions) * 1000, c.metaCurrency) : "—"} muted />,
      },
      { label: "Cliques no link", width: 92, render: (c) => <Text value={int(c.agg.link_clicks)} muted /> },
      {
        label: "CTR",
        hint: "CTR (taxa de cliques no link)",
        width: 70,
        render: (c) => <Text value={c.agg.impressions > 0 ? pct((c.agg.link_clicks / c.agg.impressions) * 100) : "—"} muted />,
      },
      {
        label: "CPC",
        hint: "CPC (custo por clique no link)",
        width: 80,
        render: (c) => <Text value={c.agg.link_clicks > 0 ? money(metaSpend(c) / c.agg.link_clicks, c.metaCurrency) : "—"} muted />,
      },
      { label: "Vis. da página", hint: "Visualizações da página de destino", width: 92, render: (c) => <Text value={int(c.agg.landing_page_views)} muted /> },
      { label: "Checkouts", hint: "Finalizações de compra iniciadas", width: 84, render: (c) => <Text value={int(c.agg.initiate_checkouts)} muted /> },
      { label: "Compras", hint: "Compras que o Facebook registrou", width: 76, render: (c) => <Text value={int(c.agg.meta_purchases)} accent /> },
      {
        label: "Custo/compra",
        width: 96,
        render: (c) => <Text value={c.agg.meta_purchases > 0 ? money(metaSpend(c) / c.agg.meta_purchases, c.metaCurrency) : "—"} muted />,
      },
      { label: "Valor conv.", hint: "Valor de conversão da compra (informado ao Facebook)", width: 104, render: (c) => <Text value={money(metaValue(c), c.metaCurrency)} /> },
      {
        label: "ROAS FB",
        hint: "ROAS de compra — calculado pelo Facebook com o valor que ele recebe",
        width: 76,
        render: (c) => <Text value={metaSpend(c) > 0 ? dec(metaValue(c) / metaSpend(c)) : "—"} muted />,
      },
    ],
  },
  rastreamento: {
    label: "Rastreamento",
    description:
      "Compara as compras que o Facebook registrou com as vendas que a Hotmart confirmou com o ID do anúncio. É normal o Facebook contar até ~20% a mais (quem viu o anúncio e comprou em até 1 dia sem clicar). Diferenças maiores indicam que a compra não está chegando no Facebook — ou está chegando sem o ID do anúncio na Hotmart.",
    columns: [
      STATUS_COL,
      { label: "Gasto", width: 108, render: (c) => <Text value={money(metaSpend(c), c.metaCurrency)} muted /> },
      { label: "Compras FB", hint: "Compras que o Facebook registrou", width: 92, render: (c) => <Text value={int(c.agg.meta_purchases)} /> },
      { label: "Vendas Hotmart", hint: "Vendas aprovadas na Hotmart com o ID deste anúncio", width: 104, render: (c) => <Text value={int(c.agg.sales)} accent /> },
      {
        label: "Diferença",
        hint: "Compras no Facebook − vendas na Hotmart",
        width: 92,
        render: (c) => {
          const d = c.agg.meta_purchases - c.agg.sales;
          return <Text value={d === 0 ? "0" : `${d > 0 ? "+" : ""}${int(d)}`} muted />;
        },
      },
      {
        label: "Diagnóstico",
        width: 148,
        render: (c) => <HealthBadge agg={c.agg} />,
      },
      { label: "Valor FB", hint: "Valor de compra informado ao Facebook (preço cheio)", width: 108, render: (c) => <Text value={money(metaValue(c), c.metaCurrency)} muted /> },
      { label: "Receita Hotmart", hint: "Receita líquida da Hotmart (depois das taxas)", width: 116, render: (c) => <Text value={money(c.agg.revenue, c.display)} /> },
    ],
  },
};

const NAME_COL_WIDTH = 340;

// ============================================================
// Main Component
// ============================================================

export function CampanhasClient({
  campaigns,
  currency,
  accountsCurrency,
  unattributed,
  isMock,
}: {
  campaigns: CampaignNode[];
  currency: Currency;
  accountsCurrency: Currency | null;
  unattributed: { sales: number; revenue: number; without_ad_id: number };
  isMock?: boolean;
}) {
  const [view, setView] = useState<View>("resultado");
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  // Lembra a última visão escolhida (conveniência; funciona sem storage)
  useEffect(() => {
    try {
      const saved = window.localStorage.getItem("campanhas:view") as View | null;
      if (saved && saved in VIEWS) setView(saved);
    } catch {}
  }, []);
  const chooseView = (v: View) => {
    setView(v);
    try {
      window.localStorage.setItem("campanhas:view", v);
    } catch {}
  };

  const toggle = (k: string) =>
    setExpanded((s) => {
      const next = new Set(s);
      next.has(k) ? next.delete(k) : next.add(k);
      return next;
    });

  const cfg = VIEWS[view];
  const gridTemplate = `${NAME_COL_WIDTH}px ${cfg.columns.map((c) => `${c.width}px`).join(" ")}`;
  const minWidth = NAME_COL_WIDTH + cfg.columns.reduce((a, c) => a + c.width, 0) + cfg.columns.length * 8 + 24;

  const metaCurrencyFor = (c: CampaignNode): Currency => (accountsCurrency ? c.account_currency : currency);

  const total = sumAggs(campaigns.map((c) => c.agg));
  const totalsCurrency: Currency = accountsCurrency ?? currency;

  return (
    <>
      {/* Seletor de visão */}
      <section className="px-4 sm:px-6 lg:px-8 pb-4">
        <div className="flex flex-wrap items-center gap-2">
          {(Object.keys(VIEWS) as View[]).map((v) => (
            <button
              key={v}
              onClick={() => chooseView(v)}
              className={`px-3.5 py-1.5 rounded-full text-[12px] font-mono uppercase tracking-[0.14em] border transition-colors ${
                v === view
                  ? "bg-white/15 border-white/30 text-white"
                  : "bg-white/[0.03] border-white/10 text-white/55 hover:text-white/85 hover:bg-white/[0.06]"
              }`}
            >
              {VIEWS[v].label}
            </button>
          ))}
        </div>
        <p className="mt-3 max-w-3xl text-[12.5px] leading-relaxed text-white/55">{cfg.description}</p>
      </section>

      {/* Resumo da visão */}
      <section className="px-4 sm:px-6 lg:px-8 pb-5">
        <SummaryStrip
          view={view}
          campaigns={campaigns}
          total={total}
          currency={currency}
          totalsCurrency={totalsCurrency}
          unattributed={unattributed}
        />
      </section>

      {/* Tabela */}
      <section className="px-4 sm:px-6 lg:px-8 pb-10">
        <div className="glass sheen p-3 sm:p-4">
          <div className="overflow-x-auto scrollbar-thin">
            <div style={{ minWidth }}>
              <div
                className="grid gap-2 px-3 py-2 text-[10px] font-mono uppercase tracking-[0.12em] text-white/45 border-b border-white/10"
                style={{ gridTemplateColumns: gridTemplate }}
              >
                <div>Estrutura</div>
                {cfg.columns.map((col) => (
                  <div key={col.label} className="text-right leading-tight" title={col.hint}>
                    {col.label}
                    {col.hint ? <span className="text-white/25"> ⓘ</span> : null}
                  </div>
                ))}
              </div>

              {campaigns.length === 0 && (
                <div className="px-3 py-10 text-center text-white/45 text-[13px]">
                  Nenhuma campanha com gasto ou venda neste período. Se você acabou de conectar o Meta, vá em{" "}
                  <a href="/configuracoes" className="underline text-white">Configurações</a> e sincronize.
                </div>
              )}

              {campaigns.map((c) => {
                const cKey = `c:${c.campaign_id}`;
                const cOpen = expanded.has(cKey);
                const metaCurrency = metaCurrencyFor(c);
                const base = { metaCurrency, display: currency, campaign: c, isMock };
                return (
                  <div key={c.campaign_id} className="border-b border-white/[0.06] last:border-0">
                    <Row
                      template={gridTemplate}
                      columns={cfg.columns}
                      ctx={{ ...base, level: "campaign", agg: c.agg, status: c.status }}
                      className="py-3"
                      name={
                        <button onClick={() => toggle(cKey)} className="flex items-center gap-2 min-w-0 text-left w-full">
                          <Caret open={cOpen} />
                          <span className="font-display text-[15px] text-white truncate" title={c.campaign_name}>
                            {c.campaign_name}
                          </span>
                          <span className="text-[10px] font-mono uppercase tracking-[0.14em] text-white/40 whitespace-nowrap">
                            {c.adsets.length} conj.
                          </span>
                        </button>
                      }
                    />

                    {cOpen && (
                      <div className="bg-white/[0.02]">
                        {c.adsets.map((s) => {
                          const sKey = `s:${c.campaign_id}:${s.adset_id}`;
                          const sOpen = expanded.has(sKey);
                          return (
                            <div key={s.adset_id} className="border-t border-white/[0.05]">
                              <Row
                                template={gridTemplate}
                                columns={cfg.columns}
                                ctx={{ ...base, level: "adset", agg: s.agg, adset: s, status: s.status }}
                                className="py-2.5"
                                name={
                                  <button onClick={() => toggle(sKey)} className="flex items-center gap-2 min-w-0 text-left w-full pl-5">
                                    <Caret open={sOpen} small />
                                    <span className="italic font-display text-[13.5px] text-white/85 truncate" title={s.adset_name}>
                                      {s.adset_name}
                                    </span>
                                    <span className="text-[10px] font-mono uppercase tracking-[0.14em] text-white/35 whitespace-nowrap">
                                      {s.ads.length} anúncios
                                    </span>
                                  </button>
                                }
                              />

                              {sOpen &&
                                s.ads.map((ad) => (
                                  <Row
                                    key={ad.ad_id}
                                    template={gridTemplate}
                                    columns={cfg.columns}
                                    ctx={{ ...base, level: "ad", agg: ad.agg, adset: s, status: null }}
                                    className="py-2.5 border-t border-white/[0.04] bg-white/[0.015]"
                                    name={
                                      <div className="min-w-0 pl-12">
                                        <div className="text-[13px] text-white truncate" title={ad.ad_name}>{ad.ad_name}</div>
                                        <div className="text-[10px] font-mono text-white/35 truncate">ad.id {ad.ad_id}</div>
                                      </div>
                                    }
                                  />
                                ))}
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
    </>
  );
}

function sumAggs(list: Agg[]): Agg {
  const z: Agg = {
    spend: 0, impressions: 0, link_clicks: 0, landing_page_views: 0, initiate_checkouts: 0,
    meta_purchases: 0, meta_purchase_value: 0, spend_acc: 0, meta_purchase_value_acc: 0, sales: 0, revenue: 0,
  };
  for (const a of list) for (const k of Object.keys(z) as (keyof Agg)[]) z[k] += a[k];
  return z;
}

// ============================================================
// Resumo do topo (muda com a visão)
// ============================================================

function SummaryStrip({
  view,
  campaigns,
  total,
  currency,
  totalsCurrency,
  unattributed,
}: {
  view: View;
  campaigns: CampaignNode[];
  total: Agg;
  currency: Currency;
  totalsCurrency: Currency;
  unattributed: { sales: number; revenue: number; without_ad_id: number };
}) {
  // Na visão Gerenciador/Rastreamento os totais do Meta ficam na moeda das contas
  const spendM = totalsCurrency === currency ? total.spend : total.spend_acc;
  const valueM = totalsCurrency === currency ? total.meta_purchase_value : total.meta_purchase_value_acc;

  // Orçamento/dia das campanhas e conjuntos ativos, na moeda das contas
  const activeBudget = campaigns.reduce((sum, c) => {
    if (c.status !== "ACTIVE") return sum;
    if (c.budget_type === "CBO") return sum + (c.daily_budget ?? 0);
    return sum + c.adsets.reduce((a, s) => a + (s.status === "ACTIVE" ? s.daily_budget ?? 0 : 0), 0);
  }, 0);

  let tiles: Array<{ label: string; value: string; tone: Tone }>;
  let note: ReactNode = null;

  if (view === "resultado") {
    const p = profit(total);
    const m = margin(total);
    tiles = [
      { label: "Orçamento/dia", value: activeBudget > 0 ? money(activeBudget, totalsCurrency) : "—", tone: "violet" },
      { label: "Investido", value: money(total.spend, currency), tone: "amber" },
      { label: "Vendas", value: int(total.sales), tone: "mint" },
      { label: "Faturamento", value: money(total.revenue, currency), tone: "mint" },
      { label: "CPA", value: total.sales > 0 ? money(cpa(total), currency) : "—", tone: "teal" },
      { label: "ROAS", value: total.spend > 0 ? `${dec(roas(total))}×` : "—", tone: "azure" },
      { label: "Lucro", value: money(p, currency), tone: p >= 0 ? "mint" : "rose" },
      { label: "Margem", value: `${dec(m, 1)}%`, tone: m >= 20 ? "azure" : "rose" },
    ];
    if (unattributed.sales > 0) {
      note = (
        <>
          Fora desta aba: <span className="text-white/80">{int(unattributed.sales)} vendas sem anúncio</span> (
          {money(unattributed.revenue, currency)}). Na página principal elas entram na Receita, por isso o total de lá é maior.
        </>
      );
    }
  } else if (view === "gerenciador") {
    tiles = [
      { label: "Valor usado", value: money(spendM, totalsCurrency), tone: "amber" },
      { label: "Impressões", value: int(total.impressions), tone: "azure" },
      { label: "CPM", value: total.impressions > 0 ? money((spendM / total.impressions) * 1000, totalsCurrency) : "—", tone: "violet" },
      { label: "CTR", value: total.impressions > 0 ? pct((total.link_clicks / total.impressions) * 100) : "—", tone: "teal" },
      { label: "CPC", value: total.link_clicks > 0 ? money(spendM / total.link_clicks, totalsCurrency) : "—", tone: "teal" },
      { label: "Checkouts", value: int(total.initiate_checkouts), tone: "amber" },
      { label: "Compras", value: int(total.meta_purchases), tone: "mint" },
      { label: "Custo/compra", value: total.meta_purchases > 0 ? money(spendM / total.meta_purchases, totalsCurrency) : "—", tone: "rose" },
    ];
    note =
      totalsCurrency !== currency ? (
        <>Valores em {totalsCurrency === "USD" ? "dólar" : "real"}, na moeda das contas de anúncio — sem câmbio, pra bater exatamente com o Gerenciador.</>
      ) : null;
  } else {
    const diff = total.meta_purchases - total.sales;
    const h = trackingHealth(total);
    tiles = [
      { label: "Compras FB", value: int(total.meta_purchases), tone: "azure" },
      { label: "Vendas Hotmart", value: int(total.sales), tone: "mint" },
      { label: "Diferença", value: `${diff > 0 ? "+" : ""}${int(diff)}`, tone: "violet" },
      {
        label: "Diferença %",
        value: h.diffPct == null ? "—" : `${h.diffPct > 0 ? "+" : ""}${dec(h.diffPct, 1)}%`,
        tone: h.health === "ok" ? "mint" : h.health === "warn" ? "amber" : h.health === "bad" ? "rose" : "teal",
      },
      { label: "Sem ID anúncio", value: int(unattributed.without_ad_id), tone: "amber" },
      { label: "Valor FB", value: money(valueM, totalsCurrency), tone: "teal" },
      { label: "Receita Hotmart", value: money(total.revenue, currency), tone: "mint" },
      { label: "Gasto", value: money(spendM, totalsCurrency), tone: "amber" },
    ];
    note = (
      <>
        <span className="text-white/80">Sem ID anúncio</span> são vendas aprovadas na Hotmart sem o código do anúncio — elas não
        aparecem em nenhuma campanha. Se esse número crescer, o link do anúncio está perdendo os parâmetros no caminho até o checkout.
      </>
    );
  }

  return (
    <>
      <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-3 sm:gap-4">
        {tiles.map((t) => (
          <Mini key={t.label} label={t.label} value={t.value} tone={t.tone} />
        ))}
      </div>
      {note ? <p className="mt-3 text-[12px] text-white/45 max-w-4xl">{note}</p> : null}
    </>
  );
}

type Tone = "amber" | "mint" | "azure" | "violet" | "teal" | "rose";

function Mini({ label, value, tone }: { label: string; value: string; tone: Tone }) {
  const dotCls = {
    amber: "bg-amber-400 text-amber-400",
    mint: "bg-emerald-400 text-emerald-400",
    azure: "bg-sky-400 text-sky-400",
    violet: "bg-violet-400 text-violet-400",
    teal: "bg-teal-400 text-teal-400",
    rose: "bg-rose-400 text-rose-400",
  }[tone];
  return (
    <div className="glass p-4">
      <div className="flex items-center gap-2">
        <span className={`dot ${dotCls}`} />
        <span className="text-[10px] uppercase tracking-[0.2em] font-mono text-white/55 truncate">{label}</span>
      </div>
      <div className="mt-1.5 font-display text-[19px] sm:text-[22px] leading-none tracking-tight text-white tabular-nums whitespace-nowrap">
        {value}
      </div>
    </div>
  );
}

// ============================================================
// Linha e células
// ============================================================

function Row({
  template,
  columns,
  ctx,
  name,
  className = "",
}: {
  template: string;
  columns: Column[];
  ctx: RowCtx;
  name: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={`grid gap-2 px-3 items-center hover:bg-white/[0.03] transition-colors ${className}`}
      style={{ gridTemplateColumns: template }}
    >
      <div className="min-w-0">{name}</div>
      {columns.map((col) => (
        <div key={col.label} className="min-w-0">
          {col.render(ctx)}
        </div>
      ))}
    </div>
  );
}

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

function Text({ value, muted, accent, small }: { value: string; muted?: boolean; accent?: boolean; small?: boolean }) {
  return (
    <div
      className={`text-right font-mono tabular-nums whitespace-nowrap ${small ? "text-[11px]" : "text-[12.5px]"} ${
        accent ? "text-emerald-300" : muted ? "text-white/60" : "text-white/90"
      }`}
    >
      {value}
    </div>
  );
}

function Muted() {
  return <div className="text-right font-mono text-[12px] text-white/25">—</div>;
}

function ProfitText({ value, currency }: { value: number; currency: Currency }) {
  return (
    <div className={`text-right font-mono tabular-nums whitespace-nowrap text-[12.5px] ${value >= 0 ? "text-emerald-300" : "text-rose-300"}`}>
      {money(value, currency)}
    </div>
  );
}

const BADGE = {
  good: { color: "#a3e635", borderColor: "rgba(163,230,53,0.35)", background: "rgba(163,230,53,0.10)" },
  mid: { color: "#fbbf24", borderColor: "rgba(251,191,36,0.35)", background: "rgba(251,191,36,0.10)" },
  bad: { color: "#fb7185", borderColor: "rgba(251,113,133,0.35)", background: "rgba(251,113,133,0.10)" },
  neutral: { color: "rgba(255,255,255,0.55)", borderColor: "rgba(255,255,255,0.15)", background: "rgba(255,255,255,0.04)" },
};

function Badge({ children, tone, title }: { children: ReactNode; tone: keyof typeof BADGE; title?: string }) {
  return (
    <div className="flex justify-end" title={title}>
      <span className="font-mono text-[11px] px-2 py-0.5 rounded-md border whitespace-nowrap" style={BADGE[tone]}>
        {children}
      </span>
    </div>
  );
}

function RoasBadge({ value }: { value: number }) {
  return <Badge tone={value >= 3 ? "good" : value >= 1.5 ? "mid" : "bad"}>{dec(value)}×</Badge>;
}

function MarginBadge({ value }: { value: number }) {
  return <Badge tone={value >= 50 ? "good" : value >= 20 ? "mid" : "bad"}>{dec(value, 1)}%</Badge>;
}

const STATUS_LABEL: Record<string, { label: string; tone: keyof typeof BADGE }> = {
  ACTIVE: { label: "Ativa", tone: "good" },
  PAUSED: { label: "Pausada", tone: "neutral" },
  CAMPAIGN_PAUSED: { label: "Camp. pausada", tone: "neutral" },
  WITH_ISSUES: { label: "Com problema", tone: "bad" },
  IN_PROCESS: { label: "Em análise", tone: "mid" },
};

function StatusBadge({ status }: { status: string | null }) {
  if (!status) return <Badge tone="neutral" title="Desativada, arquivada ou excluída no Facebook">inativa</Badge>;
  const s = STATUS_LABEL[status] ?? { label: status.toLowerCase(), tone: "neutral" as const };
  return <Badge tone={s.tone}>{s.label}</Badge>;
}

function HealthBadge({ agg }: { agg: Agg }) {
  const { health } = trackingHealth(agg);
  const map: Record<Health, { label: string; tone: keyof typeof BADGE; title: string }> = {
    ok: { label: "✓ batendo", tone: "good", title: "Diferença de até 20% — normal" },
    warn: { label: "atenção", tone: "mid", title: "Diferença entre 20% e 40% — vale acompanhar" },
    bad: { label: "não bate", tone: "bad", title: "Diferença acima de 40% — verifique o pixel e o link do anúncio" },
    few: { label: "poucos dados", tone: "neutral", title: "Menos de 5 compras — ainda não dá pra concluir" },
    none: { label: "sem compras", tone: "neutral", title: "Nenhuma compra no Facebook nem na Hotmart" },
  };
  const m = map[health];
  return <Badge tone={m.tone} title={m.title}>{m.label}</Badge>;
}

// ============================================================
// Editor de orçamento (CBO) — valor na moeda da conta de anúncio
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

  useEffect(() => { setLocalValue(value); }, [value]);

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

  if (editing) {
    return (
      <div className="flex justify-end items-center gap-1" onClick={(e) => e.stopPropagation()}>
        <span className="text-[10px] font-mono text-white/45">{currency === "USD" ? "US$" : "R$"}</span>
        <input
          ref={inputRef}
          type="number"
          step="0.01"
          min="1"
          defaultValue={localValue ?? ""}
          className="w-[80px] bg-white/10 border border-white/30 rounded-lg px-2 py-1 text-right text-[12.5px] font-mono text-white outline-none focus:border-violet-400 focus:ring-1 focus:ring-violet-400/40 transition"
          onKeyDown={(e) => {
            if (e.key === "Enter") handleSave(Number((e.target as HTMLInputElement).value));
            else if (e.key === "Escape") setEditing(false);
          }}
          onBlur={(e) => {
            const v = Number(e.target.value);
            if (v > 0 && v !== localValue) handleSave(v);
            else setEditing(false);
          }}
        />
      </div>
    );
  }

  return (
    <div
      className={`flex justify-end items-center gap-1.5 group cursor-pointer ${error ? "animate-[shake_0.3s_ease-in-out]" : ""}`}
      title="Clique para editar o orçamento diário no Facebook"
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
      <span className={`font-mono text-[12.5px] tabular-nums whitespace-nowrap ${error ? "text-rose-400" : "text-white/90"}`}>
        {localValue != null ? money(localValue, currency) : "—"}
      </span>
    </div>
  );
}
