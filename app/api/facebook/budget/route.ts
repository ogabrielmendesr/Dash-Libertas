import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import { updateCampaignBudget, MetaApiError } from "@/lib/meta";

/**
 * Atualiza o orçamento diário de uma campanha via Meta Graph API.
 * Body: { campaign_id: string, daily_budget: number }
 * daily_budget em unidade da moeda (ex: 100.00 = R$100)
 */
export async function POST(req: Request) {
  const sb = supabaseAdmin();
  const body = await req.json().catch(() => ({}));

  const campaignId = body.campaign_id as string | undefined;
  const dailyBudget = Number(body.daily_budget);

  if (!campaignId || !Number.isFinite(dailyBudget) || dailyBudget <= 0) {
    return NextResponse.json(
      { error: "Envie campaign_id e daily_budget (valor positivo em reais/dólares)" },
      { status: 400 }
    );
  }

  // Pega token
  const { data: conn } = await sb
    .from("fb_connections")
    .select("access_token")
    .order("updated_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!conn) {
    return NextResponse.json(
      { error: "Conecte o Meta primeiro em /configuracoes" },
      { status: 412 }
    );
  }

  try {
    // Meta espera o valor em centavos (R$100 = 10000)
    const valueCents = Math.round(dailyBudget * 100);

    await updateCampaignBudget({
      token: conn.access_token,
      campaignId,
      field: "daily_budget",
      valueCents,
    });

    // Atualiza cache local
    await sb
      .from("fb_campaign_budgets")
      .upsert(
        {
          campaign_id: campaignId,
          daily_budget: dailyBudget,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "campaign_id" }
      );

    return NextResponse.json({
      ok: true,
      campaign_id: campaignId,
      daily_budget: dailyBudget,
    });
  } catch (e) {
    const msg = e instanceof MetaApiError ? e.message : (e as Error).message;
    const status = e instanceof MetaApiError ? e.status : 500;
    return NextResponse.json({ error: msg }, { status });
  }
}
