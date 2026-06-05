"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export function SyncButtonTopBar({ className = "" }: { className?: string }) {
  const router = useRouter();
  const [state, setState] = useState<"idle" | "syncing" | "ok" | "error">("idle");

  async function handleSync() {
    setState("syncing");
    try {
      const r = await fetch("/api/facebook/sync", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ days: 1 }),
      });
      if (!r.ok) {
        setState("error");
        setTimeout(() => setState("idle"), 3000);
      } else {
        setState("ok");
        router.refresh();
        setTimeout(() => setState("idle"), 2500);
      }
    } catch {
      setState("error");
      setTimeout(() => setState("idle"), 3000);
    }
  }

  const label =
    state === "syncing" ? "Sincronizando…" :
    state === "ok"      ? "✓ Sincronizado" :
    state === "error"   ? "✗ Falhou" :
    "Sincronizar";

  return (
    <button
      onClick={handleSync}
      disabled={state === "syncing"}
      className={`btn-glass btn-primary text-[13px] px-4 py-2 rounded-xl disabled:opacity-50 flex items-center gap-2 transition-all ${className}`}
    >
      {state === "syncing" && (
        <svg className="animate-spin w-3.5 h-3.5" viewBox="0 0 24 24" fill="none">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4l3-3-3-3v4a8 8 0 00-8 8h4z" />
        </svg>
      )}
      {label}
    </button>
  );
}
