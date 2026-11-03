export function fmtInt(n: number): string {
  return Math.round(n).toLocaleString('en-US');
}

/** Grams, rounded to whole numbers. */
export function fmtGrams(n: number): string {
  return `${Math.round(n)}g`;
}

/** Grams to one decimal, dropping a trailing ".0" ("12.5g", "8g"). */
export function fmtGrams1(n: number): string {
  return `${(Math.round(n * 10) / 10).toLocaleString('en-US', { maximumFractionDigits: 1 })}g`;
}

/** Portion amounts: whole numbers for big values, one decimal for small ones ("1.5 cup"). */
export function fmtAmount(amount: number, unit: string): string {
  const rounded = amount >= 10 ? Math.round(amount) : Math.round(amount * 10) / 10;
  return `${rounded} ${unit}`;
}
