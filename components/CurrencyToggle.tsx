"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Currency } from "@/lib/currency";

/**
 * Pílula de duas opções (R$ / $) que muda a moeda exibida no painel.
 * Persiste em app_settings via PATCH /api/settings.
 */
export function CurrencyToggle() {
  const [currency, setCurrency] = useState<Currency | null>(null);
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  useEffect(() => {
    fetch("/api/settings")
      .then((r) => r.json())
      .then((d) => setCurrency((d.display_currency as Currency) ?? "BRL"))
      .catch(() => setCurrency("BRL"));
  }, []);

  async function change(next: Currency) {
    if (next === currency) return;
    setCurrency(next);
    await fetch("/api/settings", {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ display_currency: next }),
    });
    startTransition(() => router.refresh());
  }

  if (currency === null) {
    return <div className="w-[88px] h-8 rounded-full bg-white/[0.05] border border-white/10" />;
  }

  return (
    <div
      role="group"
      aria-label="Selecionar moeda"
      className="inline-flex items-center gap-0.5 p-0.5 rounded-full bg-white/[0.05] border border-white/10"
      style={{ opacity: pending ? 0.7 : 1 }}
    >
      <Button active={currency === "BRL"} onClick={() => change("BRL")} label="R$" />
      <Button active={currency === "USD"} onClick={() => change("USD")} label="$" />
    </div>
  );
}

function Button({ active, onClick, label }: { active: boolean; onClick: () => void; label: string }) {
  return (
    <button
      onClick={onClick}
      className={`px-3 py-1.5 rounded-full text-[12px] font-medium transition min-w-[36px] ${
        active
          ? "bg-white text-ink-0 shadow-[0_6px_16px_-6px_rgba(255,255,255,0.45)]"
          : "text-white/70 hover:text-white"
      }`}
    >
      {label}
    </button>
  );
}
