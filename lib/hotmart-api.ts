const API_BASE = "https://developers.hotmart.com/payments/api/v1";
const TOKEN_URL =
  "https://api-sec-vlc.hotmart.com/security/oauth/token?grant_type=client_credentials";

async function getToken(): Promise<string> {
  const basic = process.env.HOTMART_BASIC;
  if (!basic) throw new Error("HOTMART_BASIC não configurado");

  const res = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { Authorization: basic, "Content-Type": "application/json" },
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`Hotmart auth falhou: ${res.status} ${await res.text()}`);
  const data = await res.json();
  return data.access_token as string;
}

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

async function fetchAllPages<T>(path: string, params: DateRange, token: string): Promise<T[]> {
  const { startDate, endDate } = rangeToEpochMs(params);
  const allItems: T[] = [];
  let pageToken: string | undefined;

  do {
    const url = new URL(`${API_BASE}${path}`);
    url.searchParams.set("start_date", String(startDate));
    url.searchParams.set("end_date", String(endDate));
    url.searchParams.set("max_results", "500");
    if (pageToken) url.searchParams.set("page_token", pageToken);

    const res = await fetch(url.toString(), {
      headers: { Authorization: `Bearer ${token}` },
      cache: "no-store",
    });

    if (!res.ok) {
      const err = await res.text();
      throw new Error(`Hotmart API ${res.status}: ${err}`);
    }

    const data = await res.json();
    allItems.push(...(data.items ?? []));
    pageToken = data.page_info?.next_page_token ?? undefined;
  } while (pageToken);

  return allItems;
}

export async function fetchHotmartSales(params: DateRange): Promise<HotmartSaleItem[]> {
  const token = await getToken();
  return fetchAllPages<HotmartSaleItem>("/sales/history", params, token);
}

/** Comissão do produtor por transação (GET /sales/commissions). */
export async function fetchHotmartCommissions(
  params: DateRange
): Promise<Map<string, HotmartProducerCommission>> {
  const token = await getToken();
  const items = await fetchAllPages<{
    transaction?: string | null;
    commissions?: Array<{
      source?: string | null;
      commission?: { value?: number | string | null; currency_code?: string | null } | null;
    }> | null;
  }>("/sales/commissions", params, token);

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
