import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import {
  fetchHotmartSales,
  fetchHotmartCommissions,
  HotmartSaleItem,
  HotmartProducerCommission,
} from "@/lib/hotmart-api";
import {
  normalizeHotmartStatus,
  extractAdIdFromSrc,
  extractPlacement,
  classifyTrafficSource,
} from "@/lib/hotmart";
import { brDateStr } from "@/lib/dateRange";

function toNum(v: number | string | null | undefined): number | null {
  if (v == null) return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

function mapRow(item: HotmartSaleItem, producer: HotmartProducerCommission | undefined) {
  const p = item.purchase!;
  // O history não traz utm_content; o ad_id vem embutido em tracking.source
  // (formato Hotmart Click Ads) ou external_code — mesmo parser do webhook.
  const src = p.tracking?.source ?? null;
  const utmContent =
    extractAdIdFromSrc(src) ?? extractAdIdFromSrc(p.tracking?.external_code) ?? null;

  // Mesma regra do webhook (extractSaleRow): data da compra, não da aprovação
  const dateMs = p.order_date ?? p.approved_date ?? Date.now();

  return {
    transaction_id: p.transaction!,
    status: normalizeHotmartStatus(p.status ?? ""),
    product_id: item.product?.id != null ? String(item.product.id) : null,
    product_name: item.product?.name ?? "Produto",
    sale_amount: toNum(p.price?.value) ?? 0,
    commission_amount: null,
    producer_amount_usd: producer?.currencyCode === "USD" ? producer.value : null,
    producer_amount_brl: producer?.currencyCode === "BRL" ? producer.value : null,
    producer_fx_rate: null,
    payment_method: p.payment?.type ?? null,
    placement: extractPlacement(src),
    traffic_source: classifyTrafficSource(src),
    currency: p.price?.currency_code ?? "BRL",
    utm_content: utmContent,
    utm_source: src ? "facebook" : null,
    utm_medium: null,
    utm_campaign: null,
    utm_term: null,
    sck: p.tracking?.source_sck ?? null,
    buyer_email: item.buyer?.email ?? null,
    buyer_name: item.buyer?.name ?? null,
    buyer_country: null,
    sale_date: new Date(dateMs).toISOString(),
  };
}

export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}));
  const days = Math.min(90, Math.max(1, Number(body.days) || 1));
  const startedAt = new Date().toISOString();
  const sb = supabaseAdmin();

  const untilStr: string = body.until ?? brDateStr(new Date());
  const sinceDate = new Date(`${untilStr}T12:00:00Z`);
  sinceDate.setUTCDate(sinceDate.getUTCDate() - (days - 1));
  const sinceStr: string = body.since ?? sinceDate.toISOString().slice(0, 10);

  try {
    const items = await fetchHotmartSales({ since: sinceStr, until: untilStr });

    // Dedup por transação (o history pode repetir itens entre páginas)
    const byTransaction = new Map<string, HotmartSaleItem>();
    for (const item of items) {
      const tx = item.purchase?.transaction;
      if (tx) byTransaction.set(tx, item);
    }
    const transactions = Array.from(byTransaction.keys());

    // Insere apenas o que está na Hotmart e NÃO está no banco — as linhas
    // existentes vêm do webhook com dados mais ricos (país, comissão BRL)
    // e não devem ser sobrescritas.
    const existing = new Set<string>();
    const chunkSize = 200;
    for (let i = 0; i < transactions.length; i += chunkSize) {
      const { data, error } = await sb
        .from("sales")
        .select("transaction_id")
        .in("transaction_id", transactions.slice(i, i + chunkSize));
      if (error) throw new Error(error.message);
      for (const row of data ?? []) existing.add(row.transaction_id);
    }

    const missing = transactions.filter((tx) => !existing.has(tx));

    let totalInserted = 0;
    if (missing.length > 0) {
      const producerByTx = await fetchHotmartCommissions({ since: sinceStr, until: untilStr });
      const rows = missing.map((tx) => mapRow(byTransaction.get(tx)!, producerByTx.get(tx)));
      for (let i = 0; i < rows.length; i += chunkSize) {
        const { error } = await sb
          .from("sales")
          .upsert(rows.slice(i, i + chunkSize), {
            onConflict: "transaction_id",
            ignoreDuplicates: true,
          });
        if (error) throw new Error(error.message);
      }
      totalInserted = rows.length;
    }

    await sb.from("sync_logs").insert({
      type: "hotmart_sync",
      status: "success",
      records_processed: totalInserted,
      message: `${totalInserted} venda(s) preenchida(s) · ${byTransaction.size} na Hotmart · ${days} dia(s)`,
      metadata: {
        since: sinceStr,
        until: untilStr,
        fetched: byTransaction.size,
        already_in_db: existing.size,
        inserted: totalInserted,
      },
      started_at: startedAt,
      finished_at: new Date().toISOString(),
    });

    return NextResponse.json({
      ok: true,
      records: totalInserted,
      fetched: byTransaction.size,
      alreadyInDb: existing.size,
      since: sinceStr,
      until: untilStr,
    });
  } catch (e) {
    const msg = (e as Error).message;
    await sb.from("sync_logs").insert({
      type: "hotmart_sync",
      status: "error",
      records_processed: 0,
      message: msg,
      metadata: { since: sinceStr, until: untilStr },
      started_at: startedAt,
      finished_at: new Date().toISOString(),
    });
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
