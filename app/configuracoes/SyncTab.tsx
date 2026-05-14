"use client";

import { useEffect, useState } from "react";

type Log = {
  status: "success" | "error" | "warning";
  records_processed: number;
  message: string | null;
  started_at: string;
  finished_at: string | null;
};

export function SyncTab() {
  const [days, setDays] = useState(30);
  const [syncing, setSyncing] = useState(false);
  const [result, setResult] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [logs, setLogs] = useState<Log[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadLogs();
  }, []);

  async function loadLogs() {
    setLoading(true);
    try {
      const r = await fetch("/api/sync/logs");
      const data = await r.json();
      setLogs(data.logs);
    } catch {
      setLogs([]);
    } finally {
      setLoading(false);
    }
  }

  async function runSync() {
    setSyncing(true);
    setResult(null);
    setError(null);
    try {
      const r = await fetch("/api/facebook/sync", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ days }),
      });
      const data = await r.json();
      if (!r.ok) {
        setError(data.error || "Falha ao sincronizar");
      } else {
        setResult(`✓ ${data.records} insights sincronizados de ${data.since} até ${data.until}`);
        await loadLogs();
      }
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSyncing(false);
    }
  }

  return (
    <div className="grid grid-cols-1 xl:grid-cols-2 gap-5">
      <div className="glass sheen p-5 sm:p-7">
        <div className="pill text-[11px] font-mono uppercase tracking-[0.18em] text-white/80">
          <span className="dot bg-violet-400 text-violet-400" /> Importação Meta
        </div>
        <h2 className="mt-3 font-display text-[26px] text-white leading-tight">
          <span className="italic text-white/70">Sincronização</span> manual
        </h2>
        <p className="mt-2 text-[13px] text-white/55">
          Busca insights da Meta API e popula a tabela{" "}
          <code className="font-mono text-white/80">fb_ad_insights</code>. Rode após conectar o token.
        </p>

        <div className="mt-6 grid gap-4">
          <Field label="Período">
            <select
              value={days}
              onChange={(e) => setDays(Number(e.target.value))}
              className="w-full bg-white/[0.06] border border-white/10 rounded-xl px-4 py-2.5 text-[13px] text-white focus:outline-none focus:border-white/30"
            >
              <option value="1">Últimas 24h</option>
              <option value="7">Últimos 7 dias</option>
              <option value="14">Últimos 14 dias</option>
              <option value="30">Últimos 30 dias</option>
              <option value="60">Últimos 60 dias</option>
              <option value="90">Últimos 90 dias (limite Meta)</option>
            </select>
          </Field>

          <button
            onClick={runSync}
            disabled={syncing}
            className="btn-glass btn-primary text-[13px] px-5 py-2.5 rounded-xl w-fit disabled:opacity-40"
          >
            {syncing ? "Sincronizando…" : "Sincronizar agora"}
          </button>

          {result && (
            <div className="text-[12.5px] text-emerald-300 bg-emerald-300/[0.08] border border-emerald-300/20 rounded-xl px-4 py-2.5">
              {result}
            </div>
          )}
          {error && (
            <div className="text-[12.5px] text-rose-300 bg-rose-300/[0.08] border border-rose-300/20 rounded-xl px-4 py-2.5">
              {error}
            </div>
          )}
        </div>
      </div>

      <div className="glass sheen p-5 sm:p-7">
        <div className="flex items-center justify-between">
          <div className="pill text-[11px] font-mono uppercase tracking-[0.18em] text-white/80">
            <span className="dot bg-emerald-400 text-emerald-400" /> Histórico
          </div>
          <button
            onClick={loadLogs}
            className="text-[10px] font-mono uppercase tracking-widest text-white/55 hover:text-white"
          >
            ↻ recarregar
          </button>
        </div>
        <h2 className="mt-3 font-display text-[26px] text-white leading-tight">
          <span className="italic text-white/70">Últimas</span> sincronizações
        </h2>

        {loading ? (
          <div className="mt-5 text-white/55 text-[13px]">Carregando…</div>
        ) : logs.length === 0 ? (
          <div className="mt-5 text-white/45 italic text-[13px]">
            Nenhuma sincronização ainda. Clique em "Sincronizar agora" depois de conectar o Meta.
          </div>
        ) : (
          <div className="mt-5 space-y-3">
            {logs.map((s, i) => (
              <div
                key={i}
                className="flex items-center justify-between py-2 border-b border-white/[0.06] last:border-0"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <span
                    className={`text-[10px] font-mono px-1.5 py-0.5 rounded-md border whitespace-nowrap ${
                      s.status === "success"
                        ? "text-emerald-300 border-emerald-300/30 bg-emerald-300/10"
                        : s.status === "warning"
                        ? "text-amber-300 border-amber-300/30 bg-amber-300/10"
                        : "text-rose-300 border-rose-300/30 bg-rose-300/10"
                    }`}
                  >
                    {s.status.toUpperCase()}
                  </span>
                  <div className="min-w-0">
                    <div className="text-[13px] text-white truncate">
                      {s.message ?? `${s.records_processed} registros`}
                    </div>
                    <div className="text-[11px] font-mono text-white/45">{relTime(s.started_at)}</div>
                  </div>
                </div>
                <span className="text-[12px] font-mono text-white/55 whitespace-nowrap">
                  {s.records_processed}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="text-[11px] uppercase font-mono tracking-[0.18em] text-white/55 mb-1.5 block">
        {label}
      </label>
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
