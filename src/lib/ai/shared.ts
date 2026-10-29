import { z } from 'zod';

import type { MealItem, MealSlot } from '../types';

/** The structured answer we ask every model for. */
export const MealAnalysisSchema = z.object({
  is_food: z.boolean(),
  meal_name: z.string(),
  items: z.array(
    z.object({
      name: z.string(),
      amount: z.number(),
      unit: z.string(),
      kcal: z.number(),
      protein_g: z.number(),
      carbs_g: z.number(),
      fat_g: z.number(),
      confidence: z.enum(['high', 'medium', 'low']),
    }),
  ),
  notes: z.string(),
});

export type RawMealAnalysis = z.infer<typeof MealAnalysisSchema>;

export const SYSTEM_PROMPT = `You estimate the nutrition of meals for a personal macro-tracking app. The user sends a photo of a meal, a typed description, or both.

List each distinct food or drink as its own item with a realistic portion estimate. Use grams for most foods and ml for drinks; use household units (cup, tbsp, slice, piece) only where that is how the food is naturally measured. Base the numbers on standard nutrition data for the prepared form shown (cooked rice, not dry). Include the things that are easy to miss but carry real calories: cooking oil, butter, dressings, sauces, sugary drinks. When the user's note gives details such as portion size, ingredients, cooking method or brand, trust the note over what the photo suggests.

Keep kcal consistent with the macros (about 4 kcal per gram of protein or carbs and 9 per gram of fat, allowing for fibre and alcohol). Round grams of food to the nearest 5 and macros to one decimal.

Set confidence per item: high when both the food and the portion are clear, medium when the portion is a guess, low when you are unsure what the food is.

meal_name is a short name for the whole meal, like "Salmon, rice & broccoli". notes is one or two short sentences telling the user what you assumed and which estimate is most worth double-checking; leave it empty if nothing stands out.

If there is no food or drink in the photo or description, set is_food to false, return no items, and say briefly in notes what you saw instead.`;

export type AnalyzeInput = { imageBase64?: string; note?: string; slot: MealSlot };

export type MealAnalysis = {
  mealName: string;
  notes: string;
  items: MealItem[];
};

export type AnalysisErrorKind = 'missing_key' | 'auth' | 'rate_limit' | 'network' | 'refused' | 'not_food' | 'api';

export class AnalysisError extends Error {
  constructor(
    public kind: AnalysisErrorKind,
    message: string,
  ) {
    super(message);
    this.name = 'AnalysisError';
  }
}

/** The text that goes alongside the photo. */
export function userText(input: AnalyzeInput): string {
  const lines = [`Meal: ${input.slot}.`];
  if (input.note?.trim()) lines.push(`My note: ${input.note.trim()}`);
  if (!input.imageBase64) lines.push('There is no photo; estimate from my description.');
  return lines.join('\n');
}

/** Turn the model's raw answer into app data, or throw if it found no food. */
export function toMealAnalysis(parsed: RawMealAnalysis, providerName: string): MealAnalysis {
  if (!parsed.is_food || parsed.items.length === 0) {
    throw new AnalysisError('not_food', parsed.notes || `${providerName} couldn't find any food in this photo.`);
  }
  return {
    mealName: parsed.meal_name,
    notes: parsed.notes,
    items: parsed.items.map((it) => ({
      name: it.name,
      amount: it.amount,
      unit: it.unit,
      kcal: it.kcal,
      protein: it.protein_g,
      carbs: it.carbs_g,
      fat: it.fat_g,
      confidence: it.confidence,
    })),
  };
}
