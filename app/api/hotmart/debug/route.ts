import { NextResponse } from "next/server";

// Rota temporária de diagnóstico — remover após investigar o 400 em produção.
export async function GET(req: Request) {
  const externalToken = new URL(req.url).searchParams.get("token");
  const basic = process.env.HOTMART_BASIC ?? "";
  const info: Record<string, unknown> = {
    basic_len: basic.length,
    basic_prefix: basic.slice(0, 6),
    basic_tail: basic.slice(-4),
  };

  try {
    const tokenRes = await fetch(
      "https://api-sec-vlc.hotmart.com/security/oauth/token?grant_type=client_credentials",
      {
        method: "POST",
        headers: { Authorization: basic, "Content-Type": "application/json" },
        cache: "no-store",
      }
    );
    const tokenBody = await tokenRes.json().catch(() => null);
    info.token_status = tokenRes.status;
    info.token_keys = tokenBody ? Object.keys(tokenBody) : null;
    info.token_len = tokenBody?.access_token?.length ?? 0;
    info.token_type = tokenBody?.token_type ?? null;
    info.scope = tokenBody?.scope ?? null;

    const useToken = externalToken || tokenBody?.access_token;
    info.used_external_token = !!externalToken;
    if (useToken) {
      const end = Date.now();
      const start = end - 24 * 3600 * 1000;
      const histRes = await fetch(
        `https://developers.hotmart.com/payments/api/v1/sales/history?start_date=${start}&end_date=${end}&max_results=10`,
        {
          headers: { Authorization: `Bearer ${useToken}` },
          cache: "no-store",
        }
      );
      info.history_status = histRes.status;
      const histBody = await histRes.text();
      info.history_body_head = histBody.slice(0, 300);
    }
  } catch (e) {
    info.exception = (e as Error).message;
  }

  return NextResponse.json(info);
}
