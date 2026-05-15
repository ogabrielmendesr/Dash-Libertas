import { z } from "zod";

/**
 * Parser do payload de Postback 2.0 da Hotmart.
 * Cobre os eventos: PURCHASE_APPROVED, PURCHASE_REFUNDED, PURCHASE_CHARGEBACK,
 * PURCHASE_DELAYED, PURCHASE_CANCELED.
 *
 * Doc: https://developers.hotmart.com/docs/pt-BR/webhooks/about-webhook/
 */

// Schema permissivo — Hotmart pode acrescentar campos sem aviso
const TrackingSchema = z
  .object({
    utm_source: z.string().optional().nullable(),
    utm_medium: z.string().optional().nullable(),
    utm_campaign: z.string().optional().nullable(),
    utm_term: z.string().optional().nullable(),
    utm_content: z.string().optional().nullable(),
    source_sck: z.string().optional().nullable(),
    source: z.string().optional().nullable(),
  })
  .passthrough()
  .optional()
  .nullable();

const PriceSchema = z
  .object({
    value: z.number().or(z.string()).optional(),
    currency_value: z.string().optional(),
  })
  .passthrough();

const CommissionSchema = z
  .object({
    value: z.number().or(z.string()).optional(),
    currency_value: z.string().optional(),
  })
  .passthrough()
  .optional()
  .nullable();

const OriginSchema = z
  .object({
    sck: z.string().optional().nullable(),
    src: z.string().optional().nullable(),
    xcod: z.string().optional().nullable(),
  })
  .passthrough()
  .optional()
  .nullable();

const HotmartWebhookSchema = z
  .object({
    id: z.string().optional(),
    event: z.string(),
    version: z.string().optional(),
    creation_date: z.number().optional(),
    hottok: z.string().optional(),
    data: z
      .object({
        product: z
          .object({
            id: z.union([z.number(), z.string()]).optional().nullable(),
            name: z.string().optional().nullable(),
          })
          .passthrough()
          .optional(),
        buyer: z
          .object({
            email: z.string().email().optional().nullable(),
            name: z.string().optional().nullable(),
          })
          .passthrough()
          .optional()
          .nullable(),
        commissions: z.array(CommissionSchema).optional(),
        purchase: z
          .object({
            transaction: z.string(),
            status: z.string(),
            order_date: z.number().optional(),
            approved_date: z.number().optional().nullable(),
            order_ref: z.string().optional().nullable(),
            price: PriceSchema.optional(),
            commission: CommissionSchema,
            tracking: TrackingSchema,
            origin: OriginSchema,
            sck: z.string().optional().nullable(),
          })
          .passthrough(),
      })
      .passthrough(),
  })
  .passthrough();

/**
 * Extrai o ad_id do Facebook do campo `purchase.origin.src` da Hotmart.
 *
 * Formato observado (Hotmart Click Ads):
 *   FB|<adset_name>|<adset_id>|<campaign_name>|<campaign_id>|<ad_name>|<ad_id>|<placement>
 *
 * Estratégia: pegar todos os IDs numéricos longos (10+ dígitos) e retornar o ÚLTIMO,
 * que pelo padrão observado é sempre o ad_id (vem antes do placement).
 */
export function extractAdIdFromSrc(src: string | null | undefined): string | null {
  if (!src) return null;
  const matches = src.match(/\d{10,}/g);
  if (!matches || matches.length === 0) return null;
  return matches[matches.length - 1];
}

export type HotmartWebhook = z.infer<typeof HotmartWebhookSchema>;

export function parseHotmartPayload(raw: unknown): HotmartWebhook {
  return HotmartWebhookSchema.parse(raw);
}

const STATUS_MAP: Record<string, "approved" | "pending" | "refunded" | "cancelled" | "chargeback"> = {
  APPROVED: "approved",
  COMPLETED: "approved",
  DELAYED: "pending",
  PRINTED_BILLET: "pending",
  WAITING_PAYMENT: "pending",
  REFUNDED: "refunded",
  CANCELED: "cancelled",
  CANCELLED: "cancelled",
  CHARGEBACK: "chargeback",
  PROTESTED: "chargeback",
};

export function normalizeHotmartStatus(
  status: string
): "approved" | "pending" | "refunded" | "cancelled" | "chargeback" {
  return STATUS_MAP[status?.toUpperCase()] ?? "pending";
}

export function extractSaleRow(payload: HotmartWebhook) {
  const purchase = payload.data.purchase as Record<string, any>;
  const product = payload.data.product;
  const buyer = payload.data.buyer ?? undefined;
  const tracking = purchase.tracking ?? undefined;
  const origin = purchase.origin ?? undefined;

  const priceValue =
    typeof purchase.price?.value === "string"
      ? parseFloat(purchase.price.value)
      : purchase.price?.value ?? 0;

  const commissionValue =
    typeof purchase.commission?.value === "string"
      ? parseFloat(purchase.commission.value)
      : purchase.commission?.value;

  // ⚠ Receita real do produtor (já convertida pela Hotmart com câmbio real)
  // commissions[source=PRODUCER]:
  //   value                              = Faturamento líquido (USD geralmente)
  //   currency_conversion.converted_value = "Valor que você recebeu convertido" (BRL)
  //   currency_conversion.conversion_rate = câmbio que a Hotmart usou
  const commissions = (payload.data as any).commissions as Array<any> | undefined;
  const producer = (commissions ?? []).find((c) => c?.source === "PRODUCER");
  const producerAmountUsd = producer
    ? typeof producer.value === "string"
      ? parseFloat(producer.value)
      : Number(producer.value)
    : null;
  const producerAmountBrl =
    producer?.currency_conversion?.converted_to_currency === "BRL"
      ? typeof producer.currency_conversion.converted_value === "string"
        ? parseFloat(producer.currency_conversion.converted_value)
        : Number(producer.currency_conversion.converted_value)
      : null;
  const producerFxRate = producer?.currency_conversion?.conversion_rate
    ? typeof producer.currency_conversion.conversion_rate === "string"
      ? parseFloat(producer.currency_conversion.conversion_rate)
      : Number(producer.currency_conversion.conversion_rate)
    : null;

  const orderDateMs = purchase.order_date ?? purchase.approved_date ?? Date.now();

  // ⚠ Hotmart pode entregar o ad_id em 2 lugares:
  //   1) tracking.utm_content (anúncios manuais com utm_content={{ad.id}})
  //   2) purchase.origin.src/xcod (Hotmart Click Ads — formato proprietário)
  // Usamos utm_content se vier, senão extraímos do origin.src/xcod.
  const utmContentFromTracking = tracking?.utm_content ?? null;
  const utmContentFromOrigin =
    extractAdIdFromSrc(origin?.src) ?? extractAdIdFromSrc(origin?.xcod);
  const utmContent = utmContentFromTracking || utmContentFromOrigin;

  return {
    transaction_id: purchase.transaction,
    status: normalizeHotmartStatus(purchase.status),
    product_id: product?.id != null ? String(product.id) : null,
    product_name: product?.name ?? "Produto",
    sale_amount: Number.isFinite(priceValue) ? priceValue : 0,
    commission_amount: Number.isFinite(commissionValue as number)
      ? (commissionValue as number)
      : null,
    producer_amount_usd: Number.isFinite(producerAmountUsd as number) ? producerAmountUsd : null,
    producer_amount_brl: Number.isFinite(producerAmountBrl as number) ? producerAmountBrl : null,
    producer_fx_rate: Number.isFinite(producerFxRate as number) ? producerFxRate : null,
    currency: purchase.price?.currency_value ?? "BRL",
    utm_content: utmContent,
    utm_source: tracking?.utm_source ?? (origin?.src ? "facebook" : null),
    utm_medium: tracking?.utm_medium ?? null,
    utm_campaign: tracking?.utm_campaign ?? null,
    utm_term: tracking?.utm_term ?? null,
    sck: tracking?.source_sck ?? origin?.sck ?? purchase.sck ?? null,
    buyer_email: buyer?.email ?? null,
    buyer_name: buyer?.name ?? null,
    sale_date: new Date(orderDateMs).toISOString(),
  };
}
