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
            sck: z.string().optional().nullable(),
          })
          .passthrough(),
      })
      .passthrough(),
  })
  .passthrough();

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
  const purchase = payload.data.purchase;
  const product = payload.data.product;
  const buyer = payload.data.buyer ?? undefined;
  const tracking = purchase.tracking ?? undefined;

  const priceValue =
    typeof purchase.price?.value === "string"
      ? parseFloat(purchase.price.value)
      : purchase.price?.value ?? 0;

  const commissionValue =
    typeof purchase.commission?.value === "string"
      ? parseFloat(purchase.commission.value)
      : purchase.commission?.value;

  const orderDateMs = purchase.order_date ?? purchase.approved_date ?? Date.now();

  return {
    transaction_id: purchase.transaction,
    status: normalizeHotmartStatus(purchase.status),
    product_id: product?.id != null ? String(product.id) : null,
    product_name: product?.name ?? "Produto",
    sale_amount: Number.isFinite(priceValue) ? priceValue : 0,
    commission_amount: Number.isFinite(commissionValue as number)
      ? (commissionValue as number)
      : null,
    currency: purchase.price?.currency_value ?? "BRL",
    utm_content: tracking?.utm_content ?? null,
    utm_source: tracking?.utm_source ?? null,
    utm_medium: tracking?.utm_medium ?? null,
    utm_campaign: tracking?.utm_campaign ?? null,
    utm_term: tracking?.utm_term ?? null,
    sck: tracking?.source_sck ?? purchase.sck ?? null,
    buyer_email: buyer?.email ?? null,
    buyer_name: buyer?.name ?? null,
    sale_date: new Date(orderDateMs).toISOString(),
  };
}
