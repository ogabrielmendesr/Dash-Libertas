import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";

/**
 * Retorna a config do webhook (URL pública + secret).
 * Usado pela página /configuracoes.
 */
export async function GET() {
  const sb = supabaseAdmin();
  const { data: cfg, error } = await sb
    .from("webhook_configs")
    .select("webhook_secret, hottok, is_active, updated_at")
    .eq("platform", "hotmart")
    .maybeSingle();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!cfg) return NextResponse.json({ error: "Webhook não configurado" }, { status: 404 });

  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
  const url = `${baseUrl}/api/webhook/hotmart/${cfg.webhook_secret}`;

  // Últimos 6 eventos
  const { data: events } = await sb
    .from("sync_logs")
    .select("status, message, metadata, started_at, finished_at")
    .eq("type", "webhook_received")
    .order("started_at", { ascending: false })
    .limit(6);

  return NextResponse.json({
    url,
    secret: cfg.webhook_secret,
    hottok: cfg.hottok,
    is_active: cfg.is_active,
    updated_at: cfg.updated_at,
    recent_events: events ?? [],
  });
}

/**
 * Atualiza o Hottok ou regenera o secret.
 * Body: { action: "regenerate" | "set_hottok", hottok?: string }
 */
export async function POST(req: Request) {
  const sb = supabaseAdmin();
  const body = await req.json().catch(() => ({}));

  if (body.action === "regenerate") {
    const newSecret = generateSecret();
    const { error } = await sb
      .from("webhook_configs")
      .update({ webhook_secret: newSecret })
      .eq("platform", "hotmart");
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true, webhook_secret: newSecret });
  }

  if (body.action === "set_hottok") {
    const { error } = await sb
      .from("webhook_configs")
      .update({ hottok: body.hottok ?? null })
      .eq("platform", "hotmart");
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true });
  }

  return NextResponse.json({ error: "Ação desconhecida" }, { status: 400 });
}

function generateSecret(): string {
  const buf = new Uint8Array(16);
  crypto.getRandomValues(buf);
  return Array.from(buf).map((b) => b.toString(16).padStart(2, "0")).join("");
}
