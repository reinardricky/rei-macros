// "Send to Claude" via the Claude Android app: the user shares the photo to the
// app, pastes this prompt, and copies Claude's JSON reply back. This runs on the
// user's own Claude plan, so no API key is involved.
import type { MealSlot } from '../types';
import { AnalysisError, MealAnalysisSchema, SYSTEM_PROMPT, toMealAnalysis, userText, type MealAnalysis } from './shared';

const EXAMPLE = `{
  "is_food": true,
  "meal_name": "Salmon, rice & broccoli",
  "items": [
    { "name": "Grilled salmon", "amount": 150, "unit": "g", "kcal": 310, "protein_g": 34, "carbs_g": 0, "fat_g": 18, "confidence": "high" }
  ],
  "notes": "Assumed the rice was cooked without oil."
}`;

/** The message to paste into the Claude app next to the shared photo. */
export function buildClaudeAppPrompt(input: { slot: MealSlot; note?: string; hasPhoto: boolean }): string {
  return [
    SYSTEM_PROMPT,
    '',
    userText(input),
    '',
    'Reply with only one JSON object in a ```json code block, in exactly this shape (confidence is "high", "medium" or "low"):',
    EXAMPLE,
  ].join('\n');
}

/** Pull the JSON object out of Claude's reply (with or without a code block) and validate it. */
export function parseClaudeReply(reply: string): MealAnalysis {
  const start = reply.indexOf('{');
  const end = reply.lastIndexOf('}');
  if (start === -1 || end <= start) {
    throw new AnalysisError('api', "That doesn't contain Claude's meal data. Copy Claude's whole reply and try again.");
  }
  let parsed;
  try {
    parsed = MealAnalysisSchema.parse(JSON.parse(reply.slice(start, end + 1)));
  } catch {
    throw new AnalysisError(
      'api',
      "Claude's reply isn't in the expected format. Ask Claude to \"reply with only the JSON\" and copy it again.",
    );
  }
  return toMealAnalysis(parsed, 'Claude');
}
