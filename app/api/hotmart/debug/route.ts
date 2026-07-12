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
    if (externalToken) {
      // Pula a emissão de token próprio para não invalidar o token externo
      info.token_status = "pulado (token externo)";
      const end = Date.now();
      const start = end - 24 * 3600 * 1000;
      const r = await fetch(
        `https://developers.hotmart.com/payments/api/v1/sales/history?start_date=${start}&end_date=${end}&max_results=10`,
        { headers: { Authorization: `Bearer ${externalToken}` }, cache: "no-store" }
      );
      const body = await r.text();
      return NextResponse.json({ ...info, used_external_token: true, history: `${r.status} ${body.slice(0, 120)}` });
    }
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
      const base = `https://developers.hotmart.com/payments/api/v1/sales/history?start_date=${start}&end_date=${end}`;
      const variants: Array<[string, string, Record<string, string>]> = [
        ["padrao", `${base}&max_results=10`, {}],
        ["com_user_agent", `${base}&max_results=10`, { "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)" }],
        ["com_accept", `${base}&max_results=10`, { Accept: "application/json" }],
        ["sem_max_results", base, {}],
      ];
      for (const [name, url, extra] of variants) {
        const r = await fetch(url, {
          headers: { Authorization: `Bearer ${useToken}`, ...extra },
          cache: "no-store",
        });
        const body = await r.text();
        info[`v_${name}`] = `${r.status} ${body.slice(0, 80)}`;
      }
    }
  } catch (e) {
    info.exception = (e as Error).message;
  }

  return NextResponse.json(info);
}
