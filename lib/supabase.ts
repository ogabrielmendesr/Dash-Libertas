import { createClient, SupabaseClient } from "@supabase/supabase-js";

/**
 * Server-side Supabase client.
 *
 * Usa SUPABASE_SERVICE_ROLE_KEY — NUNCA importe este arquivo em código
 * que rode no cliente. Toda a comunicação com o banco passa por API routes.
 */
let cached: SupabaseClient | null = null;

export function supabaseAdmin(): SupabaseClient {
  if (cached) return cached;

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !key) {
    throw new Error(
      "Supabase não configurado. Crie .env.local com NEXT_PUBLIC_SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY."
    );
  }

  cached = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: {
      // Defeats o cache de fetch do Next.js — toda query do Supabase é fresca
      fetch: (input, init) => fetch(input as RequestInfo, { ...init, cache: "no-store" }),
    },
  });

  return cached;
}

export function useMockData(): boolean {
  // Por padrão usa mocks até o usuário configurar o Supabase
  if (process.env.USE_MOCK_DATA === "true") return true;
  return !process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY;
}
