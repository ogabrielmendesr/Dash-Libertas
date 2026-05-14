"use client";

import { useEffect, useState } from "react";

type AdAccount = {
  ad_account_id: string;
  name: string;
  currency: string | null;
  is_active: boolean;
  is_enabled: boolean;
  last_synced_at: string | null;
};

type Connection = {
  connected: boolean;
  fb_user_id?: string;
  fb_user_name?: string;
  accounts_total?: number;
  accounts_enabled?: number;
  updated_at?: string;
};

export function FacebookTab() {
  const [token, setToken] = useState("");
  const [connecting, setConnecting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [conn, setConn] = useState<Connection | null>(null);
  const [accounts, setAccounts] = useState<AdAccount[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [search, setSearch] = useState("");

  useEffect(() => {
    loadAll();
  }, []);

  async function loadAll() {
    const [cr, ar] = await Promise.all([
      fetch("/api/facebook/connect").then((r) => r.json()),
      fetch("/api/facebook/ad-accounts").then((r) => r.json()),
    ]);
    setConn(cr);
    setAccounts(ar.accounts ?? []);
  }

  async function handleConnect() {
    if (!token.trim()) {
      setError("Cole o token primeiro.");
      return;
    }
    setError(null);
    setSuccess(null);
    setConnecting(true);
    try {
      const r = await fetch("/api/facebook/connect", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ token: token.trim() }),
      });
      const data = await r.json();
      if (!r.ok) {
        setError(data.error || "Token inválido");
      } else {
        setSuccess(
          `Conectado como ${data.user.name}. ${data.accounts_count} contas catalogadas — ative abaixo as que quer ver no painel.`
        );
        setToken("");
        await loadAll();
      }
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setConnecting(false);
    }
  }

  async function handleDisconnect() {
    if (!confirm("Desconectar remove o token. Os insights já importados ficam no banco. Continuar?")) return;
    await fetch("/api/facebook/connect", { method: "DELETE" });
    await loadAll();
    setSuccess("Token removido.");
  }

  async function refreshAccountList() {
    setRefreshing(true);
    await fetch("/api/facebook/ad-accounts", { method: "POST" });
    await loadAll();
    setRefreshing(false);
  }

  async function toggleAccount(adAccountId: string, value: boolean) {
    setAccounts((prev) =>
      prev.map((a) => (a.ad_account_id === adAccountId ? { ...a, is_enabled: value } : a))
    );
    await fetch(`/api/facebook/ad-accounts/${adAccountId}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ is_enabled: value }),
    });
    await loadAll();
  }

  const filtered = accounts.filter((a) => {
    if (!search) return true;
    const q = search.toLowerCase();
    return a.name.toLowerCase().includes(q) || a.ad_account_id.toLowerCase().includes(q);
  });

  return (
    <div className="space-y-5">
      {/* ============== Bloco 1: Token ============== */}
      <div className="glass sheen p-5 sm:p-7 relative overflow-hidden">
        <div
          className="absolute -top-28 -right-20 w-[380px] h-[380px] rounded-full opacity-50 pointer-events-none"
          style={{
            background: "radial-gradient(circle, rgba(56,189,248,0.35) 0%, transparent 65%)",
            filter: "blur(28px)",
          }}
        />

        <div className="pill text-[11px] font-mono uppercase tracking-[0.18em] text-white/80">
          <span className="dot bg-sky-400 text-sky-400" /> Etapa 1 · Token do Meta
        </div>
        <h2 className="mt-3 font-display text-[28px] sm:text-[34px] text-white leading-tight">
          <span className="italic text-white/70">Conexão com a</span> API de Marketing
        </h2>

        {conn?.connected ? (
          <div className="mt-5 glass rounded-xl px-4 py-3 flex items-center justify-between gap-3 flex-wrap">
            <div>
              <div className="text-[10px] uppercase font-mono tracking-[0.18em] text-emerald-300">
                ● Conectado
              </div>
              <div className="font-display text-[18px] text-white mt-0.5">{conn.fb_user_name}</div>
              <div className="text-[11px] font-mono text-white/45">
                {conn.accounts_enabled} de {conn.accounts_total} contas ativas no painel
              </div>
            </div>
            <div className="flex gap-2">
              <button
                onClick={refreshAccountList}
                disabled={refreshing}
                className="btn-glass text-[12px] px-3.5 py-2 rounded-xl disabled:opacity-40"
              >
                {refreshing ? "Atualizando…" : "↻ Atualizar contas"}
              </button>
              <button
                onClick={handleDisconnect}
                className="btn-glass text-[12px] px-3.5 py-2 rounded-xl text-rose-300"
              >
                Desconectar
              </button>
            </div>
          </div>
        ) : (
          <p className="mt-3 text-[13px] text-white/55 max-w-xl">
            Cole o <span className="font-mono text-white/85">access_token</span> do seu app de Marketing
            (com permissão <code className="font-mono text-white">ads_read</code>). Vamos listar todas as
            contas visíveis pra você escolher quais aparecem no painel.
          </p>
        )}

        <div className="mt-6 grid gap-4">
          <Field
            label={conn?.connected ? "Substituir token" : "Access Token"}
            hint="System User ou usuário com ads_read"
          >
            <div className="flex flex-col sm:flex-row gap-2">
              <input
                type="password"
                value={token}
                onChange={(e) => setToken(e.target.value)}
                placeholder="EAAB...XYZ"
                className="flex-1 bg-white/[0.06] border border-white/10 rounded-xl px-4 py-2.5 text-[13px] font-mono text-white placeholder:text-white/30 focus:outline-none focus:border-white/30"
              />
              <button
                onClick={handleConnect}
                disabled={connecting || !token.trim()}
                className="btn-glass btn-primary text-[13px] px-4 py-2.5 rounded-xl whitespace-nowrap disabled:opacity-40 disabled:cursor-not-allowed"
              >
                {connecting ? "Conectando…" : conn?.connected ? "Substituir e listar" : "Conectar"}
              </button>
            </div>
          </Field>

          {error && (
            <div className="text-[12.5px] text-rose-300 bg-rose-300/[0.08] border border-rose-300/20 rounded-xl px-4 py-2.5">
              {error}
            </div>
          )}
          {success && (
            <div className="text-[12.5px] text-emerald-300 bg-emerald-300/[0.08] border border-emerald-300/20 rounded-xl px-4 py-2.5">
              {success}
            </div>
          )}
        </div>
      </div>

      {/* ============== Bloco 2: Contas com toggle ============== */}
      <div className="glass sheen p-5 sm:p-7">
        <div className="flex flex-wrap items-end justify-between gap-4 mb-5">
          <div>
            <div className="pill text-[11px] font-mono uppercase tracking-[0.18em] text-white/80">
              <span className="dot bg-violet-400 text-violet-400" /> Etapa 2 · Contas no painel
            </div>
            <h2 className="mt-3 font-display text-[24px] sm:text-[28px] text-white leading-tight">
              <span className="italic text-white/70">Ative as contas</span> que entram no dashboard
            </h2>
            <p className="mt-2 text-[12.5px] text-white/55 max-w-xl">
              Apenas as contas <strong className="text-white/80">ativadas</strong> têm os insights
              sincronizados e aparecem nas métricas. Você pode mudar a qualquer momento.
            </p>
          </div>

          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Filtrar conta…"
            className="bg-white/[0.06] border border-white/10 rounded-xl px-4 py-2 text-[13px] text-white placeholder:text-white/35 focus:outline-none focus:border-white/30 w-full sm:w-64"
          />
        </div>

        {accounts.length === 0 ? (
          <div className="text-[13px] text-white/45 italic">
            {conn?.connected
              ? "Nenhuma conta catalogada ainda. Clique em ↻ Atualizar contas."
              : "Conecte o Meta acima para ver suas contas de anúncios."}
          </div>
        ) : (
          <div className="space-y-2">
            {filtered.map((a) => (
              <AccountRow key={a.ad_account_id} account={a} onToggle={toggleAccount} />
            ))}
            {filtered.length === 0 && (
              <div className="text-[13px] text-white/45 italic">Nenhuma conta encontrada.</div>
            )}
          </div>
        )}

        {accounts.length > 0 && (
          <div className="mt-5 pt-4 border-t border-white/10 flex flex-wrap items-center justify-between gap-3 text-[12px] text-white/55">
            <span>
              {accounts.filter((a) => a.is_enabled).length} de {accounts.length} ativas
            </span>
            <a
              href="/configuracoes?tab=sync"
              onClick={(e) => {
                e.preventDefault();
                document.dispatchEvent(new Event("libertas-open-sync"));
              }}
              className="text-white/80 hover:text-white underline underline-offset-2"
            >
              Próximo: Sincronizar →
            </a>
          </div>
        )}
      </div>
    </div>
  );
}

function AccountRow({
  account,
  onToggle,
}: {
  account: AdAccount;
  onToggle: (id: string, value: boolean) => void;
}) {
  return (
    <div
      className={`rounded-xl border px-4 py-3 flex items-center justify-between gap-3 transition ${
        account.is_enabled
          ? "border-emerald-300/30 bg-emerald-300/[0.04]"
          : "border-white/10 bg-white/[0.02]"
      } ${!account.is_active ? "opacity-50" : ""}`}
    >
      <div className="flex items-center gap-3 min-w-0">
        <CurrencyBadge currency={account.currency} />
        <div className="min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-display text-[15px] text-white truncate">{account.name}</span>
            {!account.is_active && (
              <span className="text-[9px] font-mono uppercase tracking-widest px-1.5 py-0.5 rounded-md border border-rose-300/30 text-rose-300/80 bg-rose-300/[0.05]">
                Inativa no Meta
              </span>
            )}
          </div>
          <div className="text-[10px] font-mono text-white/40 truncate">
            {account.ad_account_id}
            {account.last_synced_at ? ` · sincronizada ${relTime(account.last_synced_at)}` : ""}
          </div>
        </div>
      </div>
      <Switch
        checked={account.is_enabled}
        disabled={!account.is_active}
        onChange={(v) => onToggle(account.ad_account_id, v)}
      />
    </div>
  );
}

function CurrencyBadge({ currency }: { currency: string | null }) {
  const map: Record<string, { label: string; bg: string; fg: string }> = {
    BRL: { label: "R$", bg: "rgba(45,212,191,0.18)", fg: "#5eead4" },
    USD: { label: "$", bg: "rgba(56,189,248,0.18)", fg: "#7dd3fc" },
    EUR: { label: "€", bg: "rgba(167,139,250,0.18)", fg: "#c4b5fd" },
  };
  const fallback = { label: currency ?? "?", bg: "rgba(255,255,255,0.08)", fg: "rgba(255,255,255,0.7)" };
  const c = currency ? map[currency] ?? fallback : fallback;
  return (
    <div
      className="w-9 h-9 rounded-xl shrink-0 flex items-center justify-center font-display text-[15px]"
      style={{ background: c.bg, color: c.fg }}
    >
      {c.label}
    </div>
  );
}

function Switch({
  checked,
  disabled,
  onChange,
}: {
  checked: boolean;
  disabled?: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={`relative w-11 h-6 rounded-full transition shrink-0 ${
        disabled ? "cursor-not-allowed opacity-40" : "cursor-pointer"
      } ${
        checked
          ? "bg-gradient-to-r from-teal-400 to-violet-500 shadow-[0_0_18px_-2px_rgba(99,102,241,0.55)]"
          : "bg-white/10 border border-white/10"
      }`}
    >
      <span
        className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white transition-transform ${
          checked ? "translate-x-5" : ""
        }`}
        style={{ boxShadow: "0 2px 6px rgba(0,0,0,0.4)" }}
      />
    </button>
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
