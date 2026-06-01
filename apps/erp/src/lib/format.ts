export function formatLkr(value: number | string | null) {
  const n = Number(value ?? 0);
  return new Intl.NumberFormat('en-LK', {
    style: 'currency',
    currency: 'LKR',
    minimumFractionDigits: 2,
  }).format(n);
}
