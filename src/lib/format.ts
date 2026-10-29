export function fmtInt(n: number): string {
  return Math.round(n).toLocaleString('en-US');
}

/** Grams, rounded to whole numbers. */
export function fmtGrams(n: number): string {
  return `${Math.round(n)}g`;
}

/** Portion amounts: whole numbers for big values, one decimal for small ones ("1.5 cup"). */
export function fmtAmount(amount: number, unit: string): string {
  const rounded = amount >= 10 ? Math.round(amount) : Math.round(amount * 10) / 10;
  return `${rounded} ${unit}`;
}
