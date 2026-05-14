export type RangePreset =
  | "today"
  | "yesterday"
  | "last_7_days"
  | "this_month"
  | "last_month"
  | "custom";

const TZ = "America/Sao_Paulo";

/** Retorna YYYY-MM-DD na timezone do BR */
export function brDateStr(d: Date): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(d);
}

function parseLocal(iso: string): Date {
  // "2026-05-14" → meia-noite local
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y, (m ?? 1) - 1, d ?? 1);
}

/**
 * Resolve um range a partir de query params.
 * preset='today' (default), 'yesterday', 'last_7_days', 'this_month', 'last_month', 'custom'.
 * Para custom precisa de since e until (YYYY-MM-DD).
 */
export function resolveRange(
  sp: { preset?: string; since?: string; until?: string } = {}
): { preset: RangePreset; since: string; until: string; label: string; days: number } {
  const now = new Date();
  const todayStr = brDateStr(now);
  const [todayY, todayM, todayD] = todayStr.split("-").map(Number);

  let preset = (sp.preset as RangePreset) || "today";
  let since: string;
  let until: string;
  let label: string;

  switch (preset) {
    case "yesterday": {
      const y = new Date(todayY, todayM - 1, todayD - 1);
      since = until = brDateStr(y);
      label = "Ontem";
      break;
    }
    case "last_7_days": {
      const start = new Date(todayY, todayM - 1, todayD - 6);
      since = brDateStr(start);
      until = todayStr;
      label = "Últimos 7 dias";
      break;
    }
    case "this_month": {
      since = `${todayY}-${String(todayM).padStart(2, "0")}-01`;
      until = todayStr;
      label = "Este mês";
      break;
    }
    case "last_month": {
      // último dia do mês anterior
      const lastDayPrev = new Date(todayY, todayM - 1, 0);
      const ly = lastDayPrev.getFullYear();
      const lm = String(lastDayPrev.getMonth() + 1).padStart(2, "0");
      const ld = String(lastDayPrev.getDate()).padStart(2, "0");
      since = `${ly}-${lm}-01`;
      until = `${ly}-${lm}-${ld}`;
      label = "Mês passado";
      break;
    }
    case "custom": {
      if (sp.since && sp.until && /^\d{4}-\d{2}-\d{2}$/.test(sp.since) && /^\d{4}-\d{2}-\d{2}$/.test(sp.until)) {
        since = sp.since;
        until = sp.until;
        label = `${formatBR(since)} → ${formatBR(until)}`;
      } else {
        since = until = todayStr;
        label = "Hoje";
        preset = "today";
      }
      break;
    }
    case "today":
    default:
      since = until = todayStr;
      label = "Hoje";
      preset = "today";
      break;
  }

  const days = Math.max(
    1,
    Math.round((parseLocal(until).getTime() - parseLocal(since).getTime()) / 86400000) + 1
  );

  return { preset, since, until, label, days };
}

function formatBR(iso: string): string {
  const [y, m, d] = iso.split("-");
  return `${d}/${m}/${y}`;
}

export const PRESET_OPTIONS: Array<{ value: RangePreset; label: string }> = [
  { value: "today", label: "Hoje" },
  { value: "yesterday", label: "Ontem" },
  { value: "last_7_days", label: "Últimos 7 dias" },
  { value: "this_month", label: "Este mês" },
  { value: "last_month", label: "Mês passado" },
  { value: "custom", label: "Personalizado" },
];
