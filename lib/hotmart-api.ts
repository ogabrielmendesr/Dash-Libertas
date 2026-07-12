// Acesso à API de pagamentos da Hotmart via edge function `hotmart-proxy`
// no Supabase (sa-east-1). Chamada direta não funciona em produção: a Hotmart
// vincula o token à origem e recusa requisições vindas da Vercel.

// ⚠ Diferente do webhook: no GET /sales/history os campos da venda vêm
// aninhados em `purchase`, o tracking só traz source/source_sck/external_code
// (sem utm_*), e não há commissions nem buyer.address.
export type HotmartSaleItem = {
  buyer?: { name?: string | null; email?: string | null } | null;
  product?: { id?: number | string | null; name?: string | null } | null;
  purchase?: {
    transaction?: string | null;
    status?: string | null;
    order_date?: number | null;
    approved_date?: number | null;
    price?: { value?: number | string | null; currency_code?: string | null } | null;
    payment?: { type?: string | null; method?: string | null } | null;
    tracking?: {
      source?: string | null;
      source_sck?: string | null;
      external_code?: string | null;
    } | null;
  } | null;
};

export type HotmartProducerCommission = {
  value: number | null;
  currencyCode: string | null;
};

type DateRange = {
  since: string; // YYYY-MM-DD
  until: string; // YYYY-MM-DD
};

function rangeToEpochMs(params: DateRange) {
  // Converte datas para epoch ms no fuso BRT (UTC-3)
  return {
    startDate: new Date(`${params.since}T00:00:00-03:00`).getTime(),
    endDate: new Date(`${params.until}T23:59:59-03:00`).getTime(),
  };
}

async function fetchViaProxy<T>(path: string, params: DateRange): Promise<T[]> {
  const basic = process.env.HOTMART_BASIC;
  if (!basic) throw new Error("HOTMART_BASIC não configurado");

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !serviceKey) throw new Error("Supabase não configurado");

  const { startDate, endDate } = rangeToEpochMs(params);

  const res = await fetch(`${supabaseUrl}/functions/v1/hotmart-proxy`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${serviceKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ basic, path, start_date: startDate, end_date: endDate }),
    cache: "no-store",
  });

  const data = await res.json().catch(() => null);
  if (!res.ok || data?.error) {
    throw new Error(data?.error ?? `hotmart-proxy falhou: ${res.status}`);
  }
  return (data.items ?? []) as T[];
}

export async function fetchHotmartSales(params: DateRange): Promise<HotmartSaleItem[]> {
  return fetchViaProxy<HotmartSaleItem>("/sales/history", params);
}

/** Comissão do produtor por transação (GET /sales/commissions). */
export async function fetchHotmartCommissions(
  params: DateRange
): Promise<Map<string, HotmartProducerCommission>> {
  const items = await fetchViaProxy<{
    transaction?: string | null;
    commissions?: Array<{
      source?: string | null;
      commission?: { value?: number | string | null; currency_code?: string | null } | null;
    }> | null;
  }>("/sales/commissions", params);

  const byTransaction = new Map<string, HotmartProducerCommission>();
  for (const item of items) {
    if (!item.transaction) continue;
    const producer = (item.commissions ?? []).find((c) => c?.source === "PRODUCER");
    if (!producer?.commission) continue;
    const value = Number(producer.commission.value);
    byTransaction.set(item.transaction, {
      value: Number.isFinite(value) ? value : null,
      currencyCode: producer.commission.currency_code ?? null,
    });
  }
  return byTransaction;
}
