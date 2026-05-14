import { NextResponse } from "next/server";
import { z } from "zod";
import { validateToken, listAdAccounts, MetaApiError } from "@/lib/meta";

const Body = z.object({ token: z.string().min(20) });

/**
 * Valida um token do Meta e retorna a lista de ad accounts disponíveis.
 * Não persiste nada.
 */
export async function POST(req: Request) {
  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Token inválido" }, { status: 400 });
  }

  try {
    const me = await validateToken(parsed.data.token);
    const accounts = await listAdAccounts(parsed.data.token);
    return NextResponse.json({
      ok: true,
      user: me,
      ad_accounts: accounts.map((a) => ({
        id: a.id,
        name: a.name,
        currency: a.currency,
        active: a.account_status === 1,
      })),
    });
  } catch (e) {
    if (e instanceof MetaApiError) {
      return NextResponse.json({ error: e.message, payload: e.payload }, { status: e.status });
    }
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}
