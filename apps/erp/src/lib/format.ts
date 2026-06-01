const lkrNumber = new Intl.NumberFormat('en-LK', {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

export function formatLkr(value: number | string | null) {
  const n = Number(value ?? 0);
  return new Intl.NumberFormat('en-LK', {
    style: 'currency',
    currency: 'LKR',
    minimumFractionDigits: 2,
  }).format(n);
}

/** Amount only — pair with a label or column header that includes “(LKR)”. */
export function formatLkrAmount(value: number | string | null) {
  return lkrNumber.format(Number(value ?? 0));
}
