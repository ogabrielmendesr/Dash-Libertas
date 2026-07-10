import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import { fetchHotmartSales, HotmartSaleItem } from "@/lib/hotmart-api";
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

function mapRow(item: HotmartSaleItem) {
  const producer = (item.commissions ?? []).find((c) => c?.source === "PRODUCER");

  const producerAmountUsd = toNum(producer?.value);
  const producerAmountBrl =
    producer?.currency_conversion?.converted_to_currency === "BRL"
      ? toNum(producer.currency_conversion.converted_value)
      : null;
  const producerFxRate = toNum(producer?.currency_conversion?.conversion_rate);

  const src = item.origin?.src ?? null;
  const utmContent =
    item.tracking?.utm_content ||
    extractAdIdFromSrc(src) ||
    extractAdIdFromSrc(item.origin?.xcod) ||
    null;

  const dateMs = item.approved_date ?? item.purchase_date ?? Date.now();

  return {
    transaction_id: item.transaction,
    status: normalizeHotmartStatus(item.status ?? ""),
    product_id: item.product?.id != null ? String(item.product.id) : null,
    product_name: item.product?.name ?? "Produto",
    sale_amount: toNum(item.price?.value) ?? 0,
    commission_amount: toNum(item.commission?.value),
    producer_amount_usd: producerAmountUsd,
    producer_amount_brl: producerAmountBrl,
    producer_fx_rate: producerFxRate,
    payment_method: item.payment?.type ?? null,
    placement: extractPlacement(src),
    traffic_source: classifyTrafficSource(src),
    currency: item.price?.currency_value ?? "BRL",
    utm_content: utmContent,
    utm_source: item.tracking?.utm_source ?? (src ? "facebook" : null),
    utm_medium: item.tracking?.utm_medium ?? null,
    utm_campaign: item.tracking?.utm_campaign ?? null,
    utm_term: item.tracking?.utm_term ?? null,
    sck: item.tracking?.source_sck ?? item.origin?.sck ?? null,
    buyer_email: item.buyer?.email ?? null,
    buyer_name: item.buyer?.name ?? null,
    buyer_country: item.buyer?.address?.country_iso ?? null,
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

    let totalUpserted = 0;
    if (items.length > 0) {
      const rows = items.map(mapRow);
      const batchSize = 200;
      for (let i = 0; i < rows.length; i += batchSize) {
        const { error } = await sb
          .from("sales")
          .upsert(rows.slice(i, i + batchSize), { onConflict: "transaction_id" });
        if (error) throw new Error(error.message);
        totalUpserted += rows.slice(i, i + batchSize).length;
      }
    }

    await sb.from("sync_logs").insert({
      type: "hotmart_sync",
      status: "success",
      records_processed: totalUpserted,
      message: `${totalUpserted} vendas sincronizadas · ${days} dia(s)`,
      metadata: { since: sinceStr, until: untilStr, fetched: items.length },
      started_at: startedAt,
      finished_at: new Date().toISOString(),
    });

    return NextResponse.json({ ok: true, records: totalUpserted, since: sinceStr, until: untilStr });
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
