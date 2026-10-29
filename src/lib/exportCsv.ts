import type { SQLiteDatabase } from 'expo-sqlite';
import { File, Paths } from 'expo-file-system';
import * as Sharing from 'expo-sharing';

import { getAllItemsForExport } from './db';

const csvCell = (value: string | number) => {
  const text = String(value);
  return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
};

/** Writes every logged item to a CSV file and opens the Android share sheet. */
export async function exportLogAsCsv(db: SQLiteDatabase): Promise<'shared' | 'empty' | 'unavailable'> {
  const rows = await getAllItemsForExport(db);
  if (rows.length === 0) return 'empty';
  if (!(await Sharing.isAvailableAsync())) return 'unavailable';

  const header = ['date', 'time', 'meal_slot', 'meal', 'item', 'amount', 'unit', 'kcal', 'protein_g', 'carbs_g', 'fat_g', 'confidence'];
  const lines = rows.map((r) =>
    [r.date, r.eaten_at, r.slot, r.meal, r.item, r.amount, r.unit, r.kcal, r.protein, r.carbs, r.fat, r.confidence]
      .map(csvCell)
      .join(','),
  );

  const file = new File(Paths.cache, 'rei-macros-log.csv');
  if (file.exists) file.delete();
  file.create();
  file.write([header.join(','), ...lines].join('\n'));

  await Sharing.shareAsync(file.uri, { dialogTitle: 'Export macro log', mimeType: 'text/csv' });
  return 'shared';
}
