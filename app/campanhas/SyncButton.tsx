"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export function SyncButton() {
  const router = useRouter();
  const [state, setState] = useState<"idle" | "syncing" | "ok" | "error">("idle");
  const [msg, setMsg] = useState<string | null>(null);

  async function handleSync() {
    setState("syncing");
    setMsg(null);
    try {
      const r = await fetch("/api/facebook/sync", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ days: 1 }),
      });
      const data = await r.json();
      if (!r.ok) {
        setState("error");
        setMsg(data.error ?? "Falha ao sincronizar");
      } else {
        setState("ok");
        setMsg(`✓ ${data.records} insights · ${data.since}`);
        router.refresh();
      }
    } catch (e) {
      setState("error");
      setMsg((e as Error).message);
    }
  }

  return (
    <div className="flex flex-col items-end gap-1.5">
      <button
        onClick={handleSync}
        disabled={state === "syncing"}
        className="btn-glass btn-primary text-[13px] px-4 py-2 rounded-xl disabled:opacity-50 flex items-center gap-2"
      >
        {state === "syncing" && (
          <svg className="animate-spin w-3.5 h-3.5" viewBox="0 0 24 24" fill="none">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4l3-3-3-3v4a8 8 0 00-8 8h4z" />
          </svg>
        )}
        {state === "syncing" ? "Sincronizando…" : "Sincronizar"}
      </button>
      {msg && (
        <span className={`text-[11px] font-mono ${state === "ok" ? "text-emerald-400" : "text-rose-400"}`}>
          {msg}
        </span>
      )}
    </div>
  );
}
