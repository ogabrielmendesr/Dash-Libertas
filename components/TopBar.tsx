"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { CurrencyToggle } from "./CurrencyToggle";

const NAV = [
  { href: "/", label: "Painel" },
  { href: "/campanhas", label: "Campanhas" },
  { href: "/vendas", label: "Vendas" },
  { href: "/configuracoes", label: "Configurações" },
];

export function TopBar() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  return (
    <header className="relative px-4 sm:px-6 lg:px-8 pt-5 sm:pt-7">
      <div className="glass-strong rounded-2xl sm:rounded-[24px] px-4 sm:px-5 py-3 sm:py-3.5">
        <div className="flex items-center justify-between gap-3">
          {/* Brand */}
          <Link href="/" className="flex items-center gap-3 min-w-0 shrink-0">
            <div
              className="relative w-9 h-9 sm:w-10 sm:h-10 rounded-2xl flex items-center justify-center shrink-0"
              style={{
                background: "linear-gradient(135deg, #2dd4bf 0%, #6366f1 55%, #8b5cf6 100%)",
                boxShadow: "inset 0 1px 0 rgba(255,255,255,0.45), 0 8px 22px -8px rgba(99,102,241,0.55)",
              }}
            >
              <span className="font-display italic text-white text-[22px] sm:text-[24px] leading-none -mt-1">L</span>
            </div>
            <div className="min-w-0 hidden sm:block">
              <div className="flex items-baseline gap-1.5">
                <span className="font-display italic text-[20px] sm:text-[22px] leading-none text-white">
                  Libertas
                </span>
                <span className="hidden sm:inline text-[10px] font-mono uppercase tracking-[0.22em] text-white/45">
                  v.026
                </span>
              </div>
              <div className="hidden lg:block text-[11px] text-white/55 -mt-0.5">
                Painel · Ads × Webhook
              </div>
            </div>
            <span className="font-display italic text-[20px] leading-none text-white sm:hidden">Libertas</span>
          </Link>

          {/* Nav — desktop */}
          <nav className="hidden md:flex items-center gap-1 p-1 rounded-full bg-white/[0.04] border border-white/10">
            {NAV.map((item) => {
              const active = pathname === item.href;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`px-3.5 py-1.5 rounded-full text-[12.5px] font-medium transition ${
                    active
                      ? "bg-white text-ink-0 shadow-[0_6px_16px_-6px_rgba(255,255,255,0.45)]"
                      : "text-white/70 hover:text-white"
                  }`}
                >
                  {item.label}
                </Link>
              );
            })}
          </nav>

          {/* Status + actions — desktop */}
          <div className="hidden md:flex items-center gap-2 shrink-0">
            <CurrencyToggle />
            <div className="pill hidden xl:flex">
              <span className="dot bg-emerald-400 text-emerald-400" />
              <span className="text-[11px] font-mono uppercase tracking-[0.16em] text-white/80">
                Meta
              </span>
            </div>
            <div className="pill hidden xl:flex">
              <span className="dot bg-cyan-400 text-cyan-400" />
              <span className="text-[11px] font-mono uppercase tracking-[0.16em] text-white/80">
                Webhook
              </span>
            </div>
            <button className="btn-glass btn-primary text-[13px] px-4 py-2 rounded-xl">Sincronizar</button>
          </div>

          {/* Mobile menu toggle */}
          <button
            onClick={() => setOpen((s) => !s)}
            className="md:hidden btn-glass px-3 py-2 rounded-xl text-[13px]"
            aria-label="Abrir menu"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              {open ? (
                <>
                  <path d="M6 6l12 12" />
                  <path d="M18 6L6 18" />
                </>
              ) : (
                <>
                  <path d="M3 6h18" />
                  <path d="M3 12h18" />
                  <path d="M3 18h18" />
                </>
              )}
            </svg>
          </button>
        </div>

        {/* Mobile drawer */}
        {open && (
          <div className="md:hidden mt-3 pt-3 border-t border-white/10 flex flex-col gap-3">
            <div className="flex flex-col gap-1">
              {NAV.map((item) => {
                const active = pathname === item.href;
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    onClick={() => setOpen(false)}
                    className={`px-3 py-2 rounded-xl text-[14px] font-medium transition ${
                      active
                        ? "bg-white text-ink-0"
                        : "bg-white/[0.04] text-white/80 border border-white/10"
                    }`}
                  >
                    {item.label}
                  </Link>
                );
              })}
            </div>
            <div className="flex items-center justify-between gap-3 pt-1">
              <span className="text-[11px] font-mono uppercase tracking-[0.16em] text-white/55">
                Moeda
              </span>
              <CurrencyToggle />
            </div>
            <div className="flex flex-wrap gap-2">
              <div className="pill">
                <span className="dot bg-emerald-400 text-emerald-400" />
                <span className="text-[11px] font-mono uppercase tracking-[0.16em] text-white/80">Meta</span>
              </div>
              <div className="pill">
                <span className="dot bg-cyan-400 text-cyan-400" />
                <span className="text-[11px] font-mono uppercase tracking-[0.16em] text-white/80">Webhook</span>
              </div>
            </div>
            <button className="btn-glass btn-primary text-[13px] px-4 py-2 rounded-xl w-full">
              Sincronizar agora
            </button>
          </div>
        )}
      </div>
    </header>
  );
}
