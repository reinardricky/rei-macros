import type { SQLiteDatabase } from 'expo-sqlite';

import { isMealSlot, type DayTotals, type Meal, type MealItem, type NewMeal, type Settings } from './types';

export const DATABASE_NAME = 'rei-macros.db';
const DATABASE_VERSION = 1;

export const DEFAULT_SETTINGS: Settings = {
  goals: { kcal: 2200, protein: 160, carbs: 220, fat: 70 },
  keepPhotos: true,
  reviewBeforeLogging: true,
};

/** Runs once per app start, before any screen renders (SQLiteProvider onInit). */
export async function migrateDbIfNeeded(db: SQLiteDatabase) {
  const result = await db.getFirstAsync<{ user_version: number }>('PRAGMA user_version');
  let version = result?.user_version ?? 0;
  if (version >= DATABASE_VERSION) return;

  if (version === 0) {
    await db.execAsync(`
      PRAGMA journal_mode = 'wal';
      CREATE TABLE meals (
        id INTEGER PRIMARY KEY NOT NULL,
        date TEXT NOT NULL,
        slot TEXT NOT NULL,
        name TEXT NOT NULL,
        eaten_at TEXT NOT NULL,
        photo_uri TEXT,
        note TEXT
      );
      CREATE INDEX meals_date ON meals (date);
      CREATE TABLE meal_items (
        id INTEGER PRIMARY KEY NOT NULL,
        meal_id INTEGER NOT NULL REFERENCES meals (id) ON DELETE CASCADE,
        position INTEGER NOT NULL,
        name TEXT NOT NULL,
        amount REAL NOT NULL,
        unit TEXT NOT NULL,
        kcal REAL NOT NULL,
        protein REAL NOT NULL,
        carbs REAL NOT NULL,
        fat REAL NOT NULL,
        confidence TEXT NOT NULL
      );
      CREATE INDEX meal_items_meal ON meal_items (meal_id);
      CREATE TABLE settings (
        key TEXT PRIMARY KEY NOT NULL,
        value TEXT NOT NULL
      );
    `);
    version = 1;
  }

  await db.execAsync(`PRAGMA user_version = ${DATABASE_VERSION}`);
}

type MealRow = {
  id: number;
  date: string;
  slot: string;
  name: string;
  eaten_at: string;
  photo_uri: string | null;
  note: string | null;
};

type ItemRow = MealItem & { meal_id: number };

export async function getMealsForDate(db: SQLiteDatabase, date: string): Promise<Meal[]> {
  const meals = await db.getAllAsync<MealRow>('SELECT * FROM meals WHERE date = ? ORDER BY eaten_at', date);
  if (meals.length === 0) return [];

  const items = await db.getAllAsync<ItemRow>(
    `SELECT meal_id, name, amount, unit, kcal, protein, carbs, fat, confidence
       FROM meal_items
      WHERE meal_id IN (SELECT id FROM meals WHERE date = ?)
      ORDER BY meal_id, position`,
    date,
  );

  return meals.map((m) => ({
    id: m.id,
    date: m.date,
    slot: isMealSlot(m.slot) ? m.slot : 'Snack',
    name: m.name,
    eatenAt: m.eaten_at,
    photoUri: m.photo_uri,
    note: m.note,
    items: items
      .filter((it) => it.meal_id === m.id)
      .map(({ meal_id: _mealId, ...item }) => item),
  }));
}

/** Per-day totals for every day in [from, to] that has at least one meal. */
export async function getDailyTotals(db: SQLiteDatabase, from: string, to: string): Promise<DayTotals[]> {
  return db.getAllAsync<DayTotals>(
    `SELECT m.date AS date,
            COUNT(DISTINCT m.id) AS meals,
            COALESCE(SUM(i.kcal), 0) AS kcal,
            COALESCE(SUM(i.protein), 0) AS protein,
            COALESCE(SUM(i.carbs), 0) AS carbs,
            COALESCE(SUM(i.fat), 0) AS fat
       FROM meals m
       LEFT JOIN meal_items i ON i.meal_id = m.id
      WHERE m.date BETWEEN ? AND ?
      GROUP BY m.date
      ORDER BY m.date DESC`,
    from,
    to,
  );
}

export async function insertMeal(db: SQLiteDatabase, meal: NewMeal): Promise<number> {
  let mealId = 0;
  await db.withTransactionAsync(async () => {
    const result = await db.runAsync(
      'INSERT INTO meals (date, slot, name, eaten_at, photo_uri, note) VALUES (?, ?, ?, ?, ?, ?)',
      meal.date,
      meal.slot,
      meal.name,
      meal.eatenAt,
      meal.photoUri,
      meal.note,
    );
    mealId = result.lastInsertRowId;
    for (const [position, it] of meal.items.entries()) {
      await db.runAsync(
        `INSERT INTO meal_items (meal_id, position, name, amount, unit, kcal, protein, carbs, fat, confidence)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        mealId,
        position,
        it.name,
        it.amount,
        it.unit,
        it.kcal,
        it.protein,
        it.carbs,
        it.fat,
        it.confidence,
      );
    }
  });
  return mealId;
}

export async function deleteMeal(db: SQLiteDatabase, id: number) {
  await db.withTransactionAsync(async () => {
    await db.runAsync('DELETE FROM meal_items WHERE meal_id = ?', id);
    await db.runAsync('DELETE FROM meals WHERE id = ?', id);
  });
}

/** Every logged item, oldest first, for CSV export. */
export async function getAllItemsForExport(db: SQLiteDatabase) {
  return db.getAllAsync<{
    date: string;
    eaten_at: string;
    slot: string;
    meal: string;
    item: string;
    amount: number;
    unit: string;
    kcal: number;
    protein: number;
    carbs: number;
    fat: number;
    confidence: string;
  }>(
    `SELECT m.date, m.eaten_at, m.slot, m.name AS meal, i.name AS item, i.amount, i.unit,
            i.kcal, i.protein, i.carbs, i.fat, i.confidence
       FROM meals m
       JOIN meal_items i ON i.meal_id = m.id
      ORDER BY m.eaten_at, i.position`,
  );
}

export async function getSettings(db: SQLiteDatabase): Promise<Settings> {
  const rows = await db.getAllAsync<{ key: string; value: string }>('SELECT key, value FROM settings');
  const stored: Partial<Settings> = {};
  for (const row of rows) {
    try {
      (stored as Record<string, unknown>)[row.key] = JSON.parse(row.value);
    } catch {
      // Ignore a corrupt value and fall back to the default.
    }
  }
  return {
    ...DEFAULT_SETTINGS,
    ...stored,
    goals: { ...DEFAULT_SETTINGS.goals, ...stored.goals },
  };
}

export async function saveSetting<K extends keyof Settings>(db: SQLiteDatabase, key: K, value: Settings[K]) {
  await db.runAsync(
    'INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT (key) DO UPDATE SET value = excluded.value',
    key,
    JSON.stringify(value),
  );
}
