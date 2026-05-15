import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import { parseHotmartPayload, extractSaleRow } from "@/lib/hotmart";

/**
 * Endpoint público chamado pela Hotmart quando uma venda muda de status.
 * URL: POST /api/webhook/hotmart/{secret}
 *
 * O secret na URL substitui auth. Validamos contra webhook_configs.webhook_secret.
 * Se a Hotmart estiver com Hottok configurado, validamos também o header.
 *
 * Retorna 200 OK rapidamente — a Hotmart faz retry agressivo se demorar.
 */
export async function POST(req: NextRequest, ctx: { params: { secret: string } }) {
  const { secret } = ctx.params;
  const startedAt = new Date().toISOString();

  // Lê o body cru pra guardar em raw_payload mesmo se o parse falhar
  let rawBody: string;
  try {
    rawBody = await req.text();
  } catch {
    return NextResponse.json({ error: "Falha ao ler body" }, { status: 400 });
  }

  let json: unknown;
  try {
    json = JSON.parse(rawBody);
  } catch {
    return NextResponse.json({ error: "JSON inválido" }, { status: 400 });
  }

  const sb = supabaseAdmin();

  // 1. Valida o secret da URL
  const { data: cfg, error: cfgErr } = await sb
    .from("webhook_configs")
    .select("id, webhook_secret, hottok, is_active")
    .eq("platform", "hotmart")
    .maybeSingle();

  if (cfgErr) {
    return NextResponse.json({ error: "Erro lendo config" }, { status: 500 });
  }
  if (!cfg || !cfg.is_active || cfg.webhook_secret !== secret) {
    await logSync(sb, "error", 0, "secret inválido ou webhook desativado", { secret_preview: secret.slice(0, 6) }, startedAt);
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  }

  // 2. Valida o Hottok (se configurado)
  const headerHottok = req.headers.get("x-hotmart-hottok") ?? req.headers.get("hottok");
  const bodyHottok = (json as { hottok?: string }).hottok;
  if (cfg.hottok && cfg.hottok !== headerHottok && cfg.hottok !== bodyHottok) {
    await logSync(sb, "error", 0, "Hottok inválido", { has_header: !!headerHottok }, startedAt);
    return NextResponse.json({ error: "Hottok inválido" }, { status: 401 });
  }

  // 3. Parse + extract
  let row;
  try {
    const payload = parseHotmartPayload(json);
    row = extractSaleRow(payload);
  } catch (err) {
    await logSync(sb, "error", 0, `payload inválido: ${(err as Error).message}`, { raw: json }, startedAt);
    return NextResponse.json({ error: "Payload inválido" }, { status: 422 });
  }

  // 4. UPSERT
  const { error: upsertErr } = await sb
    .from("sales")
    .upsert(
      {
        transaction_id: row.transaction_id,
        status: row.status,
        product_id: row.product_id,
        product_name: row.product_name,
        sale_amount: row.sale_amount,
        commission_amount: row.commission_amount,
        producer_amount_usd: row.producer_amount_usd,
        producer_amount_brl: row.producer_amount_brl,
        producer_fx_rate: row.producer_fx_rate,
        payment_method: row.payment_method,
        placement: row.placement,
        traffic_source: row.traffic_source,
        currency: row.currency,
        utm_content: row.utm_content,
        utm_source: row.utm_source,
        utm_medium: row.utm_medium,
        utm_campaign: row.utm_campaign,
        utm_term: row.utm_term,
        sck: row.sck,
        buyer_email: row.buyer_email,
        buyer_name: row.buyer_name,
        sale_date: row.sale_date,
        webhook_received_at: new Date().toISOString(),
        raw_payload: json,
      },
      { onConflict: "transaction_id" }
    );

  if (upsertErr) {
    await logSync(sb, "error", 0, `upsert falhou: ${upsertErr.message}`, { transaction_id: row.transaction_id }, startedAt);
    return NextResponse.json({ error: "Falha ao salvar" }, { status: 500 });
  }

  // 5. Log de sucesso
  await logSync(
    sb,
    row.utm_content ? "success" : "warning",
    1,
    row.utm_content ? "venda registrada" : "venda sem utm_content (órfã)",
    { transaction_id: row.transaction_id, status: row.status, utm_content: row.utm_content },
    startedAt
  );

  return NextResponse.json({ ok: true, transaction_id: row.transaction_id });
}

// GET retorna info útil pro usuário testar no navegador
export async function GET(_req: NextRequest, ctx: { params: { secret: string } }) {
  const sb = supabaseAdmin();
  const { data: cfg } = await sb
    .from("webhook_configs")
    .select("webhook_secret, is_active")
    .eq("platform", "hotmart")
    .maybeSingle();

  if (!cfg || cfg.webhook_secret !== ctx.params.secret) {
    return NextResponse.json({ error: "Secret inválido" }, { status: 401 });
  }

  return NextResponse.json({
    status: "ok",
    message: "Endpoint do webhook está ativo. Hotmart deve fazer POST aqui.",
    method_expected: "POST",
    docs: "https://developers.hotmart.com/docs/pt-BR/webhooks/about-webhook/",
  });
}

async function logSync(
  sb: ReturnType<typeof supabaseAdmin>,
  status: "success" | "warning" | "error",
  records: number,
  message: string,
  metadata: Record<string, unknown>,
  startedAt: string
) {
  await sb.from("sync_logs").insert({
    type: "webhook_received",
    status,
    records_processed: records,
    message,
    metadata,
    started_at: startedAt,
    finished_at: new Date().toISOString(),
  });
}
