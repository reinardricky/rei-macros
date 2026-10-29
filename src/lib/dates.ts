const pad = (n: number) => String(n).padStart(2, '0');

/** Local calendar date as YYYY-MM-DD. */
export function toDateKey(date: Date): string {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

export function fromDateKey(key: string): Date {
  const [y, m, d] = key.split('-').map(Number);
  return new Date(y, m - 1, d);
}

export function todayKey(): string {
  return toDateKey(new Date());
}

export function addDays(key: string, days: number): string {
  const date = fromDateKey(key);
  date.setDate(date.getDate() + days);
  return toDateKey(date);
}

export function isDateKey(value: unknown): value is string {
  return typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value);
}

/** "Today", "Yesterday", or a weekday like "Monday". */
export function relativeDayName(key: string): string {
  const today = todayKey();
  if (key === today) return 'Today';
  if (key === addDays(today, -1)) return 'Yesterday';
  return fromDateKey(key).toLocaleDateString('en-US', { weekday: 'long' });
}

/** "Wednesday, Oct 29" */
export function longDate(key: string): string {
  return fromDateKey(key).toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' });
}

/** "Thu" */
export function shortWeekday(key: string): string {
  return fromDateKey(key).toLocaleDateString('en-US', { weekday: 'short' });
}

/** "7:32 PM" */
export function clockTime(iso: string): string {
  return new Date(iso).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
}

/** Combine a date key with the current wall-clock time, for meals logged on another day. */
export function timestampOn(key: string): string {
  const now = new Date();
  const date = fromDateKey(key);
  date.setHours(now.getHours(), now.getMinutes(), now.getSeconds());
  return date.toISOString();
}
