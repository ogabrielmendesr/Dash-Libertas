import { NextResponse } from "next/server";
import { z } from "zod";
import { supabaseAdmin } from "@/lib/supabase";

const Body = z.object({ is_enabled: z.boolean() });

/**
 * Liga/desliga uma conta no dashboard.
 */
export async function PATCH(req: Request, ctx: { params: { adAccountId: string } }) {
  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Body inválido" }, { status: 400 });
  }
  const sb = supabaseAdmin();
  const { error } = await sb
    .from("fb_ad_accounts")
    .update({ is_enabled: parsed.data.is_enabled })
    .eq("ad_account_id", ctx.params.adAccountId);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
