import { NextResponse } from "next/server";
import { z } from "zod";
import { supabaseAdmin } from "@/lib/supabase";
import { validateToken, listAdAccounts, MetaApiError } from "@/lib/meta";

const Body = z.object({ token: z.string().min(20) });

/**
 * Conecta o Meta:
 * - valida o token
 * - lista TODAS as contas de anúncios visíveis
 * - upsert do registro de conexão (single-user)
 * - upsert das contas em fb_ad_accounts (sem habilitar nenhuma — usuário escolhe depois)
 */
export async function POST(req: Request) {
  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.message }, { status: 400 });
  }

  try {
    const me = await validateToken(parsed.data.token);
    const accounts = await listAdAccounts(parsed.data.token);
    const sb = supabaseAdmin();

    // Single-user: reseta e regrava
    await sb.from("fb_connections").delete().neq("id", "00000000-0000-0000-0000-000000000000");
    const { error: connErr } = await sb.from("fb_connections").insert({
      access_token: parsed.data.token,
      fb_user_id: me.id,
      fb_user_name: me.name,
    });
    if (connErr) return NextResponse.json({ error: connErr.message }, { status: 500 });

    // Sincroniza catálogo de contas (sem mexer em is_enabled das já existentes)
    for (const a of accounts) {
      await sb
        .from("fb_ad_accounts")
        .upsert(
          {
            ad_account_id: a.id,
            name: a.name,
            currency: a.currency,
            is_active: a.account_status === 1,
          },
          { onConflict: "ad_account_id", ignoreDuplicates: false }
        )
        .select();
    }

    return NextResponse.json({
      ok: true,
      user: me,
      accounts_count: accounts.length,
    });
  } catch (e) {
    if (e instanceof MetaApiError) {
      return NextResponse.json({ error: e.message }, { status: e.status });
    }
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}

/**
 * Status da conexão.
 */
export async function GET() {
  const sb = supabaseAdmin();
  const { data: conn } = await sb
    .from("fb_connections")
    .select("fb_user_id, fb_user_name, token_expires_at, updated_at")
    .order("updated_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  const { count } = await sb
    .from("fb_ad_accounts")
    .select("*", { count: "exact", head: true });

  const { count: enabledCount } = await sb
    .from("fb_ad_accounts")
    .select("*", { count: "exact", head: true })
    .eq("is_enabled", true);

  if (!conn) return NextResponse.json({ connected: false });
  return NextResponse.json({
    connected: true,
    fb_user_id: conn.fb_user_id,
    fb_user_name: conn.fb_user_name,
    token_expires_at: conn.token_expires_at,
    updated_at: conn.updated_at,
    accounts_total: count ?? 0,
    accounts_enabled: enabledCount ?? 0,
  });
}

/**
 * Desconecta — remove token (mantém histórico de contas e insights).
 */
export async function DELETE() {
  const sb = supabaseAdmin();
  const { error } = await sb
    .from("fb_connections")
    .delete()
    .neq("id", "00000000-0000-0000-0000-000000000000");
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
