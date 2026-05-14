export type Currency = "BRL" | "USD";

export const CURRENCY_INFO: Record<Currency, { symbol: string; locale: string; label: string }> = {
  BRL: { symbol: "R$", locale: "pt-BR", label: "Real" },
  USD: { symbol: "$", locale: "en-US", label: "Dólar" },
};

export function formatMoney(value: number, currency: Currency = "BRL"): string {
  const info = CURRENCY_INFO[currency] ?? CURRENCY_INFO.BRL;
  return value.toLocaleString(info.locale, {
    style: "currency",
    currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

export function formatInt(value: number, currency: Currency = "BRL"): string {
  const locale = CURRENCY_INFO[currency]?.locale ?? "pt-BR";
  return value.toLocaleString(locale, { maximumFractionDigits: 0 });
}

export function formatDecimal(value: number, digits = 2, currency: Currency = "BRL"): string {
  const locale = CURRENCY_INFO[currency]?.locale ?? "pt-BR";
  return value.toLocaleString(locale, {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  });
}
