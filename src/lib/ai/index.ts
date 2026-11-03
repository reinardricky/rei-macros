import type { AiProvider } from '../types';
import { analyzeWithClaude, CLAUDE_MODEL } from './claude';
import { analyzeWithGemini, GEMINI_MODEL } from './gemini';
import type { AnalyzeInput, MealAnalysis } from './shared';

export { AnalysisError, type AnalysisErrorKind, type MealAnalysis } from './shared';

/** The APIs the in-app analysis can use. Picked, with its key, in Settings. */
export const AI_PROVIDERS: Record<AiProvider, { name: string; model: string; keyUrl: string; keyLinkLabel: string }> =
  {
    gemini: {
      name: 'Gemini',
      model: GEMINI_MODEL,
      keyUrl: 'https://aistudio.google.com/apikey',
      keyLinkLabel: 'Get a free key from Google AI Studio',
    },
    claude: {
      name: 'Claude',
      model: CLAUDE_MODEL,
      keyUrl: 'https://console.anthropic.com/settings/keys',
      keyLinkLabel: 'Get a key from the Claude Console',
    },
  };

export function analyzeMeal(
  provider: AiProvider,
  apiKey: string,
  input: AnalyzeInput,
  signal?: AbortSignal,
): Promise<MealAnalysis> {
  return provider === 'claude' ? analyzeWithClaude(apiKey, input, signal) : analyzeWithGemini(apiKey, input, signal);
}
