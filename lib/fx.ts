import { Currency } from "./currency";

/**
 * Conversão de moedas usando a taxa USD↔BRL guardada em app_settings.
 *
 * Convenção: fxUsdBrl = quantos R$ vale 1 US$. Ex: 5.20 → US$1 = R$5,20.
 *
 *  USD → BRL: valor * fxUsdBrl
 *  BRL → USD: valor / fxUsdBrl
 *  Mesma moeda: valor (não converte)
 */
export function convertAmount(
  value: number,
  from: Currency,
  to: Currency,
  fxUsdBrl: number
): number {
  if (from === to) return value;
  if (!fxUsdBrl || fxUsdBrl <= 0) return value;
  if (from === "USD" && to === "BRL") return value * fxUsdBrl;
  if (from === "BRL" && to === "USD") return value / fxUsdBrl;
  return value;
}
