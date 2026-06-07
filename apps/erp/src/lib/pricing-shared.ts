export function netPrice(rate: string | number, discountPct: string | number): number {
  const r = Number(rate);
  const d = Number(discountPct ?? 0);
  return r * (1 - d / 100);
}
