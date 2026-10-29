import { analyzeWithClaude, CLAUDE_MODEL, hasClaudeKey } from './claude';
import { analyzeWithGemini, GEMINI_MODEL, hasGeminiKey } from './gemini';
import type { AnalyzeInput, MealAnalysis } from './shared';

export { AnalysisError, type AnalysisErrorKind, type MealAnalysis } from './shared';

/** Which AI analyzes meals. Set EXPO_PUBLIC_AI_PROVIDER=claude in .env to switch; Gemini is the default. */
const useClaude = process.env.EXPO_PUBLIC_AI_PROVIDER === 'claude';

export const aiProvider = useClaude
  ? { name: 'Claude', model: CLAUDE_MODEL, keyVar: 'EXPO_PUBLIC_ANTHROPIC_API_KEY' }
  : { name: 'Gemini', model: GEMINI_MODEL, keyVar: 'EXPO_PUBLIC_GEMINI_API_KEY' };

export function hasApiKey(): boolean {
  return useClaude ? hasClaudeKey() : hasGeminiKey();
}

export function analyzeMeal(input: AnalyzeInput, signal?: AbortSignal): Promise<MealAnalysis> {
  return useClaude ? analyzeWithClaude(input, signal) : analyzeWithGemini(input, signal);
}
