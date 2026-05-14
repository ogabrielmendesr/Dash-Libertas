/**
 * Cliente da Meta Marketing API (Graph API v21.0).
 * Sem SDK — só fetch direto. O token vem do usuário e é guardado em fb_connections.
 */

const GRAPH = "https://graph.facebook.com/v21.0";

export type FbAdAccount = {
  id: string;        // act_1234567890
  name: string;
  currency: string;
  account_status: number;
};

export type FbInsightRow = {
  ad_id: string;
  ad_name: string;
  adset_id: string;
  adset_name: string;
  campaign_id: string;
  campaign_name: string;
  date_start: string;
  spend: string;
  impressions: string;
  inline_link_clicks?: string;
  actions?: Array<{ action_type: string; value: string }>;
};

export class MetaApiError extends Error {
  constructor(public status: number, public payload: unknown) {
    super(typeof payload === "object" && payload && "error" in payload
      ? String((payload as { error: { message?: string } }).error?.message ?? "Meta API error")
      : "Meta API error");
  }
}

async function graphFetch<T>(path: string, params: Record<string, string>, token: string): Promise<T> {
  const qs = new URLSearchParams({ ...params, access_token: token }).toString();
  const r = await fetch(`${GRAPH}${path}?${qs}`, { cache: "no-store" });
  const body = await r.json();
  if (!r.ok) throw new MetaApiError(r.status, body);
  return body as T;
}

/**
 * Valida o token e retorna o usuário Meta dono dele.
 */
export async function validateToken(token: string) {
  return graphFetch<{ id: string; name: string }>("/me", { fields: "id,name" }, token);
}

/**
 * Lista todas as ad accounts visíveis pelo token.
 */
export async function listAdAccounts(token: string): Promise<FbAdAccount[]> {
  type Resp = { data: FbAdAccount[]; paging?: { next?: string } };
  const all: FbAdAccount[] = [];
  let next = "/me/adaccounts";
  let firstCall = true;

  while (next) {
    const params: Record<string, string> = firstCall
      ? { fields: "id,name,currency,account_status", limit: "100" }
      : {};
    firstCall = false;

    const resp: Resp = await graphFetch(next, params, token);
    all.push(...resp.data);

    if (resp.paging?.next) {
      // resp.paging.next é uma URL completa — extrai só o path
      const u = new URL(resp.paging.next);
      next = u.pathname.replace(/^\/v\d+\.\d+/, "") + u.search;
    } else {
      next = "";
    }
  }

  return all;
}

/**
 * Busca insights ao nível de anúncio (level=ad) para um período.
 * Retorna uma linha por (ad_id, date).
 */
export async function fetchAdInsights(opts: {
  token: string;
  adAccountId: string;       // act_...
  since: string;             // YYYY-MM-DD
  until: string;             // YYYY-MM-DD
}): Promise<FbInsightRow[]> {
  type Resp = { data: FbInsightRow[]; paging?: { cursors?: { after?: string }; next?: string } };
  const all: FbInsightRow[] = [];
  let after: string | undefined;

  do {
    const params: Record<string, string> = {
      level: "ad",
      fields:
        "ad_id,ad_name,adset_id,adset_name,campaign_id,campaign_name,spend,impressions,inline_link_clicks,actions",
      time_range: JSON.stringify({ since: opts.since, until: opts.until }),
      time_increment: "1",
      limit: "200",
    };
    if (after) params.after = after;

    const resp: Resp = await graphFetch(`/${opts.adAccountId}/insights`, params, opts.token);
    all.push(...resp.data);
    after = resp.paging?.cursors?.after;
    if (!resp.paging?.next) after = undefined;
  } while (after);

  return all;
}

/**
 * Extrai métricas de "actions" — page_view e initiate_checkout.
 */
export function extractActions(actions: FbInsightRow["actions"] = []) {
  const get = (type: string) => {
    const found = actions.find((a) => a.action_type === type);
    return found ? Number(found.value) : 0;
  };
  return {
    landing_page_views: get("landing_page_view"),
    initiate_checkouts:
      get("initiate_checkout") || get("offsite_conversion.fb_pixel_initiate_checkout") || get("onsite_conversion.initiate_checkout"),
  };
}
