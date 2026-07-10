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

export type HotmartSaleItem = {
  transaction: string;
  status: string;
  product?: { id?: number | string; name?: string };
  buyer?: {
    email?: string | null;
    name?: string | null;
    address?: { country_iso?: string | null } | null;
  } | null;
  purchase_date?: number | null;
  approved_date?: number | null;
  price?: { value?: number | string | null; currency_value?: string | null } | null;
  commission?: { value?: number | string | null; currency_value?: string | null } | null;
  commissions?: Array<{
    source?: string | null;
    value?: number | string | null;
    currency_value?: string | null;
    currency_conversion?: {
      converted_value?: number | string | null;
      converted_to_currency?: string | null;
      conversion_rate?: number | string | null;
    } | null;
  }> | null;
  tracking?: {
    utm_source?: string | null;
    utm_medium?: string | null;
    utm_campaign?: string | null;
    utm_term?: string | null;
    utm_content?: string | null;
    source_sck?: string | null;
  } | null;
  origin?: { sck?: string | null; src?: string | null; xcod?: string | null } | null;
  payment?: { type?: string | null } | null;
};

export async function fetchHotmartSales(params: {
  since: string; // YYYY-MM-DD
  until: string; // YYYY-MM-DD
}): Promise<HotmartSaleItem[]> {
  const token = await getToken();

  // Converte datas para epoch ms no fuso BRT (UTC-3)
  const startDate = new Date(`${params.since}T00:00:00-03:00`).getTime();
  const endDate = new Date(`${params.until}T23:59:59-03:00`).getTime();

  const allItems: HotmartSaleItem[] = [];
  let pageToken: string | undefined;

  do {
    const url = new URL(`${API_BASE}/sales/history`);
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
