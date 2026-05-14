"use client";

import { useEffect, useState } from "react";

type Settings = {
  display_currency: "BRL" | "USD";
  fx_usd_brl: number;
  fx_rate_updated_at: string | null;
};

export function CambioTab() {
  const [s, setS] = useState<Settings | null>(null);
  const [rate, setRate] = useState<string>("");
  const [saving, setSaving] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [info, setInfo] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    load();
  }, []);

  async function load() {
    const r = await fetch("/api/settings");
    const data = (await r.json()) as Settings;
    setS(data);
    setRate(String(data.fx_usd_brl ?? 5.20));
  }

  async function saveRate() {
    const v = parseFloat(rate.replace(",", "."));
    if (!Number.isFinite(v) || v <= 0) {
      setError("Câmbio inválido.");
      return;
    }
    setSaving(true);
    setError(null);
    setInfo(null);
    const r = await fetch("/api/settings", {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ fx_usd_brl: v }),
    });
    setSaving(false);
    if (!r.ok) {
      const d = await r.json().catch(() => ({}));
      setError(d.error || "Falha ao salvar");
      return;
    }
    setInfo(`Câmbio salvo manualmente: $1 = R$ ${formatBRL(v)}`);
    await load();
  }

  async function refresh() {
    setRefreshing(true);
    setError(null);
    setInfo(null);
    const r = await fetch("/api/fx/refresh", { method: "POST" });
    setRefreshing(false);
    if (!r.ok) {
      const d = await r.json().catch(() => ({}));
      setError(d.error || "Falha ao buscar cotação");
      return;
    }
    const d = (await r.json()) as { fx_usd_brl: number };
    setInfo(`Cotação atualizada via AwesomeAPI: $1 = R$ ${formatBRL(d.fx_usd_brl)}`);
    setRate(String(d.fx_usd_brl));
    await load();
  }

  if (!s) {
    return <div className="text-white/55 text-[13px]">Carregando câmbio…</div>;
  }

  return (
    <div className="grid grid-cols-1 xl:grid-cols-3 gap-5">
      <div className="xl:col-span-2 glass sheen p-5 sm:p-7 relative overflow-hidden">
        <div
          className="absolute -top-28 -right-20 w-[380px] h-[380px] rounded-full opacity-50 pointer-events-none"
          style={{
            background: "radial-gradient(circle, rgba(45,212,191,0.30) 0%, transparent 65%)",
            filter: "blur(28px)",
          }}
        />
        <div className="pill text-[11px] font-mono uppercase tracking-[0.18em] text-white/80">
          <span className="dot bg-teal-400 text-teal-400" /> Câmbio USD ↔ BRL
        </div>
        <h2 className="mt-3 font-display text-[28px] sm:text-[34px] text-white leading-tight">
          <span className="italic text-white/70">Taxa de</span> conversão de moedas
        </h2>
        <p className="mt-2 text-[13px] text-white/60 max-w-2xl">
          Usada sempre que o painel precisa misturar dados em moedas diferentes — por exemplo, um
          anúncio em <span className="text-white/85">R$</span> que gerou venda em{" "}
          <span className="text-white/85">$</span>. O cruzamento é sempre por <code className="font-mono text-white">ad.id</code>; o câmbio só entra na hora de mostrar totais.
        </p>

        <div className="mt-6 grid gap-4">
          <div className="bg-white/[0.04] border border-white/10 rounded-2xl p-5">
            <div className="text-[11px] uppercase font-mono tracking-[0.18em] text-white/55">Taxa atual</div>
            <div className="mt-1 flex flex-wrap items-baseline gap-3">
              <span className="font-display text-[34px] text-white tracking-tight">
                $1 = R$ {formatBRL(s.fx_usd_brl)}
              </span>
              {s.fx_rate_updated_at && (
                <span className="text-[11px] font-mono text-white/45">
                  atualizada {relTime(s.fx_rate_updated_at)}
                </span>
              )}
            </div>
            <div className="mt-1 text-[11px] text-white/45">
              Reverso: R$1 = ${(1 / s.fx_usd_brl).toFixed(4)}
            </div>
          </div>

          <div>
            <div className="flex items-baseline justify-between mb-1.5 gap-3">
              <label className="text-[11px] uppercase font-mono tracking-[0.18em] text-white/55">
                Definir manualmente
              </label>
              <span className="text-[11px] text-white/40 italic font-display">Quantos R$ vale 1 US$</span>
            </div>
            <div className="flex flex-col sm:flex-row gap-2">
              <div className="flex-1 flex items-center bg-white/[0.06] border border-white/10 rounded-xl px-4">
                <span className="text-white/55 font-mono text-[13px] mr-2">$1 =</span>
                <span className="text-white/85 font-mono text-[13px]">R$</span>
                <input
                  type="text"
                  value={rate}
                  onChange={(e) => setRate(e.target.value)}
                  className="flex-1 bg-transparent px-2 py-2.5 text-[14px] font-mono text-white focus:outline-none"
                  placeholder="5.20"
                />
              </div>
              <button
                onClick={saveRate}
                disabled={saving}
                className="btn-glass text-[13px] px-5 py-2.5 rounded-xl whitespace-nowrap disabled:opacity-40"
              >
                {saving ? "Salvando…" : "Salvar"}
              </button>
              <button
                onClick={refresh}
                disabled={refreshing}
                className="btn-glass btn-primary text-[13px] px-5 py-2.5 rounded-xl whitespace-nowrap disabled:opacity-40"
              >
                {refreshing ? "Buscando…" : "↻ Cotação atual"}
              </button>
            </div>
            <div className="mt-2 text-[11px] text-white/40 italic">
              "Cotação atual" consulta a <a href="https://docs.awesomeapi.com.br/api-de-moedas" target="_blank" rel="noopener" className="underline">AwesomeAPI</a> (grátis, sem chave) e grava o valor de compra (bid).
            </div>
          </div>

          {error && (
            <div className="text-[12.5px] text-rose-300 bg-rose-300/[0.08] border border-rose-300/20 rounded-xl px-4 py-2.5">
              {error}
            </div>
          )}
          {info && (
            <div className="text-[12.5px] text-emerald-300 bg-emerald-300/[0.08] border border-emerald-300/20 rounded-xl px-4 py-2.5">
              {info}
            </div>
          )}
        </div>
      </div>

      <aside className="glass glass-tinted-violet sheen p-5 sm:p-6 relative overflow-hidden">
        <div
          className="absolute -top-20 -left-16 w-[280px] h-[280px] rounded-full opacity-40 pointer-events-none"
          style={{
            background: "radial-gradient(circle, rgba(139,92,246,0.4) 0%, transparent 65%)",
            filter: "blur(28px)",
          }}
        />
        <div className="pill text-[11px] font-mono uppercase tracking-[0.18em] text-white/80">
          <span className="dot text-violet-400 bg-violet-400" /> Como funciona
        </div>
        <h3 className="mt-3 font-display text-[20px] text-white leading-tight">
          <span className="italic text-white/70">Quando o câmbio</span> entra em jogo
        </h3>
        <ul className="mt-4 space-y-3 text-[12.5px] text-white/75">
          <li className="flex items-start gap-2">
            <span className="text-emerald-400 mt-0.5">→</span>
            <div>
              <strong className="text-white">Ad BRL × venda BRL</strong>
              <div className="text-[11px] text-white/55">Sem conversão. Valores nativos.</div>
            </div>
          </li>
          <li className="flex items-start gap-2">
            <span className="text-emerald-400 mt-0.5">→</span>
            <div>
              <strong className="text-white">Ad USD × venda USD</strong>
              <div className="text-[11px] text-white/55">Sem conversão. Valores nativos.</div>
            </div>
          </li>
          <li className="flex items-start gap-2">
            <span className="text-amber-300 mt-0.5">⇄</span>
            <div>
              <strong className="text-white">Ad BRL × venda USD</strong>
              <div className="text-[11px] text-white/55">
                Spend fica em R$. Receita em $ é convertida pra moeda do toggle pelo câmbio.
              </div>
            </div>
          </li>
          <li className="flex items-start gap-2">
            <span className="text-amber-300 mt-0.5">⇄</span>
            <div>
              <strong className="text-white">Ad USD × venda BRL</strong>
              <div className="text-[11px] text-white/55">
                Spend em $ convertido. Receita em R$ pode ser convertida ou não, dependendo do toggle.
              </div>
            </div>
          </li>
        </ul>
        <div className="mt-5 pt-5 border-t border-white/10 text-[11.5px] text-white/55">
          Toda venda guarda o <span className="font-mono text-white/80">sale_amount</span> e a{" "}
          <span className="font-mono text-white/80">currency</span> original — o painel só converte na hora de exibir.
        </div>
      </aside>
    </div>
  );
}

function formatBRL(v: number) {
  return v.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 4 });
}

function relTime(iso: string) {
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return "agora";
  if (m < 60) return `há ${m} min`;
  const h = Math.floor(m / 60);
  if (h < 24) return `há ${h}h`;
  const d = Math.floor(h / 24);
  return `há ${d}d`;
}
