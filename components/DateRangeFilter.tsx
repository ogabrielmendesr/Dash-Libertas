"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { PRESET_OPTIONS, RangePreset } from "@/lib/dateRange";

type Props = {
  currentPreset: RangePreset;
  currentLabel: string;
  since: string;
  until: string;
};

export function DateRangeFilter({ currentPreset, currentLabel, since, until }: Props) {
  const [open, setOpen] = useState(false);
  const [showCustom, setShowCustom] = useState(currentPreset === "custom");
  const [customSince, setCustomSince] = useState(since);
  const [customUntil, setCustomUntil] = useState(until);
  const router = useRouter();
  const pathname = usePathname();
  const sp = useSearchParams();
  const wrapperRef = useRef<HTMLDivElement>(null);

  // Fecha ao clicar fora
  useEffect(() => {
    function onDown(e: MouseEvent) {
      if (!wrapperRef.current?.contains(e.target as Node)) {
        setOpen(false);
        // Ao fechar, reseta o painel custom para o que está na URL
        setShowCustom(currentPreset === "custom");
      }
    }
    if (open) document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [open, currentPreset]);

  // Sincroniza inputs de custom quando muda
  useEffect(() => {
    setCustomSince(since);
    setCustomUntil(until);
    setShowCustom(currentPreset === "custom");
  }, [since, until, currentPreset]);

  function applyPreset(preset: RangePreset) {
    // Clicar em "Personalizado" só abre o painel — não navega ainda
    if (preset === "custom") {
      setShowCustom(true);
      return;
    }
    setShowCustom(false);
    const params = new URLSearchParams(sp?.toString());
    params.set("preset", preset);
    params.delete("since");
    params.delete("until");
    router.push(`${pathname}?${params.toString()}`);
    setOpen(false);
  }

  function applyCustom() {
    if (!customSince || !customUntil) return;
    if (customSince > customUntil) return;
    const params = new URLSearchParams(sp?.toString());
    params.set("preset", "custom");
    params.set("since", customSince);
    params.set("until", customUntil);
    router.push(`${pathname}?${params.toString()}`);
    setOpen(false);
  }

  return (
    <div ref={wrapperRef} className="relative inline-block">
      <button
        onClick={() => setOpen((s) => !s)}
        className="pill text-[11px] font-mono uppercase tracking-[0.22em] text-white/70 hover:text-white"
      >
        <span className="dot text-teal-400 bg-teal-400" />
        Período · <span className="text-white normal-case tracking-wider">{currentLabel}</span>
        <svg
          width="10"
          height="10"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.5"
          className={`ml-1 transition-transform ${open ? "rotate-180" : ""}`}
        >
          <path d="M6 9l6 6 6-6" />
        </svg>
      </button>

      {open && (
        <div className="absolute left-0 mt-2 z-40 w-72 glass-strong rounded-2xl p-2 shadow-2xl">
          <div className="flex flex-col gap-0.5">
            {PRESET_OPTIONS.map((opt) => (
              <button
                key={opt.value}
                onClick={() => applyPreset(opt.value)}
                className={`flex items-center justify-between px-3 py-2 rounded-xl text-[13px] text-left transition ${
                  currentPreset === opt.value
                    ? "bg-white/10 text-white"
                    : "text-white/75 hover:bg-white/[0.05] hover:text-white"
                }`}
              >
                <span>{opt.label}</span>
                {currentPreset === opt.value && (
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                    <path d="M5 13l4 4L19 7" />
                  </svg>
                )}
              </button>
            ))}
          </div>

          {showCustom && (
            <div className="mt-2 pt-2 border-t border-white/10 px-1 pb-1">
              <div className="text-[10px] uppercase font-mono tracking-[0.18em] text-white/55 mb-2">
                Intervalo personalizado
              </div>
              <div className="flex flex-col gap-2">
                <div>
                  <label className="block text-[10px] uppercase font-mono tracking-[0.18em] text-white/45 mb-1">
                    Início
                  </label>
                  <input
                    type="date"
                    value={customSince}
                    onChange={(e) => setCustomSince(e.target.value)}
                    max={customUntil || undefined}
                    className="w-full bg-white/[0.06] border border-white/10 rounded-lg px-3 py-2 text-[12.5px] text-white focus:outline-none focus:border-white/30"
                  />
                </div>
                <div>
                  <label className="block text-[10px] uppercase font-mono tracking-[0.18em] text-white/45 mb-1">
                    Fim
                  </label>
                  <input
                    type="date"
                    value={customUntil}
                    onChange={(e) => setCustomUntil(e.target.value)}
                    min={customSince || undefined}
                    className="w-full bg-white/[0.06] border border-white/10 rounded-lg px-3 py-2 text-[12.5px] text-white focus:outline-none focus:border-white/30"
                  />
                </div>
              </div>
              <button
                onClick={applyCustom}
                disabled={!customSince || !customUntil || customSince > customUntil}
                className="mt-3 btn-glass btn-primary text-[12px] px-3 py-2 rounded-lg w-full disabled:opacity-40"
              >
                Aplicar
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
