import { NextResponse } from "next/server";
import { supabaseAdmin, useMockData } from "@/lib/supabase";

export async function GET() {
  if (useMockData()) {
    return NextResponse.json({ logs: [] });
  }
  const sb = supabaseAdmin();
  const { data } = await sb
    .from("sync_logs")
    .select("type, status, records_processed, message, started_at, finished_at")
    .eq("type", "facebook_sync")
    .order("started_at", { ascending: false })
    .limit(15);
  return NextResponse.json({ logs: data ?? [] });
}
