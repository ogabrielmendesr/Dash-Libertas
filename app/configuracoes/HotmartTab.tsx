"use client";

import { useEffect, useState } from "react";

type WebhookConfig = {
  url: string;
  secret: string;
  hottok: string | null;
  is_active: boolean;
  recent_events: Array<{
    status: "success" | "error" | "warning";
    message: string;
    metadata: Record<string, unknown> | null;
    started_at: string;
    finished_at: string | null;
  }>;
};

export function HotmartTab() {
  const [cfg, setCfg] = useState<WebhookConfig | null>(null);
  const [loading, setLoading] = useState(true);
  const [hottok, setHottok] = useState("");
  const [savingHottok, setSavingHottok] = useState(false);
  const [regenerating, setRegenerating] = useState(false);
  const [copyState, setCopyState] = useState<"url" | "secret" | null>(null);

  useEffect(() => {
    load();
  }, []);

  async function load() {
    setLoading(true);
    try {
      const r = await fetch("/api/webhook/config");
      const data = await r.json();
      setCfg(data);
      setHottok(data.hottok ?? "");
    } catch {
      // mantém null
    } finally {
      setLoading(false);
    }
  }

  async function regenerate() {
    if (!confirm("Regenerar o secret vai mudar a URL do webhook. Você precisará atualizar na Hotmart. Continuar?")) return;
    setRegenerating(true);
    await fetch("/api/webhook/config", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ action: "regenerate" }),
    });
    await load();
    setRegenerating(false);
  }

  async function saveHottok() {
    setSavingHottok(true);
    await fetch("/api/webhook/config", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ action: "set_hottok", hottok: hottok || null }),
    });
    setSavingHottok(false);
    await load();
  }

  function copy(value: string, which: "url" | "secret") {
    navigator.clipboard.writeText(value);
    setCopyState(which);
    setTimeout(() => setCopyState(null), 1500);
  }

  if (loading) {
    return <div className="text-white/55 text-[13px]">Carregando configuração do webhook…</div>;
  }
  if (!cfg) {
    return (
      <div className="text-rose-300 text-[13px]">
        Erro ao carregar configuração. Verifique se o Supabase está conectado.
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 xl:grid-cols-3 gap-5">
      <div className="xl:col-span-2 space-y-5">
        <div className="glass glass-tinted-amber sheen p-5 sm:p-7 relative overflow-hidden">
          <div
            className="absolute -top-28 -right-20 w-[420px] h-[420px] rounded-full opacity-45 pointer-events-none"
            style={{
              background: "radial-gradient(circle, rgba(251,191,36,0.4) 0%, transparent 65%)",
              filter: "blur(28px)",
            }}
          />
          <div className="pill text-[11px] font-mono uppercase tracking-[0.18em] text-white/80">
            <span className="dot bg-amber-400 text-amber-400" /> Etapa 2 · Hotmart
          </div>
          <h2 className="mt-3 font-display text-[28px] sm:text-[34px] text-white leading-tight">
            <span className="italic text-white/70">Webhook da</span> Hotmart
          </h2>
          <p className="mt-2 text-[13px] text-white/65 max-w-xl">
            Cadastre a URL abaixo nos <span className="font-mono text-white/85">Postbacks</span> da
            Hotmart para os eventos <span className="text-white/90">PURCHASE_APPROVED</span>,{" "}
            <span className="text-white/90">PURCHASE_REFUNDED</span> e{" "}
            <span className="text-white/90">PURCHASE_CHARGEBACK</span>.
          </p>

          <div className="mt-6 grid gap-4">
            <Field label="URL do webhook" hint="Cole na Hotmart > Ferramentas > Postback">
              <CopyRow value={cfg.url} onCopy={() => copy(cfg.url, "url")} copied={copyState === "url"} />
            </Field>

            <Field label="Secret (na URL)" hint="Identifica seu painel — não compartilhe">
              <CopyRow value={cfg.secret} onCopy={() => copy(cfg.secret, "secret")} copied={copyState === "secret"} mono />
            </Field>

            <Field label="Hottok da Hotmart" hint="Opcional · valida origem do postback">
              <div className="flex flex-col sm:flex-row gap-2">
                <input
                  type="text"
                  value={hottok}
                  onChange={(e) => setHottok(e.target.value)}
                  placeholder="cole aqui o Hottok da sua conta Hotmart"
                  className="flex-1 bg-white/[0.06] border border-white/10 rounded-xl px-4 py-2.5 text-[13px] font-mono text-white placeholder:text-white/30 focus:outline-none focus:border-white/30"
                />
                <button
                  onClick={saveHottok}
                  disabled={savingHottok}
                  className="btn-glass text-[13px] px-4 py-2.5 rounded-xl whitespace-nowrap disabled:opacity-40"
                >
                  {savingHottok ? "Salvando…" : "Salvar Hottok"}
                </button>
              </div>
            </Field>

            <div className="flex flex-col sm:flex-row gap-2">
              <button
                onClick={regenerate}
                disabled={regenerating}
                className="btn-glass text-[13px] px-5 py-2.5 rounded-xl disabled:opacity-40"
              >
                {regenerating ? "Regenerando…" : "Regenerar secret"}
              </button>
            </div>
          </div>
        </div>

        {/* Key insight */}
        <div className="glass glass-tinted-mint sheen p-5 sm:p-7 relative overflow-hidden">
          <div className="absolute -bottom-20 -right-20 w-[320px] h-[320px] rounded-full opacity-40 pointer-events-none"
               style={{ background: "radial-gradient(circle, rgba(163,230,53,0.4) 0%, transparent 65%)", filter: "blur(24px)" }} />
          <div className="pill text-[11px] font-mono uppercase tracking-[0.18em] text-white/85">
            <span className="dot bg-emerald-400 text-emerald-400" /> Ponto-chave do cruzamento
          </div>
          <h3 className="mt-3 font-display text-[22px] sm:text-[26px] text-white leading-tight">
            <span className="italic text-white/70">O</span>{" "}
            <span className="font-mono not-italic text-white">ad.id</span>{" "}
            <span className="italic text-white/70">viaja dentro do</span>{" "}
            <span className="font-mono not-italic text-white">utm_content</span>
          </h3>
          <p className="mt-2 text-[13px] text-white/70 max-w-2xl">
            No campo <em>Parâmetros de URL</em> de cada anúncio no Meta, configure:
          </p>
          <pre className="mt-3 text-[11px] font-mono bg-white/[0.06] border border-white/10 rounded-xl p-3 text-white/90 overflow-x-auto">
{`utm_source=facebook
utm_medium=paid
utm_campaign={{campaign.name}}
utm_term={{adset.name}}
utm_content={{ad.id}}`}
          </pre>
          <p className="mt-3 text-[12.5px] text-white/55">
            O Facebook substitui <span className="font-mono text-white/80">{"{{ad.id}}"}</span> pelo ID
            real do anúncio. Esse valor chega no webhook da Hotmart como{" "}
            <span className="font-mono text-white/80">utm_content</span> e o painel cruza com os insights
            do Meta para calcular ROAS, CPA e lucro.
          </p>
        </div>
      </div>

      {/* Recent events */}
      <aside className="space-y-5">
        <div className="glass sheen p-5">
          <div className="flex items-center justify-between">
            <div className="pill text-[11px] font-mono uppercase tracking-[0.18em] text-white/80">
              <span className="relative flex">
                <span className="dot bg-emerald-400 text-emerald-400" />
                <span className="absolute inset-0 dot bg-emerald-400 text-emerald-400 live-pulse" />
              </span>
              Últimos eventos
            </div>
            <button onClick={load} className="text-[10px] font-mono uppercase tracking-widest text-white/55 hover:text-white">
              ↻ recarregar
            </button>
          </div>
          <h3 className="mt-3 font-display text-[20px] text-white">Postbacks recebidos</h3>

          <div className="mt-4 space-y-3">
            {cfg.recent_events.length === 0 && (
              <div className="text-[12.5px] text-white/45 italic">
                Nenhum postback ainda. Configure a URL na Hotmart e dispare um evento de teste.
              </div>
            )}

            {cfg.recent_events.map((e, i) => (
              <div key={i} className="flex items-start gap-3 py-2 border-b border-white/[0.06] last:border-0">
                <span
                  className={`text-[10px] font-mono px-1.5 py-0.5 rounded-md border ${
                    e.status === "success"
                      ? "text-emerald-300 border-emerald-300/30 bg-emerald-300/10"
                      : e.status === "warning"
                      ? "text-amber-300 border-amber-300/30 bg-amber-300/10"
                      : "text-rose-300 border-rose-300/30 bg-rose-300/10"
                  }`}
                >
                  {e.status.toUpperCase()}
                </span>
                <div className="flex-1 min-w-0">
                  <div className="text-[13px] text-white">{e.message}</div>
                  <div className="text-[10px] font-mono text-white/40">{relTime(e.started_at)}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </aside>
    </div>
  );
}

function CopyRow({ value, onCopy, copied, mono }: { value: string; onCopy: () => void; copied: boolean; mono?: boolean }) {
  return (
    <div className="flex gap-2">
      <div
        className={`flex-1 bg-white/[0.06] border border-white/10 rounded-xl px-4 py-2.5 text-[13px] text-white truncate ${
          mono ? "font-mono" : ""
        }`}
      >
        {value}
      </div>
      <button onClick={onCopy} className="btn-glass text-[12px] px-4 py-2.5 rounded-xl whitespace-nowrap">
        {copied ? "✓ Copiado" : "Copiar"}
      </button>
    </div>
  );
}

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="flex items-baseline justify-between mb-1.5 gap-3">
        <label className="text-[11px] uppercase font-mono tracking-[0.18em] text-white/55">{label}</label>
        {hint ? <span className="text-[11px] text-white/40 italic font-display text-right">{hint}</span> : null}
      </div>
      {children}
    </div>
  );
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
