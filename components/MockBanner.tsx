import Link from "next/link";

/**
 * Aviso amarelo no topo quando o painel está rodando com dados mockados
 * (Supabase ainda não configurado).
 */
export function MockBanner() {
  return (
    <div className="px-4 sm:px-6 lg:px-8 mt-3">
      <div className="glass glass-tinted-amber rounded-xl px-4 py-2.5 flex flex-wrap items-center gap-3 text-[12px] sm:text-[13px]">
        <span className="font-mono text-amber-300 tracking-wider text-[10px] uppercase">
          ⚠ Modo demonstração
        </span>
        <span className="text-white/75">
          Configure o Supabase no <code className="font-mono text-white">.env.local</code> para ver dados reais.
        </span>
        <Link
          href="/configuracoes"
          className="ml-auto text-white/80 hover:text-white underline underline-offset-2 font-medium"
        >
          Conectar agora →
        </Link>
      </div>
    </div>
  );
}
