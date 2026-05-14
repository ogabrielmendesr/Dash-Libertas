import { NextResponse } from "next/server";
import { supabaseAdmin, useMockData } from "@/lib/supabase";
import { mockSales } from "@/lib/mockApi";

/**
 * Lista de vendas (com nome do anúncio resolvido pelo cruzamento ad.id = utm_content).
 * Query: ?status=&product=&q=&limit=
 */
export async function GET(req: Request) {
  if (useMockData()) return NextResponse.json({ ...mockSales(), mock: true });

  const sb = supabaseAdmin();
  const url = new URL(req.url);
  const status = url.searchParams.get("status");
  const product = url.searchParams.get("product");
  const q = url.searchParams.get("q");
  const limit = Math.min(500, Math.max(1, Number(url.searchParams.get("limit")) || 200));

  let query = sb
    .from("sales")
    .select(
      "id, transaction_id, status, product_name, sale_amount, utm_content, sale_date, buyer_email"
    )
    .order("sale_date", { ascending: false })
    .limit(limit);

  if (status && status !== "all") query = query.eq("status", status);
  if (product && product !== "all") query = query.eq("product_name", product);
  if (q) {
    // OR ilike em vários campos
    query = query.or(
      `product_name.ilike.%${q}%,transaction_id.ilike.%${q}%,utm_content.ilike.%${q}%`
    );
  }

  const { data: sales, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Resolve nome do anúncio agregando últimos 90 dias de insights
  const ninetyAgo = new Date();
  ninetyAgo.setDate(ninetyAgo.getDate() - 90);

  const utmIds = Array.from(new Set((sales ?? []).map((s) => s.utm_content).filter(Boolean) as string[]));
  let adMap: Map<string, { ad_name: string; campaign_name: string }> = new Map();
  if (utmIds.length > 0) {
    const { data: ads } = await sb
      .from("fb_ad_insights")
      .select("ad_id, ad_name, campaign_name")
      .in("ad_id", utmIds);
    for (const a of ads ?? []) {
      adMap.set(a.ad_id, { ad_name: a.ad_name, campaign_name: a.campaign_name });
    }
  }

  const products = Array.from(new Set((sales ?? []).map((s) => s.product_name).filter(Boolean)));

  const totals = (sales ?? []).reduce(
    (a, s) => {
      const amt = Number(s.sale_amount);
      if (s.status === "approved") {
        a.revenue += amt;
        a.approved += 1;
      } else if (s.status === "refunded") {
        a.refunded += amt;
      }
      if (s.utm_content && adMap.has(s.utm_content)) a.linked += 1;
      return a;
    },
    { revenue: 0, refunded: 0, approved: 0, linked: 0 }
  );

  return NextResponse.json({
    sales: (sales ?? []).map((s) => ({
      ...s,
      sale_amount: Number(s.sale_amount),
      ad_name: s.utm_content ? adMap.get(s.utm_content)?.ad_name ?? null : null,
      campaign_name: s.utm_content ? adMap.get(s.utm_content)?.campaign_name ?? null : null,
    })),
    products,
    totals,
  });
}
