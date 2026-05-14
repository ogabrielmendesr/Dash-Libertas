"use client";

import { useEffect, useState } from "react";
import { PageShell } from "@/components/PageShell";
import { PageHeader } from "@/components/PageHeader";
import { FacebookTab } from "./FacebookTab";
import { HotmartTab } from "./HotmartTab";
import { SyncTab } from "./SyncTab";
import { CambioTab } from "./CambioTab";

const TABS = [
  { id: "facebook", label: "Meta Ads" },
  { id: "hotmart", label: "Hotmart · Webhook" },
  { id: "cambio", label: "Câmbio" },
  { id: "sync", label: "Sincronização" },
  { id: "perfil", label: "Conta" },
] as const;

type TabId = (typeof TABS)[number]["id"];

export default function Page() {
  const [tab, setTab] = useState<TabId>("facebook");

  return (
    <PageShell>
      <PageHeader
        eyebrow="Configurações"
        title={
          <>
            <span className="italic text-white/75">Conecte</span>{" "}
            <span className="text-grad-aurora">suas fontes de dados.</span>
          </>
        }
        description={
          <>
            O painel cruza dois sinais: o <span className="font-mono text-white/85">ad.id</span> que volta
            da API do Meta e o mesmo <span className="font-mono text-white/85">ad.id</span> embarcado no{" "}
            <span className="font-mono text-white/85">utm_content</span> da venda pelo webhook da Hotmart.
            Configure ambos abaixo.
          </>
        }
      />

      <section className="px-4 sm:px-6 lg:px-8 pb-5">
        <div className="glass rounded-2xl p-1.5 inline-flex flex-wrap gap-1 max-w-full overflow-x-auto">
          {TABS.map((t) => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`px-4 py-2 rounded-xl text-[13px] font-medium transition whitespace-nowrap ${
                tab === t.id
                  ? "bg-white text-ink-0 shadow-[0_6px_16px_-6px_rgba(255,255,255,0.45)]"
                  : "text-white/70 hover:text-white"
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>
      </section>

      <section className="px-4 sm:px-6 lg:px-8 pb-10">
        {tab === "facebook" && <FacebookTab />}
        {tab === "hotmart" && <HotmartTab />}
        {tab === "cambio" && <CambioTab />}
        {tab === "sync" && <SyncTab />}
        {tab === "perfil" && <ProfileTab />}
      </section>
    </PageShell>
  );
}

function ProfileTab() {
  return (
    <div className="glass sheen p-5 sm:p-7 max-w-2xl">
      <div className="pill text-[11px] font-mono uppercase tracking-[0.18em] text-white/80">
        <span className="dot bg-violet-400 text-violet-400" /> Conta
      </div>
      <h2 className="mt-3 font-display text-[26px] text-white leading-tight">
        <span className="italic text-white/70">Modo</span> single-user
      </h2>
      <p className="mt-3 text-[13px] text-white/65">
        Este painel está configurado em modo single-user — sem login. Acesso direto e credenciais via{" "}
        <code className="font-mono text-white">.env.local</code>.
      </p>
      <p className="mt-2 text-[13px] text-white/55">
        Se um dia quiser abrir pra mais pessoas, dá pra ativar Supabase Auth + RLS por usuário.
      </p>
    </div>
  );
}
