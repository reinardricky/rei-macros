export const MEAL_SLOTS = ['Breakfast', 'Lunch', 'Snack', 'Dinner'] as const;
export type MealSlot = (typeof MEAL_SLOTS)[number];

export type Confidence = 'high' | 'medium' | 'low';

export type Macros = {
  kcal: number;
  protein: number;
  carbs: number;
  fat: number;
};

export type MealItem = Macros & {
  name: string;
  amount: number;
  unit: string;
  confidence: Confidence;
};

export type Meal = {
  id: number;
  date: string; // YYYY-MM-DD, local time
  slot: MealSlot;
  name: string;
  eatenAt: string; // ISO timestamp
  photoUri: string | null;
  note: string | null;
  items: MealItem[];
};

export type NewMeal = Omit<Meal, 'id'>;

export type Goals = Macros;

/** `api` = the in-app AI call (Gemini by default); `claude-app` = hand off to the Claude app. */
export type Analyzer = 'api' | 'claude-app';

export type Settings = {
  goals: Goals;
  keepPhotos: boolean;
  reviewBeforeLogging: boolean;
  analyzer: Analyzer;
};

export type DayTotals = Macros & {
  date: string;
  meals: number;
};

export function isMealSlot(value: unknown): value is MealSlot {
  return typeof value === 'string' && (MEAL_SLOTS as readonly string[]).includes(value);
}

export function sumMacros(items: Macros[]): Macros {
  return items.reduce<Macros>(
    (acc, it) => ({
      kcal: acc.kcal + it.kcal,
      protein: acc.protein + it.protein,
      carbs: acc.carbs + it.carbs,
      fat: acc.fat + it.fat,
    }),
    { kcal: 0, protein: 0, carbs: 0, fat: 0 },
  );
}

/** Suggest a meal slot from the time of day. */
export function slotForTime(date: Date): MealSlot {
  const minutes = date.getHours() * 60 + date.getMinutes();
  if (minutes < 10 * 60 + 30) return 'Breakfast';
  if (minutes < 15 * 60) return 'Lunch';
  if (minutes < 17 * 60 + 30) return 'Snack';
  return 'Dinner';
}
